// SPDX-License-Identifier: LGPL-3.0-or-later
// Part of openmouth-tts (see main.swift). Ported from edge-tts 7.3.1 (https://github.com/rany2/edge-tts),
// Copyright the edge-tts authors, and licensed LGPL-3.0-or-later like the original.
//
import Foundation

/// Microsoft Edge's online read-aloud voices: a port of the edge-tts 7.3.1 client
/// (https://github.com/rany2/edge-tts). The sentence text is sent to Microsoft.
///
/// This is an unofficial endpoint. When Microsoft changes its token scheme it stops
/// working until this file follows edge-tts again; callers fall back to a system voice.
public enum EdgeTTS {
    static let trustedClientToken = "6A5AA1D4EAFF4E9FB37E23D68491D6F4"
    static let wssURL =
        "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=\(trustedClientToken)"
    static let chromiumFullVersion = "143.0.3650.75"
    static let chromiumMajorVersion = "143"
    static let secMsGecVersion = "2-\(chromiumFullVersion)"
    static let headers = [
        "Pragma": "no-cache",
        "Cache-Control": "no-cache",
        "Origin": "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
            + "Chrome/\(chromiumMajorVersion).0.0.0 Safari/537.36 Edg/\(chromiumMajorVersion).0.0.0",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Accept-Language": "en-US,en;q=0.9",
    ]

    public struct Failure: LocalizedError {
        public let message: String
        public var errorDescription: String? { message }
    }

    /// Seconds to add to the local clock, learned from the server's Date header after a 403.
    nonisolated(unsafe) static var clockSkew: TimeInterval = 0

    /// MP3 (24 kHz mono) of `text`. `voice` is a short name such as "en-US-EmmaNeural"; `rate` like "-30%".
    public static func synthesize(_ text: String, voice: String, rate: String = "+0%") async throws -> Data {
        do {
            return try await stream(text, voice: voice, rate: rate)
        } catch let error as HandshakeError where error.status == 403 {
            // A 403 usually means the token's clock is off; edge-tts retries once with the server's time.
            if let date = error.date { clockSkew += date.timeIntervalSinceNow }
            return try await stream(text, voice: voice, rate: rate)
        }
    }

    struct HandshakeError: Error {
        let status: Int
        let date: Date?
    }

    static func stream(_ text: String, voice: String, rate: String) async throws -> Data {
        let ssml = Self.ssml(text, voice: longVoiceName(voice), rate: rate)
        guard ssml.utf8.count < 8192 else { throw Failure(message: "句子太长，在线语音一次读不了") }
        var request = URLRequest(
            url: URL(string: "\(wssURL)&ConnectionId=\(connectID())&Sec-MS-GEC=\(secMsGec())&Sec-MS-GEC-Version=\(secMsGecVersion)")!)
        for (key, value) in headers { request.setValue(value, forHTTPHeaderField: key) }
        request.setValue("muid=\(muid());", forHTTPHeaderField: "Cookie")
        request.timeoutInterval = 30

        let task = URLSession.shared.webSocketTask(with: request)
        task.resume()
        defer { task.cancel(with: .normalClosure, reason: nil) }
        do {
            try await task.send(.string(
                "X-Timestamp:\(timestamp())\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n"
                    + #"{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"true","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}"#
                    + "\r\n"))
            try await task.send(.string(
                "X-RequestId:\(connectID())\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:\(timestamp())Z\r\nPath:ssml\r\n\r\n\(ssml)"))
        } catch {
            if let http = task.response as? HTTPURLResponse, http.statusCode != 101 {
                throw HandshakeError(status: http.statusCode, date: http.value(forHTTPHeaderField: "Date").flatMap(parseHTTPDate))
            }
            throw error
        }

        var audio = Data()
        while true {
            switch try await task.receive() {
            case let .string(message):
                if message.contains("Path:turn.end") {
                    guard !audio.isEmpty else { throw Failure(message: "在线语音没有返回音频") }
                    return audio
                }
            case let .data(message):
                // 2-byte big-endian header length, the headers, then the audio.
                guard message.count >= 2 else { continue }
                let length = Int(message[message.startIndex]) << 8 | Int(message[message.startIndex + 1])
                guard message.count >= 2 + length else { continue }
                let header = String(decoding: message[(message.startIndex + 2) ..< (message.startIndex + 2 + length)], as: UTF8.self)
                if header.contains("Path:audio") && header.contains("Content-Type:audio/mpeg") {
                    audio.append(message[(message.startIndex + 2 + length)...])
                }
            @unknown default:
                continue
            }
        }
    }

    // MARK: request pieces

    /// "en-US-EmmaNeural" -> "Microsoft Server Speech Text to Speech Voice (en-US, EmmaNeural)", as Edge sends it.
    static func longVoiceName(_ voice: String) -> String {
        guard let match = voice.wholeMatch(of: #/([a-z]{2,})-([A-Z]{2,})-(.+Neural)/#) else { return voice }
        var region = String(match.2), name = String(match.3)
        if let dash = name.firstIndex(of: "-") {
            region += "-" + name[..<dash]
            name = String(name[name.index(after: dash)...])
        }
        return "Microsoft Server Speech Text to Speech Voice (\(match.1)-\(region), \(name))"
    }

    static func ssml(_ text: String, voice: String, rate: String) -> String {
        // The service rejects most control characters; then XML-escape as xml.sax.saxutils.escape does.
        let cleaned = String(String.UnicodeScalarView(text.unicodeScalars.map { s in
            (s.value <= 8 || (11 ... 12).contains(s.value) || (14 ... 31).contains(s.value)) ? " " : s
        }))
        let escaped = cleaned.replacingOccurrences(of: "&", with: "&amp;").replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "<", with: "&lt;")
        return "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>"
            + "<voice name='\(voice)'><prosody pitch='+0Hz' rate='\(rate)' volume='+0%'>\(escaped)</prosody></voice></speak>"
    }

    static func connectID() -> String { UUID().uuidString.replacingOccurrences(of: "-", with: "").lowercased() }

    static func muid() -> String {
        (0 ..< 16).map { _ in String(format: "%02X", UInt8.random(in: 0 ... 255)) }.joined()
    }

    /// JavaScript-style UTC date, as Edge sends it.
    static func timestamp() -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "EEE MMM dd yyyy HH:mm:ss 'GMT+0000 (Coordinated Universal Time)'"
        return f.string(from: Date())
    }

    static func parseHTTPDate(_ string: String) -> Date? {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "GMT")
        f.dateFormat = "EEE, dd MMM yyyy HH:mm:ss zzz"
        return f.date(from: string)
    }
}

// MARK: - Sec-MS-GEC v2 (edge_tts/drm.py)

extension EdgeTTS {
    /// The token: the current Windows file time rounded down to 5 minutes, hashed with the client token.
    public static func secMsGec(unixTime: Double? = nil) -> String {
        var ticks = (unixTime ?? Date().timeIntervalSince1970 + clockSkew) + 11_644_473_600
        ticks -= ticks.truncatingRemainder(dividingBy: 300)
        ticks *= 1e9 / 100
        let data = Array((String(format: "%.0f", ticks) + trustedClientToken).utf8)
        let digest = sha256(data)
        let (lo, hi) = cs64(data, digest)
        let cs = withUnsafeBytes(of: lo.littleEndian, Array.init) + withUnsafeBytes(of: hi.littleEndian, Array.init)
        return hex(cs) + "-" + hex(digest)
    }

    static func hex(_ bytes: [UInt8]) -> String { bytes.map { String(format: "%02X", $0) }.joined() }

    static let sha256Initial: [UInt32] = [
        0x6A09_E667, 0xBB67_AE85, 0x3C6E_F372, 0xA54F_F53A, 0x510E_527F, 0x9B05_688C, 0x1F83_D9AB, 0x5BE0_CD19,
    ]
    static let sha256State: [UInt32] = [
        0xFD9F_BEA2, 0x9124_3CE7, 0xBE49_9094, 0xCD2E_1E0A, 0x6C00_6F49, 0x04BD_35AB, 0xFEB0_A7E4, 0x03EF_FBD2,
    ]
    static let sha256Schedule: [UInt32] = [
        0xEB24_BF9E, 0x1558_691F, 0xA0C0_9EE2, 0x0CFA_32BA, 0xA622_EE8C, 0xD1DD_9491, 0xC0DD_25A0, 0xF9E7_0AB6,
        0xF0C3_1573, 0x7058_CE4E, 0x7188_E606, 0x00E5_AB33, 0xD258_B060, 0x7276_6564,
    ]
    static let roundConstants: [UInt32] = [
        0x428A_2F98, 0x7137_4491, 0xB5C0_FBCF, 0xE9B5_DBA5, 0x3956_C25B, 0x59F1_11F1, 0x923F_82A4, 0xAB1C_5ED5,
        0xD807_AA98, 0x1283_5B01, 0x2431_85BE, 0x550C_7DC3, 0x72BE_5D74, 0x80DE_B1FE, 0x9BDC_06A7, 0xC19B_F174,
        0xE49B_69C1, 0xEFBE_4786, 0x0FC1_9DC6, 0x240C_A1CC, 0x2DE9_2C6F, 0x4A74_84AA, 0x5CB0_A9DC, 0x76F9_88DA,
        0x983E_5152, 0xA831_C66D, 0xB003_27C8, 0xBF59_7FC7, 0xC6E0_0BF3, 0xD5A7_9147, 0x06CA_6351, 0x1429_2967,
        0x27B7_0A85, 0x2E1B_2138, 0x4D2C_6DFC, 0x5338_0D13, 0x650A_7354, 0x766A_0ABB, 0x81C2_C92E, 0x9272_2C85,
        0xA2BF_E8A1, 0xA81A_664B, 0xC24B_8B70, 0xC76C_51A3, 0xD192_E819, 0xD699_0624, 0xF40E_3585, 0x106A_A070,
        0x19A4_C116, 0x1E37_6C08, 0x2748_774C, 0x34B0_BCB5, 0x391C_0CB3, 0x4ED8_AA4A, 0x5B9C_CA4F, 0x682E_6FF3,
        0x748F_82EE, 0x78A5_636F, 0x84C8_7814, 0x8CC7_0208, 0x90BE_FFFA, 0xA450_6CEB, 0xBEF9_A3F7, 0xC671_78F2,
    ]
    static let sha256Adjustment: UInt32 = 0xC9DC_06A7
    static let blockConstants: [UInt32] = Array(roundConstants[..<14]) + [sha256Adjustment] + Array(roundConstants[15...])
    static let sigma0Adjustment: UInt32 = 0x059C_0B80
    static let sigma1Adjustment: UInt32 = 0x000B_92C0

    static func rotr(_ x: UInt32, _ n: UInt32) -> UInt32 { (x >> n) | (x << (32 - n)) }
    static func sigma0(_ x: UInt32) -> UInt32 { rotr(x, 7) ^ rotr(x, 18) ^ (x >> 3) }
    static func sigma1(_ x: UInt32) -> UInt32 { rotr(x, 17) ^ rotr(x, 19) ^ (x >> 10) }

    static func expand(_ w: inout [UInt32], from first: Int = 16) {
        for i in first ..< 64 { w.append(sigma1(w[i - 2]) &+ w[i - 7] &+ sigma0(w[i - 15]) &+ w[i - 16]) }
    }

    /// SHA-256 compression rounds `first..<64` (round constants tweaked when resuming at 14).
    static func rounds(_ state: [UInt32], _ w: [UInt32], from first: Int = 0) -> [UInt32] {
        let k = first == 14 ? blockConstants : roundConstants
        var (a, b, c, d, e, f, g, h) = (state[0], state[1], state[2], state[3], state[4], state[5], state[6], state[7])
        for i in first ..< 64 {
            let t1 = h &+ (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) &+ (g ^ (e & (f ^ g))) &+ k[i] &+ w[i]
            let t2 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) &+ ((a & b) | (c & (a | b)))
            (h, g, f, e, d, c, b, a) = (g, f, e, d &+ t1, c, b, a, t1 &+ t2)
        }
        return [a, b, c, d, e, f, g, h]
    }

    /// The state after the first block, which holds a fixed prefix and the first 7 bytes of the data.
    static func sha256Init(_ data: ArraySlice<UInt8>) -> [UInt32] {
        let bytes = Array(data)
        var w = [UInt32](repeating: 0, count: 14)
        w.append(UInt32(bytes[0]) << 16 | UInt32(bytes[1]) << 8 | UInt32(bytes[2]))
        w.append(UInt32(bytes[3]) << 24 | UInt32(bytes[4]) << 16 | UInt32(bytes[5]) << 8 | UInt32(bytes[6]))
        for i in 16 ..< 30 {
            var value = sha256Schedule[i - 16]
            if i - 2 >= 14 { value = value &+ (i == 16 ? sigma1(w[i - 2]) ^ sigma1Adjustment : sigma1(w[i - 2])) }
            if i - 7 >= 14 { value = value &+ w[i - 7] }
            if i - 15 >= 14 { value = value &+ (i == 29 ? sigma0(w[i - 15]) ^ sigma0Adjustment : sigma0(w[i - 15])) }
            w.append(value)
        }
        w.append(sigma1(w[28]) &+ w[23] &+ sigma0(w[15]) &+ w[14] &+ sha256Adjustment &- roundConstants[14])
        expand(&w, from: 31)
        let working = rounds(sha256State, w, from: 14)
        return zip(sha256Initial, working).map { $0 &+ $1 }
    }

    static func sha256(_ data: [UInt8]) -> [UInt8] {
        let length = 57 + data.count
        var padded = Array(data[7...]) + [0x80]
        let zeros = ((55 - length) % 64 + 64) % 64  // Python's modulo is never negative
        padded += [UInt8](repeating: 0, count: zeros)
        padded += withUnsafeBytes(of: UInt64(length * 8).bigEndian, Array.init)
        var state = sha256Init(data[..<7])
        for offset in stride(from: 0, to: padded.count, by: 64) {
            var w = (0 ..< 16).map { i in
                padded[(offset + 4 * i) ..< (offset + 4 * i + 4)].reduce(UInt32(0)) { $0 << 8 | UInt32($1) }
            }
            expand(&w)
            state = zip(state, rounds(state, w)).map { $0 &+ $1 }
        }
        return state.flatMap { withUnsafeBytes(of: $0.bigEndian, Array.init) }
    }

    static let cs64Coefficients: [(UInt32, UInt32)] = [
        (0xE82E_91B1, 0xB327_00D0), (0x44DE_24C6, 0x88DF_F51D), (0x3BEB_65BC, 0x2951_4038), (0xC89C_5933, 0xB328_CBDF),
        (0x8D1E_C211, 0xD405_B4D5), (0x314E_F5D5, 0x26E5_5F3C), (0xE924_91B1, 0x6078_01C6), (0xF0A5_B9D5, 0x82B2_C1FB),
        (0x0606_4CF3, 0xFA51_A3DA), (0xDA79_FA60, 0x207C_C464), (0xBED2_0560, 0x3C3C_74F3), (0x89F9_C9F8, 0xD2D1_4B61),
        (0x35FA_38C6, 0xBB04_A2C1), (0xCB49_E3C6, 0xC562_6167),
    ]

    static func rol16(_ x: UInt32) -> UInt32 { x << 16 | x >> 16 }

    static func cs64(_ data: [UInt8], _ digest: [UInt8]) -> (UInt32, UInt32) {
        func le(_ b: ArraySlice<UInt8>) -> UInt32 { b.reversed().reduce(UInt32(0)) { $0 << 8 | UInt32($1) } }
        let keyA = le(digest[0 ..< 4]) | 1, keyB = le(digest[4 ..< 8]) | 1
        let factors = [keyA &* 0x8289_3933, keyB &* 0x8289_3933]
        var terms = cs64Coefficients.enumerated().map { $1.0 &* factors[$0 % 2] }
        var offsets = cs64Coefficients.map(\.1)

        var bytes = [0] + data
        bytes += [UInt8](repeating: 0, count: (4 - bytes.count % 4) % 4)
        var words = stride(from: 0, to: bytes.count, by: 4).map { le(bytes[$0 ..< $0 + 4]) }
        if words.count % 2 == 1 { words.append(0) }
        for (i, word) in words.enumerated() {
            var term = word &* (i % 2 == 0 ? keyA : keyB)
            var offset = rol16(word) &* (i % 2 == 0 ? 0xEF05_69FB : 0xC317_13DB)
            if i == 0 {
                term = term &+ (0xF2F9_0B1A &* factors[0])
                offset = offset &+ 0x0B1A_0000
            }
            terms.append(term)
            offsets.append(offset)
        }

        var swapAcc: UInt32 = 0, swapLast: UInt32 = 0, state: UInt32 = 0, acc: UInt32 = 0
        for i in stride(from: 0, to: terms.count, by: 2) {
            let x = terms[i], y = terms[i + 1]
            var t = rol16(offsets[i] &+ x)
            var q = t &* 0x76F5_0F34
            swapAcc = swapAcc &+ (rol16(q) &* 0xC3EF_EA97 &+ q)
            t = rol16(offsets[i + 1] &+ y)
            q = t &* 0x1881_CE3C
            swapLast = rol16(q) &* 0x35BD_1EC9 &+ q
            swapAcc = swapAcc &+ swapLast

            state = state &* keyA &+ x
            state = rol16(state) &* 0xCF98_B111
            state = rol16(state) &* 0x8708_5B9F
            state = rol16(state) &* 0x12CE_B96D
            state = rol16(state) &* 0x257E_1D83
            acc = acc &+ state
            t = state &* keyB &+ y
            t = rol16(t) &* 0xA274_16F5
            t = rol16(t) &* 0xD383_96FF
            state = rol16(rol16(t) &* 0x7C93_2B89) &* 0xBFA4_9F69
            acc = acc &+ state
        }
        return (swapLast ^ state, swapAcc ^ acc)
    }
}

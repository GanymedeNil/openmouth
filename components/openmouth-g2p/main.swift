// SPDX-License-Identifier: GPL-3.0-or-later
// openmouth-g2p: espeak-ng's phonemizer as a program of its own. OpenMouth starts it beside itself and
// talks to it over pipes, so the app itself never loads espeak-ng.
//
//   openmouth-g2p <libespeak-ng.dylib> <espeak-ng-data>
//
// Once ready it prints one JSON line, {"ok": true} (or {"error": "..."} and exits). Then for every line
// it reads, a JSON string holding a text, it prints one JSON line back: {"ipa": "..."}, espeak-ng's IPA
// for the text with "_" between phonemes and the clauses joined by spaces. It exits when its input closes.
//
// Copyright (C) 2026 the OpenMouth authors.
//
// This program is free software: you can redistribute it and/or modify it under the terms of the GNU
// General Public License as published by the Free Software Foundation, either version 3 of the License,
// or (at your option) any later version. This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
// PARTICULAR PURPOSE. See the GNU General Public License for more details: <https://www.gnu.org/licenses/>.
//
// It uses espeak-ng (https://github.com/espeak-ng/espeak-ng), GPL-3.0-or-later.

import Foundation

typealias Initialize = @convention(c) (Int32, Int32, UnsafePointer<CChar>?, Int32) -> Int32
typealias SetVoice = @convention(c) (UnsafePointer<CChar>) -> Int32
typealias TextToPhonemes = @convention(c) (UnsafeMutablePointer<UnsafeRawPointer?>, Int32, Int32) -> UnsafePointer<CChar>?

func reply(_ object: [String: Any]) {
    var data = (try? JSONSerialization.data(withJSONObject: object)) ?? Data("{}".utf8)
    data.append(0x0A)
    FileHandle.standardOutput.write(data)
}

func fail(_ message: String) -> Never {
    reply(["error": message])
    exit(1)
}

/// The data path to hand espeak-ng. It keeps the path in a 160-byte buffer and calls exit() when it
/// can't load its data, so check the data is there and use a short link to a long path.
func reachable(_ data: URL) -> String {
    guard FileManager.default.fileExists(atPath: data.appendingPathComponent("phontab").path) else {
        fail("espeak-ng 数据不完整：\(data.path)")
    }
    if data.path.utf8.count <= 100 { return data.path }
    let link = FileManager.default.temporaryDirectory.appendingPathComponent("openmouth-espeak-ng-data")
    try? FileManager.default.removeItem(at: link)
    guard (try? FileManager.default.createSymbolicLink(at: link, withDestinationURL: data)) != nil, link.path.utf8.count <= 100 else {
        fail("espeak-ng 数据路径太长：\(data.path)")
    }
    return link.path
}

let args = CommandLine.arguments
guard args.count == 3 else { fail("用法：openmouth-g2p <libespeak-ng.dylib> <espeak-ng-data>") }
guard let handle = dlopen(args[1], RTLD_NOW | RTLD_LOCAL) else { fail("无法加载 espeak-ng：\(String(cString: dlerror()))") }
guard let initPtr = dlsym(handle, "espeak_Initialize"), let voicePtr = dlsym(handle, "espeak_SetVoiceByName"),
      let phonemesPtr = dlsym(handle, "espeak_TextToPhonemes")
else { fail("espeak-ng 库缺少需要的函数") }
let initialize = unsafeBitCast(initPtr, to: Initialize.self)
let setVoice = unsafeBitCast(voicePtr, to: SetVoice.self)
let textToPhonemes = unsafeBitCast(phonemesPtr, to: TextToPhonemes.self)
// 0x02: AUDIO_OUTPUT_SYNCHRONOUS (no audio device needed)
guard initialize(0x02, 0, reachable(URL(fileURLWithPath: args[2])), 0) > 0 else { fail("espeak-ng 初始化失败：\(args[2])") }
guard setVoice("en-us") == 0 else { fail("espeak-ng 没有 en-us 语音") }
reply(["ok": true])

while let line = readLine(strippingNewline: true) {
    guard let text = (try? JSONSerialization.jsonObject(with: Data(line.utf8), options: .fragmentsAllowed)) as? String else {
        reply(["error": "not a JSON string"])
        continue
    }
    var chunks: [String] = []
    text.withCString { cstr in
        var pointer: UnsafeRawPointer? = UnsafeRawPointer(cstr)
        // IPA output with "_" between phonemes; called until the whole text is consumed.
        while pointer != nil {
            if let out = textToPhonemes(&pointer, 1, Int32(UInt8(ascii: "_")) << 8 | 0x02) {
                let s = String(cString: out)
                if !s.isEmpty { chunks.append(s) }
            }
        }
    }
    reply(["ipa": chunks.joined(separator: " ")])
}

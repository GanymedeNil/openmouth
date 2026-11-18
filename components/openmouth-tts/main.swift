// SPDX-License-Identifier: LGPL-3.0-or-later
// openmouth-tts: Microsoft Edge's online read-aloud voices as a small program of its own. OpenMouth
// runs it for the reference audio, so the app itself carries none of the edge-tts code that
// EdgeTTS.swift is ported from.
//
//   openmouth-tts --voice en-US-EmmaNeural [--rate +0%] --out speech.mp3     (the text on stdin)
//   openmouth-tts --sec-ms-gec [unix time ...]                               (the token, to check against edge-tts)
//
// Writes the MP3 and exits 0. Otherwise exits 1 with one line on stderr: "service: ..." when the service
// answered without audio, "network: ..." when it couldn't be reached.
//
// Copyright (C) 2026 GanymedeNil. EdgeTTS.swift: ported from edge-tts 7.3.1 (https://github.com/rany2/edge-tts),
// Copyright the edge-tts authors.
//
// This program is free software: you can redistribute it and/or modify it under the terms of the GNU
// Lesser General Public License as published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version. This program is distributed in the hope that it will
// be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
// FOR A PARTICULAR PURPOSE. See the GNU Lesser General Public License for more details:
// <https://www.gnu.org/licenses/>.

import Foundation

let args = CommandLine.arguments
func option(_ name: String) -> String? { args.firstIndex(of: name).flatMap { args.count > $0 + 1 ? args[$0 + 1] : nil } }
func fail(_ line: String, status: Int32 = 1) -> Never {
    FileHandle.standardError.write(Data((line + "\n").utf8))
    exit(status)
}

if let i = args.firstIndex(of: "--sec-ms-gec") {
    let times = args[(i + 1)...].compactMap(Double.init)
    for t in times.isEmpty ? [Date().timeIntervalSince1970] : times { print(t, EdgeTTS.secMsGec(unixTime: t)) }
    exit(0)
}
guard let voice = option("--voice"), let out = option("--out") else {
    fail("usage: openmouth-tts --voice NAME [--rate +0%] --out FILE < text", status: 2)
}
let text = String(decoding: FileHandle.standardInput.readDataToEndOfFile(), as: UTF8.self)
do {
    let audio = try await EdgeTTS.synthesize(text, voice: voice, rate: option("--rate") ?? "+0%")
    try audio.write(to: URL(fileURLWithPath: out), options: .atomic)
    exit(0)
} catch let failure as EdgeTTS.Failure {
    fail("service: \(failure.message)")
} catch let error as URLError {
    fail("network: \(error.localizedDescription)")
} catch {
    fail("service: \(error.localizedDescription)")
}

# 开源组件

OpenMouth 附带两个独立的小程序。App 启动它们、通过管道或临时文件和它们交换数据，主程序里不含它们的代码。它们按开源许可发布，你可以自由地研究、修改和重新编译。

| 程序 | 作用 | 许可 |
|---|---|---|
| [openmouth-g2p](openmouth-g2p/) | 调用 [espeak-ng](https://github.com/espeak-ng/espeak-ng) 把英文转成音标 | GPL-3.0-or-later（[全文](../LICENSES/GPL-3.0.txt)） |
| [openmouth-tts](openmouth-tts/) | 用微软 Edge 的在线朗读服务生成示范音，移植自 [edge-tts](https://github.com/rany2/edge-tts) 7.3.1 | LGPL-3.0-or-later（[全文](../LICENSES/LGPL-3.0.txt)） |

在 App 里它们位于 `OpenMouth.app/Contents/MacOS/`。

## 编译

需要 Xcode 命令行工具（Swift 5.10 或更新），只依赖 Foundation：

```bash
swiftc -O -o openmouth-g2p openmouth-g2p/main.swift
swiftc -O -o openmouth-tts openmouth-tts/main.swift openmouth-tts/EdgeTTS.swift
```

## 用法

**openmouth-g2p**

```bash
openmouth-g2p <libespeak-ng.dylib> <espeak-ng-data 目录>
```

准备好后输出一行 `{"ok": true}`（出错时输出 `{"error": "..."}` 并退出）。之后每读入一行（一个 JSON 字符串，即要转换的英文），输出一行 `{"ipa": "..."}`：espeak-ng 的 IPA，音素之间用 `_` 隔开，分句之间用空格隔开。输入关闭后退出。

App 里用的 espeak-ng 是 1.52.0 版，动态库和数据文件来自 [espeakng-loader](https://github.com/thewh1teagle/espeakng-loader) 0.2.4，没有修改；espeak-ng 的源代码见 <https://github.com/espeak-ng/espeak-ng>（1.52.0 版）。

**openmouth-tts**

```bash
echo "It's my pleasure." | openmouth-tts --voice en-US-EmmaNeural --rate +0% --out speech.mp3
openmouth-tts --sec-ms-gec            # 打印当前的访问令牌，用来和 edge-tts 核对
```

成功时写出 MP3 并以 0 退出；失败时以 1 退出，并在 stderr 输出一行：`service: ...`（服务有回应但没给出音频）或 `network: ...`（连不上服务）。

## 让 App 使用你自己编译的版本

不用改动 App，从终端启动时用环境变量指定即可：

```bash
OPENMOUTH_G2P=/path/to/openmouth-g2p OPENMOUTH_TTS=/path/to/openmouth-tts \
    /Applications/OpenMouth.app/Contents/MacOS/OpenMouth
```

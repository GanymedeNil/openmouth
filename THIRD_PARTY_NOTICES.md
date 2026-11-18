# 第三方软件、模型和数据

OpenMouth 本身是闭源的免费软件（见 [软件许可协议](EULA.md)），版权归 GanymedeNil 所有。下面这些是开源的，或者不是 OpenMouth 写的，各自有自己的许可。

## 随 App 一起分发的开源程序

App 通过管道调用这两个独立的小程序，主程序里不含它们的代码。它们的源代码就在这个仓库的 [components](components/) 里，也附在 DMG 的「第三方许可」文件夹里。

| 程序 | 用途 | 许可 |
|---|---|---|
| `openmouth-g2p` | 调用 espeak-ng 把英文转成音标 | GPL-3.0-or-later，见 [LICENSES/GPL-3.0.txt](LICENSES/GPL-3.0.txt) |
| `openmouth-tts` | 用微软 Edge 的在线朗读服务生成示范音；移植自 [edge-tts](https://github.com/rany2/edge-tts) 7.3.1 | LGPL-3.0-or-later，见 [LICENSES/LGPL-3.0.txt](LICENSES/LGPL-3.0.txt) |

## 随 App 一起分发的第三方软件

| 组件 | 用途 | 许可 |
|---|---|---|
| [espeak-ng](https://github.com/espeak-ng/espeak-ng) 1.52.0 | 英文转音标（由 `openmouth-g2p` 加载），动态库和数据来自 [espeakng-loader](https://github.com/thewh1teagle/espeakng-loader) 0.2.4，未修改 | GPL-3.0-or-later |
| [MLX / mlx-swift](https://github.com/ml-explore/mlx-swift) | 在 Apple 芯片的 GPU 上运行评分模型 | MIT |
| [Swift Numerics](https://github.com/apple/swift-numerics) | mlx-swift 的依赖 | Apache-2.0 |

## 评分模型（第一次运行时下载）

三个 wav2vec2 音素识别模型，转换成 MLX 格式后放在 [ModelScope](https://modelscope.cn/models/Progeny5990/om)，许可以原始页面为准：

| 模型 | 许可 | 说明 |
|---|---|---|
| [facebook/wav2vec2-lv-60-espeak-cv-ft](https://huggingface.co/facebook/wav2vec2-lv-60-espeak-cv-ft) | Apache-2.0 | 在 Common Voice 上训练 |
| [mrrubino/wav2vec2-large-xlsr-53-l2-arctic-phoneme](https://huggingface.co/mrrubino/wav2vec2-large-xlsr-53-l2-arctic-phoneme) | Apache-2.0 | 从名字看在 L2-ARCTIC 上训练，L2-ARCTIC 是 CC BY-NC 4.0（仅限非商业使用） |
| [slplab/wav2vec2-large-robust-L2-english-phoneme-recognition](https://huggingface.co/slplab/wav2vec2-large-robust-L2-english-phoneme-recognition) | 页面未注明许可 | 在韩国学习者英语数据上训练 |

## 数据集

- [speechocean762](https://huggingface.co/datasets/mispeech/speechocean762)（Apache-2.0）：用来校准评分阈值、拟合流利度模型和评测准确率。
- App 不包含任何课程内容（例如新概念英语），课程由用户自己导入。

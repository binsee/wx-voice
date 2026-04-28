# wx-voice [![npm](https://img.shields.io/npm/v/wx-voice.svg?colorB=4c1)](https://www.npmjs.com/package/wx-voice)

转换腾讯 App（微信、微信小程序、QQ）或 Silk 编码的音频至其他音频格式，如 MP3 及 M4A。

[English Readme](README.md)

> 本项目是 [Ang-YC/wx-voice](https://github.com/Ang-YC/wx-voice)（作者 [AngYC](https://angyc.com/)）的维护分支，感谢原作者的基础工作。

---

## 安装

```
npm install wx-voice --save
```

无需额外编译步骤。安装时会自动下载当前平台对应的预编译 Silk SDK 二进制文件。

### 支持的平台

| 平台    | 架构        |
|---------|-------------|
| Linux   | x64, arm64  |
| macOS   | x64, arm64  |
| Windows | x64, arm64  |

> **不支持的平台？** 克隆仓库后执行 `make -C silk`，库会自动检测并使用本地编译的二进制文件。

---

## 必须先安装的依赖

FFmpeg 通过 [`@ffmpeg-installer/ffmpeg`](https://www.npmjs.com/package/@ffmpeg-installer/ffmpeg) 和 [`@ffprobe-installer/ffprobe`](https://www.npmjs.com/package/@ffprobe-installer/ffprobe) 自动处理，无需手动安装。

---

## CLI 使用方法

```
wx-voice <command> <options>
```

```
例子：
$ wx-voice decode -i input.silk -o output.mp3 -f mp3
$ wx-voice encode -i input.mp3 -o output.silk -f silk
```

### 命令

```
Command:
  decode    解码 silk 或 webm 至其他格式
  encode    编码其他格式至 silk 或 webm
  duration  获取音频文件时长

Options:
  -i <input>    输入的音频文件路径
  -o <output>   输出的音频文件路径
  -f <format>   输出的格式
  --bitrate     输出的比特率
  --frequency   输出的采样率
  --channels    输出的声道数
```

---

## API 使用方法

```js
const WxVoice = require('wx-voice');
const voice = new WxVoice();

// 错误处理
voice.on('error', (err) => console.log(err));

// 解码 silk 至 MP3
voice.decode('input.silk', 'output.mp3', { format: 'mp3' })
    .then((file) => console.log(file));
// 输出: "/path/to/output.mp3"

// 编码 MP3 至 silk
voice.encode('input.mp3', 'output.silk', { format: 'silk' })
    .then((file) => console.log(file));
// 输出: "/path/to/output.silk"

// 获取 silk 文件时长
voice.duration('input.silk')
    .then((seconds) => console.log(seconds));
// 输出: 10.24
```

## API

### new WxVoice([tempFolder])

| 参数       | 说明 |
| ---------- | ---- |
| tempFolder | 临时文件目录，默认为系统临时目录 |

如果 Silk SDK 二进制文件未找到（不支持的平台且未本地编译），构造函数会抛出错误。

### decode(input, output, [options])

将 Silk/WebM 音频文件解码为通用格式（mp3、m4a、wav、pcm 等）。

返回 `Promise<string>`，成功时 resolve 为输出文件路径。

```js
voice.decode('input.silk', 'output.mp3')
voice.decode('input.silk', 'output.pcm', { format: 'pcm', frequency: 16000 })
```

### encode(input, output, [options])

将通用音频文件编码为 Silk 或 WebM 格式。

返回 `Promise<string>`，成功时 resolve 为输出文件路径。

```js
voice.encode('input.mp3', 'output.silk', { format: 'silk' })
voice.encode('input.mp3', 'output.silk', { format: 'silk_amr' })  // AMR 兼容头
voice.encode('input.mp3', 'output.webm', { format: 'webm' })      // base64 data URI
```

### duration(filePath)

获取音频文件时长（秒）。

- Silk 文件：直接解析二进制帧结构（无需 FFmpeg）
- 其他格式：使用 FFprobe

返回 `Promise<number>`，文件无法读取时 resolve 为 `0`。

```js
voice.duration('input.silk').then((s) => console.log(s + 's'))
```

### Options

| 参数      | 说明 |
| --------- | ---- |
| format    | 输出格式（`silk`、`silk_amr`、`webm`、`mp3`、`m4a`、`wav`、`pcm` 等），默认从输出文件扩展名解析 |
| bitrate   | 比特率，单位 kbps |
| frequency | 采样率，单位 Hz（如 `16000`、`24000`、`44100`） |
| channels  | 声道数，默认 `1` |

---

## 支持的文件格式

**解码：** 已测试 `mp3`、`m4a`、`wav`、`pcm`
**编码：** 已测试 `silk`、`silk_amr`、`webm`

---

## 不支持的平台

如果你的平台不在支持列表中，可以本地编译 Silk SDK：

```bash
git clone https://github.com/binsee/wx-voice.git
cd wx-voice
npm install
npm run build:silk
```

库会自动检测并使用本地编译的 `silk/encoder` 和 `silk/decoder` 二进制文件。

---

## 许可证

MIT © [binsee](https://github.com/binsee)

原始代码 MIT © [Ang YC](https://angyc.com)

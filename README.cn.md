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

- **FFmpeg**: [安装 FFmpeg](#安装-ffmpeg)

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

voice.on('error', (err) => console.log(err));

// 解码 silk 至 MP3
voice.decode('input.silk', 'output.mp3', { format: 'mp3' })
    .then((file) => console.log(file));
// 输出: "/path/to/output.mp3"
```

## API

### new WxVoice([tempFolder])

| 参数       | 说明 |
| ---------- | ---- |
| tempFolder | 临时文件目录，默认为系统临时目录 |

### decode(input, output, [options])
解码音频至通用格式，返回 `Promise<string>`。

### encode(input, output, [options])
编码音频至 silk/webm 格式，返回 `Promise<string>`。

### duration(filePath)
获取音频时长（秒），返回 `Promise<number>`。

### Options

| 参数      | 说明 |
| --------- | ---- |
| format    | 输出格式（silk、webm、mp3、m4a 等），默认从输出文件扩展名解析 |
| bitrate   | 比特率，单位 bps |
| frequency | 采样率，单位 Hz |
| channels  | 声道数，默认 1 |

---

## 支持的文件格式

**解码：** 已测试 `mp3`、`m4a`、`wav`、`pcm`
**编码：** 已测试 `silk`、`silk_amr`、`webm`

---

## 安装 FFmpeg

| 系统    | 命令 |
| ------- | ---- |
| Ubuntu  | `sudo apt-get install ffmpeg` |
| CentOS  | `sudo yum install ffmpeg` |
| macOS   | `brew install ffmpeg` |
| Windows | [从 ffmpeg.org 下载](https://ffmpeg.org/download.html) |

---

## 许可证

MIT © [binsee](https://github.com/binsee)

原始代码 MIT © [Ang YC](https://angyc.com)

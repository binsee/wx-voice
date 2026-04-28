# wx-voice [![npm](https://img.shields.io/npm/v/wx-voice.svg?colorB=4c1)](https://www.npmjs.com/package/wx-voice)

Convert audio files between Tencent apps (Weixin / WeChat, QQ) and Silk codec with other general formats such as MP3 and M4A.

[中文版](README.cn.md)

> This project is a maintained fork of [Ang-YC/wx-voice](https://github.com/Ang-YC/wx-voice) by [AngYC](https://angyc.com/). Many thanks to the original author for the foundational work.

---

## Install

```
npm install wx-voice --save
```

No additional compilation step required. Pre-compiled Silk SDK binaries are automatically installed for your platform.

### Supported Platforms

| Platform | Architecture |
|----------|-------------|
| Linux    | x64, arm64  |
| macOS    | x64, arm64  |
| Windows  | x64, arm64  |

> **Unsupported platform?** Clone the repository and run `make -C silk`. The library will automatically detect and use the locally compiled binaries.

---

## Prerequisites

- **FFmpeg**: [Installing ffmpeg](#installing-ffmpeg)

---

## CLI Usage

```
wx-voice <command> <options>
```

```
Example:
$ wx-voice decode -i input.silk -o output.mp3 -f mp3
$ wx-voice encode -i input.mp3 -o output.silk -f silk
```

### Commands

```
Command:
  decode    decode to general audio format
  encode    encode from general audio format

Options:
  -i <input>    input file path
  -o <output>   output file path
  -f <format>   format of the output file
  --bitrate     bitrate of the output file
  --frequency   frequency of the output file
  --channels    channels of the output file
```

---

## API Usage

```js
const WxVoice = require('wx-voice');
const voice = new WxVoice();

voice.on('error', (err) => console.log(err));

// Decode silk to MP3
voice.decode('input.silk', 'output.mp3', { format: 'mp3' })
    .then((file) => console.log(file));
// Output: "/path/to/output.mp3"
```

## API

### new WxVoice([tempFolder])

| Parameter  | Description |
| ---------- | ----------- |
| tempFolder | Folder for temporary files, defaults to system temp |

### decode(input, output, [options])
Decode audio to general formats. Returns `Promise<string>`.

### encode(input, output, [options])
Encode audio to silk/webm format. Returns `Promise<string>`.

### duration(filePath)
Get duration of audio file in seconds. Returns `Promise<number>`.

### Options

| Parameter | Description |
| --------- | ----------- |
| format    | Format (silk, webm, mp3, m4a...), default parsed from output extension |
| bitrate   | Bitrate in bps |
| frequency | Frequency in Hz |
| channels  | Channels, default 1 |

---

## File types

**Decode:** Tested on `mp3`, `m4a`, `wav`, `pcm`
**Encode:** Tested on `silk`, `silk_amr`, `webm`

---

## Installing ffmpeg

| OS      | Command |
| ------- | ------- |
| Ubuntu  | `sudo apt-get install ffmpeg` |
| CentOS  | `sudo yum install ffmpeg` |
| macOS   | `brew install ffmpeg` |
| Windows | [Download from ffmpeg.org](https://ffmpeg.org/download.html) |

---

## License

MIT © [binsee](https://github.com/binsee)

Original work MIT © [Ang YC](https://angyc.com)

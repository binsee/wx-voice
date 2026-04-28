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

FFmpeg is bundled automatically via [`@ffmpeg-installer/ffmpeg`](https://www.npmjs.com/package/@ffmpeg-installer/ffmpeg) and [`@ffprobe-installer/ffprobe`](https://www.npmjs.com/package/@ffprobe-installer/ffprobe). No manual FFmpeg installation is required.

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
  duration  get duration of audio file

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

// Error handler
voice.on('error', (err) => console.log(err));

// Decode silk to MP3
voice.decode('input.silk', 'output.mp3', { format: 'mp3' })
    .then((file) => console.log(file));
// Output: "/path/to/output.mp3"

// Encode MP3 to silk
voice.encode('input.mp3', 'output.silk', { format: 'silk' })
    .then((file) => console.log(file));
// Output: "/path/to/output.silk"

// Get duration of a silk file
voice.duration('input.silk')
    .then((seconds) => console.log(seconds));
// Output: 10.24
```

## API

### new WxVoice([tempFolder])

| Parameter  | Description |
| ---------- | ----------- |
| tempFolder | Folder for temporary files, defaults to system temp |

Throws if Silk SDK binaries are not found (unsupported platform without local build).

### decode(input, output, [options])

Decode a Silk/WebM audio file to a general format (mp3, m4a, wav, pcm, etc.).

Returns `Promise<string>` — resolves with the output file path on success.

```js
voice.decode('input.silk', 'output.mp3')
voice.decode('input.silk', 'output.pcm', { format: 'pcm', frequency: 16000 })
```

### encode(input, output, [options])

Encode a general audio file to Silk or WebM format.

Returns `Promise<string>` — resolves with the output file path on success.

```js
voice.encode('input.mp3', 'output.silk', { format: 'silk' })
voice.encode('input.mp3', 'output.silk', { format: 'silk_amr' })  // AMR-compatible header
voice.encode('input.mp3', 'output.webm', { format: 'webm' })      // base64 data URI
```

### duration(filePath)

Get the duration of an audio file in seconds.

- For Silk files: parsed directly from the binary frame structure (no FFmpeg needed)
- For other formats: uses FFprobe

Returns `Promise<number>` — resolves with `0` if the file cannot be read.

```js
voice.duration('input.silk').then((s) => console.log(s + 's'))
```

### Options

| Parameter | Description |
| --------- | ----------- |
| format    | Output format (`silk`, `silk_amr`, `webm`, `mp3`, `m4a`, `wav`, `pcm`...), default parsed from output file extension |
| bitrate   | Bitrate in kbps |
| frequency | Sample rate in Hz (e.g. `16000`, `24000`, `44100`) |
| channels  | Number of channels, default `1` |

---

## File types

**Decode:** Tested on `mp3`, `m4a`, `wav`, `pcm`
**Encode:** Tested on `silk`, `silk_amr`, `webm`

---

## Unsupported platform

If your platform is not in the supported list, you can build the Silk SDK locally:

```bash
git clone https://github.com/binsee/wx-voice.git
cd wx-voice
npm install
npm run build:silk
```

The library will automatically detect and use the locally compiled binaries at `silk/encoder` and `silk/decoder`.

---

## License

MIT © [binsee](https://github.com/binsee)

Original work MIT © [Ang YC](https://angyc.com)

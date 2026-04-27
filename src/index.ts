import { EventEmitter } from 'events';
import { spawn, execFile } from 'child_process';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as dataUri from 'strong-data-uri';
import * as readChunk from 'read-chunk';
import randomatic = require('randomatic');

const ffmpegPath  = require('@ffmpeg-installer/ffmpeg').path as string;
const ffprobePath = require('@ffprobe-installer/ffprobe').path as string;

export interface ConvertOptions {
    format?: string;
    bitrate?: number;
    frequency?: number;
    channels?: number;
}

interface FileTypeResult {
    ext: string;
    mime: string;
}

export class WxVoice extends EventEmitter {

    private _tempDir: string;

    constructor(tempDir: string = os.tmpdir()) {
        super();
        this._tempDir = path.resolve(tempDir);
        this._checkDependencies();
    }

    decode(input: string, output: string, options: ConvertOptions = {}): Promise<string> {
        return new Promise((resolve, reject) => {
            input  = path.resolve(input);
            output = path.resolve(output);

            if (options.format === undefined) {
                const ext = path.extname(output).replace(/^\./, '');
                options.format = ext;
            }

            let buffer: Buffer;
            let fileFormat: FileTypeResult | null;
            try {
                buffer     = readChunk.sync(input, 0, 4100);
                fileFormat = fileType(buffer);
            } catch (e) {
                this.emit('error', e);
                return reject(e);
            }

            if (fileFormat && fileFormat.mime === 'audio/silk') {
                const outputPCM     = options.format === 'pcm';
                const silkFrequency = (outputPCM && options.frequency) ? options.frequency : 24000;

                this._decodeSilk(input, silkFrequency, (tempFile) => {
                    const src = tempFile || input;
                    if (outputPCM && tempFile) {
                        copyFile(tempFile, output, (err) => {
                            this._deleteTempFile(tempFile);
                            err ? reject(err) : resolve(output);
                        });
                    } else {
                        this._convert(tempFile != null, false, src, output, options, (res) => {
                            this._deleteTempFile(tempFile);
                            res ? resolve(res) : reject(new Error('decode failed'));
                        });
                    }
                });
            } else {
                this._tryWebM(input, (tempFile) => {
                    const src = tempFile || input;
                    this._convert(false, false, src, output, options, (res) => {
                        this._deleteTempFile(tempFile);
                        res ? resolve(res) : reject(new Error('decode failed'));
                    });
                });
            }
        });
    }

    encode(input: string, output: string, options: ConvertOptions = {}): Promise<string> {
        return new Promise((resolve, reject) => {
            input  = path.resolve(input);
            output = path.resolve(output);

            if (options.format === undefined) {
                const ext = path.extname(output).replace(/^\./, '');
                options.format = ext;
            }

            if (!fs.existsSync(input)) {
                const err = new Error(`ENOENT: no such file or directory, open '${input}'`);
                this.emit('error', err);
                return reject(err);
            }

            if (options.format === 'silk' || options.format === 'silk_amr') {
                const tempFile = this._getTempFile(input + '.pcm');
                this._convert(false, true, input, tempFile, options, (tempOutput) => {
                    if (!tempOutput) return reject(new Error('encode failed'));
                    this._encodeSilk(tempOutput, output, options.format!, (res) => {
                        this._deleteTempFile(tempOutput);
                        res ? resolve(res) : reject(new Error('encode failed'));
                    });
                });
            } else if (options.format === 'webm') {
                const tempFile = this._getTempFile(input + '.temp.webm');
                this._convert(false, true, input, tempFile, options, (tempOutput) => {
                    if (!tempOutput) return reject(new Error('encode failed'));
                    this._encodeWebM(tempOutput, output, (res) => {
                        this._deleteTempFile(tempOutput);
                        res ? resolve(res) : reject(new Error('encode failed'));
                    });
                });
            } else {
                const err = new Error(`${options.format} is not a valid encode format, only silk, silk_amr and webm allowed`);
                this.emit('error', err);
                reject(err);
            }
        });
    }

    duration(filePath: string): Promise<number> {
        return new Promise((resolve) => {
            let buf: Buffer;
            try {
                buf = readChunk.sync(filePath, 0, 4100);
            } catch (e) {
                return resolve(0);
            }

            const fmt = fileType(buf);
            if (fmt && fmt.mime === 'audio/silk') {
                return this._parseSilkDuration(filePath, resolve);
            }

            const args = ['-v', 'quiet', '-print_format', 'json', '-show_format', filePath];
            execFile(ffprobePath, args, (err, stdout) => {
                if (err) return resolve(0);
                let duration = 0;
                try {
                    const meta = JSON.parse(stdout);
                    if (meta?.format?.duration) {
                        duration = parseFloat(meta.format.duration);
                        if (isNaN(duration)) duration = 0;
                    }
                } catch { }
                resolve(duration);
            });
        });
    }

    private _convert(
        rawInput: boolean, rawOutput: boolean,
        input: string, output: string,
        options: ConvertOptions,
        callback: (output?: string) => void
    ): void {
        let format      = options.format!;
        const bitrate   = options.bitrate;
        const frequency = options.frequency;
        const channels  = options.channels;

        const inputArgs:  string[] = [];
        const outputArgs: string[] = [];

        if (rawInput) {
            inputArgs.push('-f', 's16le', '-ar', '24000', '-ac', '1');
        } else if (rawOutput) {
            if (format === 'silk' || format === 'silk_amr') {
                format = 's16le';
                outputArgs.push('-ar', '24000', '-ac', '1');
            } else if (format === 'webm') {
                outputArgs.push('-ar', '48000', '-ac', '1', '-acodec', 'opus');
            }
        }

        if (bitrate)   { outputArgs.push('-ab', bitrate + 'k'); }
        if (frequency) { outputArgs.push('-ar', String(frequency)); }
        if (channels)  { outputArgs.push('-ac', String(channels)); }

        if (format === 'm4a') {
            outputArgs.push('-acodec', 'aac', '-f', 'mp4');
        } else if (format === 'pcm') {
            outputArgs.push('-f', 's16le');
        } else {
            outputArgs.push('-f', format);
        }

        const args = inputArgs.concat(['-i', input], outputArgs, ['-vn', output, '-y']);
        execFile(ffmpegPath, args, (err) => {
            err ? callback() : callback(output);
        });
    }

    private _decodeSilk(input: string, frequency: number, callback: (tempFile?: string) => void): void {
        const output  = this._getTempFile(input + '.pcm');
        const decoder = spawn(this._getSilkSDK('decoder'), [input, output, '-Fs_API', String(frequency)]);
        decoder.stdout.on('data', () => {});
        decoder.stderr.on('data', () => {});
        decoder.on('close', (code) => {
            code !== 0 ? callback() : callback(output);
        });
    }

    private _encodeSilk(input: string, output: string, type: string, callback: (output?: string) => void): void {
        const flag    = type === 'silk_amr' ? '-tencent_amr' : '-tencent';
        const encoder = spawn(this._getSilkSDK('encoder'), [input, output, flag]);
        encoder.stdout.on('data', () => {});
        encoder.stderr.on('data', () => {});
        encoder.on('close', (code) => {
            code !== 0 ? callback() : callback(output);
        });
    }

    private _tryWebM(input: string, callback: (tempFile?: string) => void): void {
        const output = this._getTempFile(input + '.webm');
        fs.readFile(input, (err, data) => {
            if (err) return callback();
            const base64 = data.toString();
            if (base64.startsWith('data:audio/webm;base64,')) {
                this._parseWebM(base64, output, callback);
            } else {
                callback();
            }
        });
    }

    private _parseWebM(base64: string, output: string, callback: (tempFile?: string) => void): void {
        let buffer: Buffer;
        try {
            buffer = dataUri.decode(base64);
        } catch {
            return callback();
        }
        fs.writeFile(output, buffer, (err) => {
            err ? callback() : callback(output);
        });
    }

    private _encodeWebM(input: string, output: string, callback: (output?: string) => void): void {
        fs.readFile(input, (err, data) => {
            if (err) return callback();
            const uri = dataUri.encode(data, 'audio/webm');
            fs.writeFile(output, uri, (err) => {
                err ? callback() : callback(output);
            });
        });
    }

    private _checkDependencies(): void {
        const silkDecoder = this._getSilkSDK('decoder');
        const silkEncoder = this._getSilkSDK('encoder');
        if (!fs.existsSync(silkDecoder) || !fs.existsSync(silkEncoder)) {
            throw new Error('Silk SDK not found, make sure you compiled using command: wx-voice compile');
        }
    }

    private _getSilkSDK(type: string): string {
        return path.resolve(__dirname, '..', 'silk', type);
    }

    private _getTempFile(fileName: string, noPrefix = false): string {
        let file = path.basename(fileName);
        if (!noPrefix) file = randomatic('a0', 16) + '_' + file;
        return path.resolve(this._tempDir, file);
    }

    private _deleteTempFile(fileName?: string): void {
        if (fileName) {
            const f = this._getTempFile(fileName, true);
            fs.unlink(f, () => {});
        }
    }

    private _parseSilkDuration(filePath: string, callback: (duration: number) => void): void {
        const headerBuf = Buffer.alloc(16);
        fs.open(filePath, 'r', (err, fd) => {
            if (err) return callback(0);
            fs.read(fd, headerBuf, 0, 16, 0, (err, bytesRead) => {
                if (err || bytesRead < 1) {
                    fs.close(fd, () => {});
                    return callback(0);
                }
                const b = headerBuf;
                let headerLen: number;
                if (b[0] === 0x23 && b[1] === 0x21 && b[2] === 0x41 && b[3] === 0x4D && b[4] === 0x52) {
                    headerLen = 16;
                } else if (b[0] === 0x02) {
                    headerLen = 10;
                } else if (b[0] === 0x23 && b[1] === 0x21 && b[2] === 0x53 && b[3] === 0x49 && b[4] === 0x4C && b[5] === 0x4B && b[6] === 0x5F) {
                    headerLen = 9;
                } else {
                    headerLen = 7;
                }

                const frameBuf = Buffer.alloc(2);
                let frameCount = 0;
                let offset     = headerLen;

                const readNextFrame = (): void => {
                    fs.read(fd, frameBuf, 0, 2, offset, (err, bytesRead) => {
                        if (err || bytesRead < 2) {
                            fs.close(fd, () => {});
                            return callback(frameCount * 0.02);
                        }
                        const frameLen = frameBuf.readInt16LE(0);
                        if (frameLen === -1 || frameLen < 0) {
                            fs.close(fd, () => {});
                            return callback(frameCount * 0.02);
                        }
                        offset += 2 + frameLen;
                        frameCount++;
                        readNextFrame();
                    });
                };

                readNextFrame();
            });
        });
    }
}

function fileType(input: Buffer): FileTypeResult | null {
    const buf = new Uint8Array(input);
    if (!buf || buf.length <= 1) return null;

    const check = (header: number[]): boolean =>
        header.every((b, i) => b === buf[i]);

    if (check([0x23, 0x21, 0x53, 0x49, 0x4C, 0x4B, 0x0A]) ||
        check([0x23, 0x21, 0x53, 0x49, 0x4C, 0x4B, 0x5F, 0x56, 0x33]) ||
        check([0x02, 0x23, 0x21, 0x53, 0x49, 0x4C, 0x4B, 0x5F, 0x56, 0x33]) ||
        check([0x23, 0x21, 0x41, 0x4D, 0x52, 0x0A, 0x02, 0x23, 0x21, 0x53, 0x49, 0x4C, 0x4B, 0x5F, 0x56, 0x33])) {
        return { ext: 'sil', mime: 'audio/silk' };
    }
    return null;
}

function copyFile(source: string, target: string, callback: (err?: Error) => void): void {
    let completed = false;
    const rd = fs.createReadStream(source);
    const wr = fs.createWriteStream(target);
    const done = (err?: Error): void => {
        if (!completed) { completed = true; callback(err); }
    };
    rd.on('error', done);
    wr.on('error', done);
    wr.on('close', () => done());
    rd.pipe(wr);
}

export default WxVoice;

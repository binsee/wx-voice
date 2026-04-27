/*
    [wx-voice]
    Convert audio files between Tencent apps (Weixin / Wechat, QQ) and Silk codec with other general format such as MP3 and M4A

    Github: https://github.com/Ang-YC/wx-voice
    Author: AngYC <me@angyc.com>
*/

'use strict';

const EventEmitter = require('events');
const { spawn, execFile } = require('child_process');

const os = require('os');
const fs = require('fs');
const path = require('path');
const dataUri = require('strong-data-uri');
const readChunk = require('read-chunk');
const randomatic = require('randomatic');

const ffmpegPath  = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;



class WxVoice extends EventEmitter {

    constructor(tempDir = os.tmpdir()) {
        super();
        this._tempDir = path.resolve(tempDir);
        this._checkDependencies();
    }


    decode(input, output, options, callback) {
        var ext, buffer,
            fileFormat;

        // Make it into absolute path
        input  = path.resolve(input);
        output = path.resolve(output);

        // Set options default to {}
        if (options === undefined) {
            options = {};
        }

        // Set format as extension if undefined
        if (options.format === undefined) {
            ext = path.extname(output);

            if (ext[0] == ".")
                ext = ext.substr(1);

            options.format = ext;
        }

        // Callback after decode is done
        callback = validateFunction(callback);

        // Check if file exists and get file format
        try {
            buffer     = readChunk.sync(input, 0, 4100);
            fileFormat = fileType(buffer);
        } catch (e) {
            this.emit("error", e);
            return callback();
        }


        // Check if file is silk, webm or others
        if (fileFormat && fileFormat.mime == "audio/silk") {

            // Default frequency
            var outputPCM     = (options.format == "pcm"),
                silkFrequency = (outputPCM && options.frequency) ? options.frequency : 24000;

            // Use Silk if it can be decoded
            this._decodeSilk(input, silkFrequency, (tempFile) => {
                input = tempFile || input;
                
                // Output raw PCM directly
                if (outputPCM && tempFile) {
                    copy(tempFile, output, (err) => {
                        this._deleteTempFile(tempFile);
                        callback(err ? undefined : output);
                    });
                
                // Else Continue for other formats
                } else {
                    this._convert(tempFile != undefined, false, input, output, options, (res) => {
                        this._deleteTempFile(tempFile);
                        callback(res);
                    });
                }
            });

        } else {

            // Use WebM output if it is WebM
            this._tryWebM(input, (tempFile) => {
                input = tempFile || input;
                this._convert(false, false, input, output, options, (res) => {
                    this._deleteTempFile(tempFile);
                    callback(res);
                });
            });

        }
    }


    encode(input, output, options, callback) {
        var ext, tempFile;

        // Make it into absolute path
        input  = path.resolve(input);
        output = path.resolve(output);

        // Set options default to {}
        if (options === undefined) {
            options = {};
        }

        // Set format as extension if undefined
        if (options.format === undefined) {
            ext = path.extname(output);

            if (ext[0] == ".")
                ext = ext.substr(1);

            options.format = ext;
        }

        // Callback after encode is done
        callback = validateFunction(callback);

        // Check if file exists
        if (!fs.existsSync(input)) {
            this.emit("error", "Error: ENOENT: no such file or directory, open '" + input + "'");
            return callback();
        }


        if (options.format == "silk" || options.format == "silk_amr") {

            tempFile = this._getTempFile(input + ".pcm");
            this._convert(false, true, input, tempFile, options, (tempOutput) => {
                if (tempOutput) {
                    this._encodeSilk(tempOutput, output, options.format, (res) => {
                        this._deleteTempFile(tempOutput);
                        callback(res);
                    });
                } else {
                    callback();
                }
            });

        } else if (options.format == "webm") {

            tempFile = this._getTempFile(input + ".temp.webm");

            this._convert(false, true, input, tempFile, options, (tempOutput) => {
                if (tempOutput) {
                    this._encodeWebM(tempOutput, output, (res) => {
                        this._deleteTempFile(tempOutput);
                        callback(res);
                    });
                } else {
                    callback();
                }
            });

        } else {
            this.emit("error", new Error(options.format + " is not a valid encode format, only silk, silk_amr and webm allowed"));
            return callback();
        }
    }


    duration(filePath, callback) {
        callback = validateFunction(callback);

        // Try to detect silk format first
        var buf;
        try {
            buf = readChunk.sync(filePath, 0, 4100);
        } catch (e) {
            return callback(0);
        }

        var fmt = fileType(buf);
        if (fmt && fmt.mime === 'audio/silk') {
            return callback(this._parseSilkDuration(filePath));
        }

        // Fallback to ffprobe for other formats
        var args = ["-v", "quiet", "-print_format", "json", "-show_format", filePath];
        execFile(ffprobePath, args, (err, stdout) => {
            if (err) return callback(0);

            var duration = 0;
            try {
                var meta = JSON.parse(stdout);
                if (meta && meta.format && meta.format.duration) {
                    duration = parseFloat(meta.format.duration);
                    duration = isNaN(duration) ? 0 : duration;
                }
            } catch (e) { }

            callback(duration);
        });
    }


    _convert(rawInput, rawOutput, input, output, options, callback) {
        var format    = options.format,
            bitrate   = options.bitrate,
            frequency = options.frequency,
            channels  = options.channels;

        var inputArgs  = [];
        var outputArgs = [];

        // Additional parameters for raw input/output
        if (rawInput) {
            inputArgs = ["-f", "s16le", "-ar", "24000", "-ac", "1"];
        } else if (rawOutput) {
            if (format == "silk" || format == "silk_amr") {
                format = "s16le";
                outputArgs.push("-ar", "24000", "-ac", "1");
            } else if (format == "webm") {
                outputArgs.push("-ar", "48000", "-ac", "1", "-acodec", "opus");
            }
        }

        // Other settings
        if (bitrate)   { outputArgs.push("-ab", bitrate + "k"); }
        if (frequency) { outputArgs.push("-ar", String(frequency)); }
        if (channels)  { outputArgs.push("-ac", String(channels)); }

        // Format dependent
        if (format == "m4a") {
            outputArgs.push("-acodec", "aac", "-f", "mp4");
        } else if (format == "pcm") {
            outputArgs.push("-f", "s16le");
        } else {
            outputArgs.push("-f", format);
        }

        // Build full args: [inputArgs...] -i input [outputArgs...] -vn output -y
        var args = inputArgs.concat(["-i", input], outputArgs, ["-vn", output, "-y"]);

        execFile(ffmpegPath, args, (err) => {
            if (err) return callback();
            callback(output);
        });
    }


    _decodeSilk(input, frequency, callback) {
        var output  = this._getTempFile(input + ".pcm"),
            decoder = spawn(this._getSilkSDK("decoder"), [input, output, "-Fs_API", frequency]);

        // Allow it to output
        decoder.stdout.on('data', (data) => { });
        decoder.stderr.on('data', (data) => { });

        decoder.on('close', (code) => {
            if (code == 1) { // Error occured
                callback();
            } else {         // Success
                callback(output);
            }
        });
    }


    _encodeSilk(input, output, type, callback) {
        var flag    = (type == "silk_amr" ? "-tencent_amr" : "-tencent"),
            encoder = spawn(this._getSilkSDK("encoder"), [input, output, flag]);

        // Allow it to output
        encoder.stdout.on('data', (data) => { });
        encoder.stderr.on('data', (data) => { });

        encoder.on('close', (code) => {
            if (code == 1) { // Error occured
                callback();
            } else {         // Success
                callback(output);
            }
        });
    }


    _tryWebM(input, callback) {
        var output = this._getTempFile(input + ".webm"),
            base64 = "";

        fs.readFile(input, (err, data) => {
            if (err) return callback();

            // Convert to string and check if Data URI is WebM
            base64 = data.toString();
            if (base64.startsWith("data:audio/webm;base64,")) {
                this._parseWebM(base64, output, callback);
            } else {
                callback();
            }
        });
    }


    _parseWebM(base64, output, callback) {
        var buffer;

        // Convert to buffer
        try {
            buffer = dataUri.decode(base64);
        } catch (e) {
            return callback();
        }

        // Write to file
        fs.writeFile(output, buffer, (err) => {
            if (err) return callback();
            callback(output);
        });
    }


    _encodeWebM(input, output, callback) {
        var uri = "";

        fs.readFile(input, (err, data) => {
            if (err) return callback();
            uri = dataUri.encode(data, "audio/webm");

            // Write to file
            fs.writeFile(output, uri, (err) => {
                if (err) return callback();
                callback(output);
            }); 
        });
    }


    _checkDependencies() {
        var silkDecoder = this._getSilkSDK("decoder"),
            silkEncoder = this._getSilkSDK("encoder");

        if (!fs.existsSync(silkDecoder) || !fs.existsSync(silkEncoder)) {
            throw new Error("Silk SDK not found, make sure you compiled using command: wx-voice compile");
        }
    }


    _getSilkSDK(type) {
        return path.resolve(__dirname, "silk", type);
    }


    _getTempFile(fileName, noPrefix) {
        var file = path.basename(fileName);

        if (!noPrefix)
            file = randomatic("a0", 16) + "_" + file;

        return path.resolve(this._tempDir, file);
    }


    _deleteTempFile(fileName) {
        if (fileName) {
            fileName = this._getTempFile(fileName, true);
            fs.unlink(fileName, () => {});
        }
    }


    _parseSilkDuration(filePath) {
        var buf, offset, headerLen, frameLen, frameCount;

        try {
            buf = fs.readFileSync(filePath);
        } catch (e) {
            return 0;
        }

        // Detect header length
        var b = buf;
        if (b[0] === 0x23 && b[1] === 0x21 && b[2] === 0x41 && b[3] === 0x4D && b[4] === 0x52) {
            headerLen = 16; // #!AMR\n.#!SILK_V3
        } else if (b[0] === 0x02) {
            headerLen = 10; // \x02#!SILK_V3
        } else if (b[0] === 0x23 && b[1] === 0x21 && b[2] === 0x53 && b[3] === 0x49 && b[4] === 0x4C && b[5] === 0x4B && b[6] === 0x5F) {
            headerLen = 9;  // #!SILK_V3
        } else {
            headerLen = 7;  // #!SILK\n
        }

        offset = headerLen;
        frameCount = 0;

        while (offset + 2 <= buf.length) {
            frameLen = buf.readInt16LE(offset);
            offset += 2;

            if (frameLen === -1) break; // end of stream

            if (frameLen < 0 || offset + frameLen > buf.length) break; // corrupt

            offset += frameLen;
            frameCount++;
        }

        return frameCount * 0.02;
    }
}



// Utililities

function fileType(input) {
    const buf = new Uint8Array(input);

    if (!(buf && buf.length > 1)) {
        return null;
    }

    const check = (header) => {
        for (let i = 0; i < header.length; i++) {
            if (header[i] !== buf[i]) {
                return false;
            }
        }

        return true;
    };

    if (check([0x23, 0x21, 0x53, 0x49, 0x4C, 0x4B, 0x0A]) ||                   // Skype V1: #!SILK\n  (https://tools.ietf.org/html/draft-spittka-silk-payload-format-00)
        check([0x23, 0x21, 0x53, 0x49, 0x4C, 0x4B, 0x5F, 0x56, 0x33]) ||       // Skype V3: #!SILK_V3
        check([0x02, 0x23, 0x21, 0x53, 0x49, 0x4C, 0x4B, 0x5F, 0x56, 0x33]) || // Tencent variation: .#!SILK_V3
        check([0x23, 0x21, 0x41, 0x4D, 0x52, 0x0A, 0x02, 0x23, 0x21, 0x53, 0x49, 0x4C, 0x4B, 0x5F, 0x56, 0x33])) { // Tencent AMR variation: #!AMR\n.#!SILK_V3

        return {
            ext: 'sil',
            mime: 'audio/silk'
        };
    }

    return null;
}

function isFunction(f) {
    return (f && typeof f === 'function');
}

function validateFunction(f) {
    return (isFunction(f) ? f : function() { });
}

function copy(source, target, callback) {
    var completed = false;

    var rd = fs.createReadStream(source);
    var wr = fs.createWriteStream(target);

    rd.on("error", done);
    wr.on("error", done);
    wr.on("close", (ex) => { done(); });
    rd.pipe(wr);

    function done(err) {
        if (!completed) {
            completed = true;
            callback(err);
        }
    }
}



module.exports = WxVoice;
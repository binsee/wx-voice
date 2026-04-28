#!/usr/bin/env node

import * as path from 'path';
import cmdArgs = require('command-line-args');
import { Spinner } from 'cli-spinner';
import { WxVoice, ConvertOptions } from './index';

const args = cmdArgs([
    { name: 'command', defaultOption: true, type: String },
    { name: 'input',   alias: 'i', type: String },
    { name: 'output',  alias: 'o', type: String },
    { name: 'format',  alias: 'f', type: String },
    { name: 'bitrate',   type: Number },
    { name: 'frequency', type: Number },
    { name: 'channels',  type: Number }
]) as Record<string, any>;

const cmdName  = '[wx-voice]  ';
const cmdError = '\x1b[41m\x1b[37mERROR\x1b[0m  ';

switch (args.command) {
    case 'decode':
    case 'encode':
        convert(args.command, args);
        break;

    case 'duration':
        getDuration(args);
        break;

    default:
        help();
}

async function getDuration(args: Record<string, any>): Promise<void> {
    if (!args.input) return help();

    const wxVoice = new WxVoice();
    wxVoice.on('error', (err) => console.log(cmdName + cmdError + err));

    try {
        const seconds = await wxVoice.duration(args.input);
        console.log(cmdName + 'duration: ' + seconds.toFixed(3) + 's');
    } catch {
        console.log(cmdName + cmdError + 'duration failed');
    }
}

async function convert(type: string, args: Record<string, any>): Promise<void> {
    if (!args.input || !args.output) return help();

    const options: ConvertOptions = {};
    (['format', 'bitrate', 'frequency', 'channels'] as const).forEach((key) => {
        if (args[key] !== undefined) (options as any)[key] = args[key];
    });

    const wxVoice = new WxVoice();
    wxVoice.on('error', (err) => console.log(cmdName + cmdError + err));

    const spinner = loading(type);
    spinner.start();

    try {
        await (wxVoice as any)[type](args.input, args.output, options);
        setTimeout(() => {
            spinner.stop();
            console.log();
            console.log(cmdName + type + ' success');
        }, 100);
    } catch {
        setTimeout(() => {
            spinner.stop();
            console.log();
            console.log(cmdName + cmdError + type + ' not successful, file not supported');
        }, 100);
    }
}


function loading(type: string): Spinner {
    const spinner = new Spinner(cmdName + '%s Running command: ' + type);
    spinner.setSpinnerString('⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏');
    return spinner;
}

function help(): void {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const version = require('../package.json').version as string;
    console.log(`| wxVoice by binsee | v${version} |`);
    console.log('Usage: wx-voice <command> <options>\n');
    console.log('Command:');
    console.log('  decode    decode to general audio format');
    console.log('  encode    encode from general audio format');
    console.log('  duration  get duration of audio file\n');
    console.log('Options:');
    console.log('  -i <input>    input file path');
    console.log('  -o <output>   output file path');
    console.log('  -f <format>   format of the output file');
    console.log('  --bitrate     bitrate of the output file');
    console.log('  --frequency   frequency of the output file');
    console.log('  --channels    channels of the output file\n');
    console.log('Tested format:');
    console.log('  decode   mp3, m4a, wav, pcm');
    console.log('  encode   silk, silk_amr, webm');
}

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { WxVoice } from '../src/index';

const CHUNK_SIZE = 256 * 1024; // 262144
const MAX_INT16  = 32767;

function makeSilkFile(headerBytes: number[], frameLens: number[], withEndMarker = true): string {
    const parts: Buffer[] = [Buffer.from(headerBytes)];
    for (const len of frameLens) {
        const hdr = Buffer.alloc(2);
        hdr.writeInt16LE(len, 0);
        parts.push(hdr, Buffer.alloc(len));
    }
    if (withEndMarker) {
        const end = Buffer.alloc(2);
        end.writeInt16LE(-1, 0);
        parts.push(end);
    }
    const buf  = Buffer.concat(parts);
    const file = path.join(os.tmpdir(), `wx_test_${process.hrtime.bigint()}.silk`);
    fs.writeFileSync(file, buf);
    return file;
}

// Build a frame sequence that fills exactly `targetBytes` bytes (sum of len+2 per frame)
// using frames no larger than MAX_INT16.
function framesForBytes(targetBytes: number): number[] {
    const frames: number[] = [];
    let remaining = targetBytes;
    while (remaining >= 2) {
        const body = Math.min(remaining - 2, MAX_INT16);
        frames.push(body);
        remaining -= body + 2;
    }
    return frames;
}

const TENCENT_HEADER  = [0x02, 0x23, 0x21, 0x53, 0x49, 0x4C, 0x4B, 0x5F, 0x56, 0x33]; // headerLen=10
const SKYPE_V3_HEADER = [0x23, 0x21, 0x53, 0x49, 0x4C, 0x4B, 0x5F, 0x56, 0x33];        // headerLen=9
const SKYPE_V1_HEADER = [0x23, 0x21, 0x53, 0x49, 0x4C, 0x4B, 0x0A];                    // headerLen=7
const AMR_HEADER      = [0x23, 0x21, 0x41, 0x4D, 0x52, 0x0A, 0x02, 0x23, 0x21, 0x53, 0x49, 0x4C, 0x4B, 0x5F, 0x56, 0x33]; // headerLen=16

let wxVoice: WxVoice;
const tmpFiles: string[] = [];

function silk(header: number[], frameLens: number[], withEndMarker = true): string {
    const f = makeSilkFile(header, frameLens, withEndMarker);
    tmpFiles.push(f);
    return f;
}

beforeAll(() => { wxVoice = new WxVoice(os.tmpdir()); });
afterAll(() => { tmpFiles.forEach(f => { try { fs.unlinkSync(f); } catch {} }); });

function parseDuration(filePath: string): number {
    return (wxVoice as any)._parseSilkDuration(filePath);
}

// ─── Header detection ────────────────────────────────────────────────────────

describe('header detection', () => {
    test('Tencent \\x02#!SILK_V3 (headerLen=10)', () => {
        expect(parseDuration(silk(TENCENT_HEADER, [100, 100, 100]))).toBeCloseTo(0.06);
    });
    test('Skype #!SILK_V3 (headerLen=9)', () => {
        expect(parseDuration(silk(SKYPE_V3_HEADER, [100, 100]))).toBeCloseTo(0.04);
    });
    test('Skype #!SILK\\n (headerLen=7)', () => {
        expect(parseDuration(silk(SKYPE_V1_HEADER, [100]))).toBeCloseTo(0.02);
    });
    test('Tencent AMR (headerLen=16)', () => {
        expect(parseDuration(silk(AMR_HEADER, [100, 100, 100, 100, 100]))).toBeCloseTo(0.10);
    });
});

// ─── Frame counting ──────────────────────────────────────────────────────────

describe('frame counting', () => {
    test('0 frames → 0s', () => {
        expect(parseDuration(silk(TENCENT_HEADER, []))).toBe(0);
    });
    test('1 frame → 0.02s', () => {
        expect(parseDuration(silk(TENCENT_HEADER, [50]))).toBeCloseTo(0.02);
    });
    test('151 frames → 3.02s', () => {
        expect(parseDuration(silk(TENCENT_HEADER, Array(151).fill(60)))).toBeCloseTo(3.02);
    });
    test('no end marker — counts frames until EOF', () => {
        expect(parseDuration(silk(TENCENT_HEADER, [100, 100, 100], false))).toBeCloseTo(0.06);
    });
});

// ─── Corrupt / edge cases ────────────────────────────────────────────────────

describe('corrupt / edge cases', () => {
    test('non-existent file → 0', () => {
        expect(parseDuration('/tmp/does_not_exist_wx_test.silk')).toBe(0);
    });
    test('empty file → 0', () => {
        const f = path.join(os.tmpdir(), `wx_empty_${process.hrtime.bigint()}.silk`);
        fs.writeFileSync(f, Buffer.alloc(0));
        tmpFiles.push(f);
        expect(parseDuration(f)).toBe(0);
    });
    test('file with only 1 byte → 0', () => {
        const f = path.join(os.tmpdir(), `wx_tiny_${process.hrtime.bigint()}.silk`);
        fs.writeFileSync(f, Buffer.from([0x02]));
        tmpFiles.push(f);
        expect(parseDuration(f)).toBe(0);
    });
    test('corrupt frame (frameLen points past EOF) → stops counting', () => {
        const header = Buffer.from(TENCENT_HEADER);
        const f1hdr = Buffer.alloc(2); f1hdr.writeInt16LE(50, 0);
        const f2hdr = Buffer.alloc(2); f2hdr.writeInt16LE(50, 0);
        const badHdr = Buffer.alloc(2); badHdr.writeInt16LE(9999, 0);
        const buf = Buffer.concat([header, f1hdr, Buffer.alloc(50), f2hdr, Buffer.alloc(50), badHdr]);
        const f = path.join(os.tmpdir(), `wx_corrupt_${process.hrtime.bigint()}.silk`);
        fs.writeFileSync(f, buf);
        tmpFiles.push(f);
        expect(parseDuration(f)).toBeCloseTo(0.04);
    });
    test('negative frameLen (not -1) → stops counting', () => {
        const header = Buffer.from(TENCENT_HEADER);
        const f1hdr = Buffer.alloc(2); f1hdr.writeInt16LE(50, 0);
        const badHdr = Buffer.alloc(2); badHdr.writeInt16LE(-2, 0);
        const buf = Buffer.concat([header, f1hdr, Buffer.alloc(50), badHdr]);
        const f = path.join(os.tmpdir(), `wx_neg_${process.hrtime.bigint()}.silk`);
        fs.writeFileSync(f, buf);
        tmpFiles.push(f);
        expect(parseDuration(f)).toBeCloseTo(0.02);
    });
});

// ─── Chunk boundary ──────────────────────────────────────────────────────────

describe('chunk boundary (CHUNK_SIZE = 262144)', () => {
    // TENCENT_HEADER = 10 bytes
    // Frame bytes needed to place next frame header at a specific file offset:
    //   frameBytes = targetOffset - headerLen
    // Each frame occupies: 2 (len) + body bytes

    test('frame header straddles chunk boundary (1st byte at CHUNK_SIZE-1, 2nd at CHUNK_SIZE)', () => {
        // Next frame header starts at file offset 262143 (= CHUNK_SIZE - 1)
        // Frames must fill exactly 262143 - 10 = 262133 bytes
        const fillFrames = framesForBytes(262133);
        const totalFillFrames = fillFrames.length;
        const trailingFrames = [60, 60, 60];
        const f = silk(TENCENT_HEADER, [...fillFrames, ...trailingFrames]);
        expect(parseDuration(f)).toBeCloseTo((totalFillFrames + trailingFrames.length) * 0.02, 5);
    });

    test('frame header starts at exact chunk boundary (offset = CHUNK_SIZE)', () => {
        // Next frame header starts at file offset 262144 (= CHUNK_SIZE)
        // Frames must fill exactly 262144 - 10 = 262134 bytes
        const fillFrames = framesForBytes(262134);
        const totalFillFrames = fillFrames.length;
        const trailingFrames = [60, 60];
        const f = silk(TENCENT_HEADER, [...fillFrames, ...trailingFrames]);
        expect(parseDuration(f)).toBeCloseTo((totalFillFrames + trailingFrames.length) * 0.02, 5);
    });

    test('file spanning 3 chunks counts all frames correctly', () => {
        const frameLen   = 1000;
        const frameCount = Math.ceil((2 * CHUNK_SIZE) / (frameLen + 2)) + 5;
        const f = silk(TENCENT_HEADER, Array(frameCount).fill(frameLen));
        expect(parseDuration(f)).toBeCloseTo(frameCount * 0.02, 5);
    });
});

// ─── duration() public API ───────────────────────────────────────────────────

describe('duration() public API', () => {
    test('silk file resolves with correct duration', async () => {
        const f = silk(TENCENT_HEADER, Array(151).fill(60));
        await expect(wxVoice.duration(f)).resolves.toBeCloseTo(3.02);
    });
    test('non-existent file resolves with 0', async () => {
        await expect(wxVoice.duration('/tmp/no_such_file_wx.mp3')).resolves.toBe(0);
    });
});

declare module 'read-chunk' {
    const readChunk: {
        sync(filePath: string, startPosition: number, length: number): Buffer;
    };
    export = readChunk;
}

declare module 'strong-data-uri' {
    const dataUri: {
        encode(buffer: Buffer, mimeType: string): string;
        decode(dataUri: string): Buffer;
    };
    export = dataUri;
}

declare module 'cli-spinner' {
    export class Spinner {
        constructor(text: string);
        setSpinnerString(str: string): void;
        start(): void;
        stop(): void;
    }
}

declare module '@ffmpeg-installer/ffmpeg' {
    const installer: { path: string; version: string };
    export = installer;
}

declare module '@ffprobe-installer/ffprobe' {
    const installer: { path: string; version: string };
    export = installer;
}

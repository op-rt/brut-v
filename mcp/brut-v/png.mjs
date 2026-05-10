import { deflateSync } from "node:zlib";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC_TABLE = makeCrcTable();

export function encodePngRgba(rgba, width, height) {
    const stride = width * 4;
    const raw = Buffer.alloc((stride + 1) * height);

    for (let y = 0; y < height; y++) {
        const srcStart = y * stride;
        const dstStart = y * (stride + 1);
        raw[dstStart] = 0;
        Buffer.from(rgba.buffer, rgba.byteOffset + srcStart, stride)
            .copy(raw, dstStart + 1);
    }

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    return Buffer.concat([
        PNG_SIGNATURE,
        chunk("IHDR", ihdr),
        chunk("IDAT", deflateSync(raw, { level: 9 })),
        chunk("IEND", Buffer.alloc(0)),
    ]);
}

function chunk(type, data) {
    const typeBuffer = Buffer.from(type, "ascii");
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    typeBuffer.copy(out, 4);
    data.copy(out, 8);

    const crcInput = Buffer.concat([typeBuffer, data]);
    out.writeUInt32BE(crc32(crcInput), 8 + data.length);
    return out;
}

function crc32(buffer) {
    let crc = 0xffffffff;
    for (const byte of buffer)
        crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}

function makeCrcTable() {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++)
            c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        table[n] = c >>> 0;
    }
    return table;
}

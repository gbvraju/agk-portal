// Builds small zip archives for the tests of the facts reader. Test support only: the core reads archives, it never makes one.
import { deflateRawSync } from "node:zlib";

const TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface Entry {
  name: string;
  data: Uint8Array | string;
  method?: number;
  flags?: number;
  crc?: number;
  declaredSize?: number;
  // The stored bytes, when they must differ from what `method` would produce (a bomb, a truncated stream).
  raw?: Uint8Array;
}

const text = (s: string): Uint8Array => new TextEncoder().encode(s);

export function zip(entries: Entry[], options: { commentLength?: number; omitEnd?: boolean } = {}): Uint8Array {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const data = typeof entry.data === "string" ? text(entry.data) : entry.data;
    const method = entry.method ?? 8;
    const stored = entry.raw ?? (method === 8 ? new Uint8Array(deflateRawSync(data)) : data);
    const name = text(entry.name);
    const crc = entry.crc ?? crc32(data);
    const size = entry.declaredSize ?? data.length;
    const flags = entry.flags ?? 0;
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, flags, true);
    lv.setUint16(8, method, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, stored.length, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    const head = new Uint8Array(46 + name.length);
    const cv = new DataView(head.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, flags, true);
    cv.setUint16(10, method, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, stored.length, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    head.set(name, 46);
    central.push(head);
    parts.push(local, stored);
    offset += local.length + stored.length;
  }
  const directory = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22 + (options.commentLength ?? 0));
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, directory, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, options.commentLength ?? 0, true);
  const all = [...parts, ...central, ...(options.omitEnd ? [] : [end])];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of all) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

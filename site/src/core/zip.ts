// A minimal reader for the one archive the facts come in (SPEC-0001 rule 2): a zip holding `facts.json`, and from kit
// 0.39.0 also `report.json` (checked, not read), each stored or deflated. Web-standard APIs only. It trusts nothing in the archive: sizes are capped, the
// output must match the declared size and checksum, and anything it does not understand is refused.
export const MAX_FACTS_BYTES = 1024 * 1024;

const FACTS = "facts.json";
const FILES = [FACTS, "report.json"] as const;
const END_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

const TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function inflate(data: Uint8Array, expected: number): Promise<Uint8Array | undefined> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const reader = stream.getReader();
  const out = new Uint8Array(expected);
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (length + value.length > expected) {
        await reader.cancel();
        return undefined;
      }
      out.set(value, length);
      length += value.length;
    }
  } catch {
    return undefined;
  }
  return length === expected ? out : undefined;
}

// The bytes of `facts.json`, or undefined for anything that is not an archive of `facts.json` alone or of `facts.json`
// and `report.json` in either order. Every entry is checked (not encrypted, stored or deflated, within its size cap,
// size and checksum right); `report.json` is checked and not read. A duplicate, a missing `facts.json` and any other
// entry refuse the whole archive.
export async function readFactsFile(bytes: Uint8Array): Promise<Uint8Array | undefined> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 22 - 0xffff); at -= 1) {
    if (view.getUint32(at, true) === END_SIGNATURE) {
      end = at;
      break;
    }
  }
  if (end < 0) return undefined;
  const entries = view.getUint16(end + 10, true);
  const directoryOffset = view.getUint32(end + 16, true);
  if (entries < 1 || entries > FILES.length || directoryOffset === 0xffffffff) return undefined;
  let at = directoryOffset;
  const seen = new Set<string>();
  let facts: Uint8Array | undefined;
  for (let n = 0; n < entries; n += 1) {
    if (at + 46 > end || view.getUint32(at, true) !== CENTRAL_SIGNATURE) return undefined;
    const flags = view.getUint16(at + 8, true);
    const method = view.getUint16(at + 10, true);
    const crc = view.getUint32(at + 16, true);
    const compressed = view.getUint32(at + 20, true);
    const size = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const localOffset = view.getUint32(at + 42, true);
    const next = at + 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
    if (next > end) return undefined;
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength));
    if (!(FILES as readonly string[]).includes(name) || seen.has(name)) return undefined;
    seen.add(name);
    if ((flags & 1) !== 0 || size > MAX_FACTS_BYTES || (method !== 0 && method !== 8)) return undefined;
    if (localOffset + 30 > bytes.length || view.getUint32(localOffset, true) !== LOCAL_SIGNATURE) return undefined;
    const start = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
    if (start + compressed > bytes.length) return undefined;
    const stored = bytes.subarray(start, start + compressed);
    const content = method === 0 ? (stored.length === size ? stored : undefined) : await inflate(stored, size);
    if (content === undefined || crc32(content) !== crc) return undefined;
    if (name === FACTS) facts = content;
    at = next;
  }
  return at === end ? facts : undefined;
}

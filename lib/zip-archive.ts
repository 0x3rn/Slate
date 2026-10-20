export interface ZipEntry {
  name: string;
  data: string | Uint8Array;
  lastModified?: Date;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toDosDateTime(date: Date): { dosTime: number; dosDate: number } {
  const year = Math.max(1980, date.getFullYear());
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);
  const dosTime = ((hours & 0x1f) << 11) | ((minutes & 0x3f) << 5) | (seconds & 0x1f);
  const dosDate = (((year - 1980) & 0x7f) << 9) | ((month & 0x0f) << 5) | (day & 0x1f);
  return { dosTime, dosDate };
}

export function createZipArchive(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const prepared = entries.map((entry) => {
    const cleanName = entry.name.replace(/^\/+/, "").replace(/\\/g, "/");
    const nameBytes = encoder.encode(cleanName);
    const contentBytes =
      typeof entry.data === "string" ? encoder.encode(entry.data) : entry.data;
    const checksum = crc32(contentBytes);
    const { dosTime, dosDate } = toDosDateTime(entry.lastModified ?? new Date());
    return { nameBytes, contentBytes, checksum, dosTime, dosDate };
  });

  let localTotalSize = 0;
  let centralTotalSize = 0;
  for (const item of prepared) {
    localTotalSize += 30 + item.nameBytes.length + item.contentBytes.length;
    centralTotalSize += 46 + item.nameBytes.length;
  }

  const out = new Uint8Array(localTotalSize + centralTotalSize + 22);
  const view = new DataView(out.buffer);
  let localOffset = 0;
  const fileOffsets: number[] = [];

  for (const item of prepared) {
    fileOffsets.push(localOffset);
    view.setUint32(localOffset, 0x04034b50, true);
    view.setUint16(localOffset + 4, 20, true);
    view.setUint16(localOffset + 6, 0x0800, true);
    view.setUint16(localOffset + 8, 0, true);
    view.setUint16(localOffset + 10, item.dosTime, true);
    view.setUint16(localOffset + 12, item.dosDate, true);
    view.setUint32(localOffset + 14, item.checksum, true);
    view.setUint32(localOffset + 18, item.contentBytes.length, true);
    view.setUint32(localOffset + 22, item.contentBytes.length, true);
    view.setUint16(localOffset + 26, item.nameBytes.length, true);
    view.setUint16(localOffset + 28, 0, true);
    out.set(item.nameBytes, localOffset + 30);
    out.set(item.contentBytes, localOffset + 30 + item.nameBytes.length);
    localOffset += 30 + item.nameBytes.length + item.contentBytes.length;
  }

  let centralOffset = localOffset;
  for (let i = 0; i < prepared.length; i++) {
    const item = prepared[i];
    view.setUint32(centralOffset, 0x02014b50, true);
    view.setUint16(centralOffset + 4, 20, true);
    view.setUint16(centralOffset + 6, 20, true);
    view.setUint16(centralOffset + 8, 0x0800, true);
    view.setUint16(centralOffset + 10, 0, true);
    view.setUint16(centralOffset + 12, item.dosTime, true);
    view.setUint16(centralOffset + 14, item.dosDate, true);
    view.setUint32(centralOffset + 16, item.checksum, true);
    view.setUint32(centralOffset + 20, item.contentBytes.length, true);
    view.setUint32(centralOffset + 24, item.contentBytes.length, true);
    view.setUint16(centralOffset + 28, item.nameBytes.length, true);
    view.setUint16(centralOffset + 30, 0, true);
    view.setUint16(centralOffset + 32, 0, true);
    view.setUint16(centralOffset + 34, 0, true);
    view.setUint16(centralOffset + 36, 0, true);
    view.setUint32(centralOffset + 38, 0, true);
    view.setUint32(centralOffset + 42, fileOffsets[i], true);
    out.set(item.nameBytes, centralOffset + 46);
    centralOffset += 46 + item.nameBytes.length;
  }

  view.setUint32(centralOffset, 0x06054b50, true);
  view.setUint16(centralOffset + 4, 0, true);
  view.setUint16(centralOffset + 6, 0, true);
  view.setUint16(centralOffset + 8, prepared.length, true);
  view.setUint16(centralOffset + 10, prepared.length, true);
  view.setUint32(centralOffset + 12, centralTotalSize, true);
  view.setUint32(centralOffset + 16, localTotalSize, true);
  view.setUint16(centralOffset + 20, 0, true);
  return out;
}

export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof window === "undefined") return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function downloadTextFile(
  content: string,
  filename: string,
  mimeType = "text/plain;charset=utf-8"
): void {
  downloadBlob(new Blob([content], { type: mimeType }), filename);
}

export function downloadZipArchive(entries: ZipEntry[], filename: string): void {
  const bytes = createZipArchive(entries);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: "application/zip" });
  downloadBlob(blob, filename.endsWith(".zip") ? filename : filename + ".zip");
}

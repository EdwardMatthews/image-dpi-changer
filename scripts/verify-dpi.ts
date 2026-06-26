import assert from 'node:assert/strict';

import { convertImageDpi, readImageInfo } from '../src/lib/image-dpi';

function pngFixture() {
  return new Uint8Array([
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 32,
    0, 0, 0, 16, 8, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66,
    96, 130,
  ]);
}

function pngFixtureWithExifDpi(exifDpi: number, physDpi: number) {
  const png = pngFixture();
  return concat(
    png.slice(0, 33),
    pngChunk('eXIf', tiffDpiData(exifDpi)),
    pngPhysChunk(physDpi),
    png.slice(33)
  );
}

function jpegFixture() {
  return new Uint8Array([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x10, 0x00, 0x20, 0x03,
    0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00, 0xff, 0xda, 0x00,
    0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x00, 0xff, 0xd9,
  ]);
}

function jpegFixtureWithJfifAndExif(jfifDpi: number, exifDpi: number) {
  return concat(
    new Uint8Array([0xff, 0xd8]),
    jfifSegment(jfifDpi),
    exifSegment(exifDpi),
    jpegFixture().slice(2)
  );
}

function jpegFixtureWithEveryDpiContainer(originalDpi: number) {
  return concat(
    new Uint8Array([0xff, 0xd8]),
    jfifSegment(originalDpi),
    exifSegment(originalDpi),
    photoshopSegment(originalDpi),
    xmpSegment(originalDpi),
    jpegFixture().slice(2)
  );
}

function jfifSegment(dpi: number) {
  return new Uint8Array([
    0xff,
    0xe0,
    0x00,
    0x10,
    0x4a,
    0x46,
    0x49,
    0x46,
    0x00,
    0x01,
    0x02,
    0x01,
    (dpi >>> 8) & 0xff,
    dpi & 0xff,
    (dpi >>> 8) & 0xff,
    dpi & 0xff,
    0x00,
    0x00,
  ]);
}

function exifSegment(dpi: number) {
  const exif = concat(
    new Uint8Array([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]),
    tiffDpiData(dpi)
  );
  return concat(
    new Uint8Array([
      0xff,
      0xe1,
      ((exif.length + 2) >>> 8) & 0xff,
      (exif.length + 2) & 0xff,
    ]),
    exif
  );
}

function tiffDpiData(dpi: number) {
  const tiff = new Uint8Array(66);
  tiff[0] = 0x4d;
  tiff[1] = 0x4d;
  writeUint16(tiff, 2, 42);
  writeUint32(tiff, 4, 8);
  writeUint16(tiff, 8, 3);
  writeExifEntry(tiff, 10, 0x011a, 5, 1, 50);
  writeExifEntry(tiff, 22, 0x011b, 5, 1, 58);
  writeExifEntry(tiff, 34, 0x0128, 3, 1, 2);
  writeUint32(tiff, 46, 0);
  writeUint32(tiff, 50, dpi);
  writeUint32(tiff, 54, 1);
  writeUint32(tiff, 58, dpi);
  writeUint32(tiff, 62, 1);
  return tiff;
}

function pngPhysChunk(dpi: number) {
  const pixelsPerMeter = Math.round(dpi / 0.0254);
  const data = new Uint8Array(9);
  writeUint32(data, 0, pixelsPerMeter);
  writeUint32(data, 4, pixelsPerMeter);
  data[8] = 1;
  return pngChunk('pHYs', data);
}

function pngChunk(type: string, data: Uint8Array) {
  return concat(
    uint32Bytes(data.length),
    new TextEncoder().encode(type),
    data,
    new Uint8Array([0, 0, 0, 0])
  );
}

function photoshopSegment(dpi: number) {
  const header = new TextEncoder().encode('Photoshop 3.0\0');
  const data = new Uint8Array([
    ...fixedBytes(dpi),
    ...uint16Bytes(1),
    ...uint16Bytes(1),
    ...fixedBytes(dpi),
    ...uint16Bytes(1),
    ...uint16Bytes(1),
  ]);
  const resource = new Uint8Array([
    0x38,
    0x42,
    0x49,
    0x4d,
    ...uint16Bytes(0x03ed),
    0,
    0,
    ...uint32Bytes(data.length),
    ...data,
  ]);
  return jpegSegment(0xed, concat(header, resource));
}

function xmpSegment(dpi: number) {
  const header = new TextEncoder().encode('http://ns.adobe.com/xap/1.0/\0');
  const xml = new TextEncoder().encode(
    `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:tiff="http://ns.adobe.com/tiff/1.0/" tiff:XResolution="${dpi}/1" tiff:YResolution="${dpi}/1" tiff:ResolutionUnit="2"/></rdf:RDF></x:xmpmeta>`
  );
  return jpegSegment(0xe1, concat(header, xml));
}

function jpegSegment(marker: number, data: Uint8Array) {
  return concat(
    new Uint8Array([0xff, marker, ...uint16Bytes(data.length + 2)]),
    data
  );
}

function writeExifEntry(
  bytes: Uint8Array,
  offset: number,
  tag: number,
  type: number,
  count: number,
  value: number
) {
  writeUint16(bytes, offset, tag);
  writeUint16(bytes, offset + 2, type);
  writeUint32(bytes, offset + 4, count);
  if (type === 3 && count === 1) {
    writeUint16(bytes, offset + 8, value);
    return;
  }
  writeUint32(bytes, offset + 8, value);
}

function writeUint16(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = (value >>> 8) & 0xff;
  bytes[offset + 1] = value & 0xff;
}

function writeUint32(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function uint16Bytes(value: number) {
  return new Uint8Array([(value >>> 8) & 0xff, value & 0xff]);
}

function uint32Bytes(value: number) {
  return new Uint8Array([
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ]);
}

function fixedBytes(value: number) {
  return uint32Bytes(Math.round(value * 65536));
}

function concat(...chunks: Uint8Array[]) {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function rawText(bytes: Uint8Array) {
  return new TextDecoder('latin1').decode(bytes);
}

function readUint32(bytes: Uint8Array, offset: number) {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
}

function readPhotoshopDpi(bytes: Uint8Array) {
  const text = rawText(bytes);
  const photoshop = text.indexOf('Photoshop 3.0\0');
  assert.notEqual(photoshop, -1);
  const resource = text.indexOf('8BIM', photoshop);
  assert.notEqual(resource, -1);
  const dataOffset = resource + 4 + 2 + 2 + 4;
  return readUint32(bytes, dataOffset) / 65536;
}

const png = convertImageDpi(pngFixture(), 'image/png', 300);
assert.equal(png.before.dpiX, null);
assert.equal(png.after.dpiX, 300);
assert.equal(png.after.dpiY, 300);
assert.equal(readImageInfo(png.bytes, 'image/png').width, 32);

const pngExif = convertImageDpi(
  pngFixtureWithExifDpi(144, 300),
  'image/png',
  200
);
assert.equal(pngExif.before.dpiX, 144);
assert.equal(pngExif.before.dpiY, 144);
assert.equal(pngExif.before.dpiSource, 'png-exif');
assert.equal(pngExif.after.dpiX, 200);
assert.equal(pngExif.after.dpiY, 200);
assert.equal(pngExif.after.dpiSource, 'png-exif');
assert.equal(readImageInfo(pngExif.bytes, 'image/png').dpiX, 200);

const jpg = convertImageDpi(jpegFixture(), 'image/jpeg', 300);
assert.equal(jpg.before.dpiX, null);
assert.equal(jpg.after.dpiX, 300);
assert.equal(jpg.after.dpiY, 300);
assert.equal(readImageInfo(jpg.bytes, 'image/jpeg').height, 16);

const exifJpg = convertImageDpi(
  jpegFixtureWithJfifAndExif(300, 72),
  'image/jpeg',
  200
);
assert.equal(exifJpg.before.dpiX, 72);
assert.equal(exifJpg.before.dpiY, 72);
assert.equal(exifJpg.before.dpiSource, 'jpeg-exif');
assert.equal(exifJpg.after.dpiX, 200);
assert.equal(exifJpg.after.dpiY, 200);
assert.equal(exifJpg.after.dpiSource, 'jpeg-exif');
assert.equal(readImageInfo(exifJpg.bytes, 'image/jpeg').dpiX, 200);

const fullMetadataJpg = convertImageDpi(
  jpegFixtureWithEveryDpiContainer(72),
  'image/jpeg',
  200
);
assert.equal(fullMetadataJpg.after.dpiX, 200);
assert.equal(fullMetadataJpg.after.dpiY, 200);
assert.equal(readPhotoshopDpi(fullMetadataJpg.bytes), 200);
assert.ok(rawText(fullMetadataJpg.bytes).includes('tiff:XResolution="200/1"'));
assert.ok(rawText(fullMetadataJpg.bytes).includes('tiff:YResolution="200/1"'));
assert.ok(!rawText(fullMetadataJpg.bytes).includes('tiff:XResolution="72/1"'));
assert.ok(!rawText(fullMetadataJpg.bytes).includes('tiff:YResolution="72/1"'));

console.log('DPI conversion fixtures passed');

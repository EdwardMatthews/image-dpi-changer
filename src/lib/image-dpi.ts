export type SupportedImageKind = 'jpeg' | 'png';

export interface ImageDpiInfo {
  kind: SupportedImageKind;
  width: number | null;
  height: number | null;
  dpiX: number | null;
  dpiY: number | null;
  dpiSource:
    | 'jfif'
    | 'jpeg-exif'
    | 'jpeg-photoshop'
    | 'jpeg-xmp'
    | 'png-exif'
    | 'png-phys'
    | 'none';
}

export interface DpiConversionResult {
  bytes: Uint8Array;
  before: ImageDpiInfo;
  after: ImageDpiInfo;
  extension: 'jpg' | 'png';
}

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const JFIF_APP0 = new Uint8Array([
  0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x02, 0x01, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00,
]);
const EXIF_HEADER = new Uint8Array([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]);
const TIFF_TYPE_SHORT = 3;
const TIFF_TYPE_RATIONAL = 5;
const EXIF_TAG_X_RESOLUTION = 0x011a;
const EXIF_TAG_Y_RESOLUTION = 0x011b;
const EXIF_TAG_RESOLUTION_UNIT = 0x0128;
const JPEG_APP13_PHOTOSHOP_HEADER = 'Photoshop 3.0\0';
const PHOTOSHOP_RESOLUTION_INFO_ID = 0x03ed;
const XMP_APP1_HEADER = 'http://ns.adobe.com/xap/1.0/\0';
const DPI_RATIONAL_TEXT = (dpi: number) => `${dpi}/1`;

let crcTable: Uint32Array | null = null;

export function normalizeDpi(value: number) {
  if (!Number.isFinite(value)) {
    throw new Error('DPI must be a number.');
  }
  const dpi = Math.round(value);
  if (dpi < 1 || dpi > 65535) {
    throw new Error('DPI must be between 1 and 65535.');
  }
  return dpi;
}

export function isSupportedImageMime(mime: string) {
  return mime === 'image/jpeg' || mime === 'image/png';
}

export function convertImageDpi(
  input: ArrayBuffer | Uint8Array,
  mime: string,
  dpiValue: number
): DpiConversionResult {
  const dpi = normalizeDpi(dpiValue);
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);

  if (mime === 'image/png' || looksLikePng(bytes)) {
    const before = readPngInfo(bytes);
    const converted = writePngDpi(bytes, dpi);
    return {
      bytes: converted,
      before,
      after: readPngInfo(converted),
      extension: 'png',
    };
  }

  if (mime === 'image/jpeg' || looksLikeJpeg(bytes)) {
    const before = readJpegInfo(bytes);
    const converted = writeJpegDpi(bytes, dpi);
    return {
      bytes: converted,
      before,
      after: readJpegInfo(converted),
      extension: 'jpg',
    };
  }

  throw new Error('Only PNG and JPEG images are supported.');
}

export function readImageInfo(
  input: ArrayBuffer | Uint8Array,
  mime: string
): ImageDpiInfo {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (mime === 'image/png' || looksLikePng(bytes)) return readPngInfo(bytes);
  if (mime === 'image/jpeg' || looksLikeJpeg(bytes)) return readJpegInfo(bytes);
  throw new Error('Only PNG and JPEG images are supported.');
}

export function formatPrintSize(pixels: number | null, dpi: number | null) {
  if (!pixels || !dpi) return 'unknown';
  return `${(pixels / dpi).toFixed(2)} in`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function readPngInfo(bytes: Uint8Array): ImageDpiInfo {
  assertPng(bytes);
  const width = readUint32(bytes, 16);
  const height = readUint32(bytes, 20);
  let offset = 8;
  let physDpi: Pick<ImageDpiInfo, 'dpiX' | 'dpiY' | 'dpiSource'> | null = null;
  let exifDpi: Pick<ImageDpiInfo, 'dpiX' | 'dpiY' | 'dpiSource'> | null = null;

  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const type = ascii(bytes, offset + 4, offset + 8);
    const dataOffset = offset + 8;
    const nextOffset = dataOffset + length + 4;
    if (nextOffset > bytes.length) break;

    if (type === 'pHYs' && length >= 9 && bytes[dataOffset + 8] === 1) {
      physDpi = {
        dpiX: pixelsPerMeterToDpi(readUint32(bytes, dataOffset)),
        dpiY: pixelsPerMeterToDpi(readUint32(bytes, dataOffset + 4)),
        dpiSource: 'png-phys',
      };
    }

    if (type === 'eXIf') {
      const dpi = readPngExifDpi(bytes, dataOffset, length);
      if (dpi) exifDpi = dpi;
    }

    offset = nextOffset;
  }

  const dpi = exifDpi ?? physDpi;
  return {
    kind: 'png',
    width,
    height,
    dpiX: dpi?.dpiX ?? null,
    dpiY: dpi?.dpiY ?? null,
    dpiSource: dpi?.dpiSource ?? 'none',
  };
}

function writePngDpi(bytes: Uint8Array, dpi: number) {
  return writePngExifDpi(writePngPhysDpi(bytes, dpi), dpi);
}

function writePngPhysDpi(bytes: Uint8Array, dpi: number) {
  assertPng(bytes);
  const data = new Uint8Array(9);
  const pixelsPerMeter = Math.max(1, Math.round(dpi / 0.0254));
  writeUint32(data, 0, pixelsPerMeter);
  writeUint32(data, 4, pixelsPerMeter);
  data[8] = 1;
  const chunk = createPngChunk('pHYs', data);

  let offset = 8;
  let ihdrEnd = 0;
  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const type = ascii(bytes, offset + 4, offset + 8);
    const dataOffset = offset + 8;
    const nextOffset = dataOffset + length + 4;
    if (nextOffset > bytes.length) break;

    if (type === 'IHDR') {
      ihdrEnd = nextOffset;
    }

    if (type === 'pHYs') {
      return concat(bytes.slice(0, offset), chunk, bytes.slice(nextOffset));
    }

    offset = nextOffset;
  }

  if (!ihdrEnd) throw new Error('PNG is missing an IHDR chunk.');
  return concat(bytes.slice(0, ihdrEnd), chunk, bytes.slice(ihdrEnd));
}

function writePngExifDpi(bytes: Uint8Array, dpi: number) {
  assertPng(bytes);
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const type = ascii(bytes, offset + 4, offset + 8);
    const dataOffset = offset + 8;
    const nextOffset = dataOffset + length + 4;
    if (nextOffset > bytes.length) break;

    if (type === 'eXIf') {
      const data = bytes.slice(dataOffset, dataOffset + length);
      const context = readTiffContext(data, 0, data.length);
      if (!context || !canPatchTiffDpi(data, context)) return bytes;

      const patched = patchTiffDpi(data, context, dpi);
      const chunk = createPngChunk('eXIf', patched);
      return concat(bytes.slice(0, offset), chunk, bytes.slice(nextOffset));
    }

    offset = nextOffset;
  }

  return bytes;
}

function readJpegInfo(bytes: Uint8Array): ImageDpiInfo {
  assertJpeg(bytes);
  const info: ImageDpiInfo = {
    kind: 'jpeg',
    width: null,
    height: null,
    dpiX: null,
    dpiY: null,
    dpiSource: 'none',
  };
  let jfifDpi: Pick<ImageDpiInfo, 'dpiX' | 'dpiY' | 'dpiSource'> | null = null;
  let exifDpi: Pick<ImageDpiInfo, 'dpiX' | 'dpiY' | 'dpiSource'> | null = null;
  let photoshopDpi: Pick<ImageDpiInfo, 'dpiX' | 'dpiY' | 'dpiSource'> | null =
    null;
  let xmpDpi: Pick<ImageDpiInfo, 'dpiX' | 'dpiY' | 'dpiSource'> | null = null;

  for (const segment of jpegSegments(bytes)) {
    if (
      segment.marker === 0xe0 &&
      segment.length >= 16 &&
      isJfif(bytes, segment.dataOffset)
    ) {
      const unit = bytes[segment.dataOffset + 7];
      const xDensity = readUint16(bytes, segment.dataOffset + 8);
      const yDensity = readUint16(bytes, segment.dataOffset + 10);
      if (unit === 1) {
        jfifDpi = { dpiX: xDensity, dpiY: yDensity, dpiSource: 'jfif' };
      } else if (unit === 2) {
        jfifDpi = {
          dpiX: Math.round(xDensity * 2.54),
          dpiY: Math.round(yDensity * 2.54),
          dpiSource: 'jfif',
        };
      }
    }

    if (segment.marker === 0xe1) {
      const dpi = readExifDpi(bytes, segment.dataOffset, segment.length - 2);
      if (dpi) exifDpi = dpi;

      const xmp = readXmpDpi(bytes, segment.dataOffset, segment.length - 2);
      if (xmp) xmpDpi = xmp;
    }

    if (segment.marker === 0xed) {
      const dpi = readPhotoshopDpi(
        bytes,
        segment.dataOffset,
        segment.length - 2
      );
      if (dpi) photoshopDpi = dpi;
    }

    if (isStartOfFrame(segment.marker) && segment.length >= 8) {
      info.height = readUint16(bytes, segment.dataOffset + 1);
      info.width = readUint16(bytes, segment.dataOffset + 3);
    }
  }

  const dpi = exifDpi ?? jfifDpi ?? photoshopDpi ?? xmpDpi;
  if (dpi) {
    info.dpiX = dpi.dpiX;
    info.dpiY = dpi.dpiY;
    info.dpiSource = dpi.dpiSource;
  }

  return info;
}

function writeJpegDpi(bytes: Uint8Array, dpi: number) {
  assertJpeg(bytes);
  return writeJpegXmpDpi(
    writeJpegPhotoshopDpi(
      writeJpegExifDpi(writeJpegJfifDpi(bytes, dpi), dpi),
      dpi
    ),
    dpi
  );
}

function writeJpegJfifDpi(bytes: Uint8Array, dpi: number) {
  for (const segment of jpegSegments(bytes)) {
    if (
      segment.marker === 0xe0 &&
      segment.length >= 16 &&
      isJfif(bytes, segment.dataOffset)
    ) {
      const copy = new Uint8Array(bytes);
      copy[segment.dataOffset + 7] = 1;
      writeUint16(copy, segment.dataOffset + 8, dpi);
      writeUint16(copy, segment.dataOffset + 10, dpi);
      return copy;
    }
  }

  const app0 = new Uint8Array(JFIF_APP0);
  writeUint16(app0, 12, dpi);
  writeUint16(app0, 14, dpi);
  return concat(bytes.slice(0, 2), app0, bytes.slice(2));
}

function writeJpegExifDpi(bytes: Uint8Array, dpi: number) {
  let hasExif = false;

  for (const segment of jpegSegments(bytes)) {
    if (
      segment.marker !== 0xe1 ||
      !isExif(bytes, segment.dataOffset, segment.length - 2)
    ) {
      continue;
    }

    hasExif = true;
    const patched = patchExifDpi(
      bytes,
      segment.dataOffset,
      segment.length - 2,
      dpi
    );
    if (patched) return patched;
  }

  if (hasExif) return bytes;

  const exifSegment = createJpegSegment(0xe1, createMinimalExifDpiData(dpi));
  return concat(
    bytes.slice(0, jpegExifInsertOffset(bytes)),
    exifSegment,
    bytes.slice(jpegExifInsertOffset(bytes))
  );
}

function readPhotoshopDpi(
  bytes: Uint8Array,
  dataOffset: number,
  dataLength: number
): Pick<ImageDpiInfo, 'dpiX' | 'dpiY' | 'dpiSource'> | null {
  const resource = findPhotoshopResolutionInfo(bytes, dataOffset, dataLength);
  if (!resource || resource.dataLength < 16) return null;

  const xResolution = readPhotoshopFixed(bytes, resource.dataOffset);
  const yResolution = readPhotoshopFixed(bytes, resource.dataOffset + 8);
  const xUnit = readUint16(bytes, resource.dataOffset + 4);
  const yUnit = readUint16(bytes, resource.dataOffset + 12);
  if (
    !xResolution ||
    !yResolution ||
    (xUnit !== 1 && xUnit !== 2) ||
    (yUnit !== 1 && yUnit !== 2)
  ) {
    return null;
  }

  return {
    dpiX: Math.round(xUnit === 2 ? xResolution * 2.54 : xResolution),
    dpiY: Math.round(yUnit === 2 ? yResolution * 2.54 : yResolution),
    dpiSource: 'jpeg-photoshop',
  };
}

function writeJpegPhotoshopDpi(bytes: Uint8Array, dpi: number) {
  for (const segment of jpegSegments(bytes)) {
    if (segment.marker !== 0xed) continue;
    const resource = findPhotoshopResolutionInfo(
      bytes,
      segment.dataOffset,
      segment.length - 2
    );
    if (!resource || resource.dataLength < 16) continue;

    const copy = new Uint8Array(bytes);
    writePhotoshopFixed(copy, resource.dataOffset, dpi);
    writeUint16(copy, resource.dataOffset + 4, 1);
    writePhotoshopFixed(copy, resource.dataOffset + 8, dpi);
    writeUint16(copy, resource.dataOffset + 12, 1);
    return copy;
  }

  return bytes;
}

interface PhotoshopResource {
  dataOffset: number;
  dataLength: number;
}

function findPhotoshopResolutionInfo(
  bytes: Uint8Array,
  dataOffset: number,
  dataLength: number
): PhotoshopResource | null {
  const headerLength = JPEG_APP13_PHOTOSHOP_HEADER.length;
  if (
    dataLength < headerLength ||
    dataOffset + dataLength > bytes.length ||
    ascii(bytes, dataOffset, dataOffset + headerLength) !==
      JPEG_APP13_PHOTOSHOP_HEADER
  ) {
    return null;
  }

  let offset = dataOffset + headerLength;
  const endOffset = dataOffset + dataLength;
  while (offset + 12 <= endOffset) {
    const signature = ascii(bytes, offset, offset + 4);
    if (signature !== '8BIM' && signature !== '8B64') break;

    const resourceId = readUint16(bytes, offset + 4);
    const nameLength = bytes[offset + 6];
    const nameFieldLength = evenLength(1 + nameLength);
    const sizeOffset = offset + 6 + nameFieldLength;
    if (sizeOffset + 4 > endOffset) break;

    const dataSize = readUint32(bytes, sizeOffset);
    const resourceDataOffset = sizeOffset + 4;
    const nextOffset = resourceDataOffset + evenLength(dataSize);
    if (resourceDataOffset + dataSize > endOffset || nextOffset > endOffset)
      break;

    if (resourceId === PHOTOSHOP_RESOLUTION_INFO_ID) {
      return {
        dataOffset: resourceDataOffset,
        dataLength: dataSize,
      };
    }

    offset = nextOffset;
  }

  return null;
}

function readPhotoshopFixed(bytes: Uint8Array, offset: number) {
  return readUint32(bytes, offset) / 65536;
}

function writePhotoshopFixed(bytes: Uint8Array, offset: number, value: number) {
  writeUint32(bytes, offset, Math.round(value * 65536));
}

function readXmpDpi(
  bytes: Uint8Array,
  dataOffset: number,
  dataLength: number
): Pick<ImageDpiInfo, 'dpiX' | 'dpiY' | 'dpiSource'> | null {
  const xmp = readXmpText(bytes, dataOffset, dataLength);
  if (!xmp) return null;

  const dpiX = readXmpResolutionValue(xmp, 'XResolution');
  const dpiY = readXmpResolutionValue(xmp, 'YResolution');
  const unit = readXmpUnitValue(xmp);
  if (!dpiX || !dpiY || (unit !== 2 && unit !== 3)) return null;

  const scale = unit === 3 ? 2.54 : 1;
  return {
    dpiX: Math.round(dpiX * scale),
    dpiY: Math.round(dpiY * scale),
    dpiSource: 'jpeg-xmp',
  };
}

function writeJpegXmpDpi(bytes: Uint8Array, dpi: number) {
  for (const segment of jpegSegments(bytes)) {
    if (segment.marker !== 0xe1) continue;
    const xmp = readXmpText(bytes, segment.dataOffset, segment.length - 2);
    if (!xmp) continue;

    const rewritten = rewriteXmpDpiText(xmp, dpi);
    if (rewritten === xmp) continue;

    const encoded = new TextEncoder().encode(rewritten);
    const segmentData = concat(
      new TextEncoder().encode(XMP_APP1_HEADER),
      encoded
    );
    const replacement = createJpegSegment(0xe1, segmentData);
    return concat(
      bytes.slice(0, segment.markerOffset),
      replacement,
      bytes.slice(segment.nextOffset)
    );
  }

  return bytes;
}

function readXmpText(
  bytes: Uint8Array,
  dataOffset: number,
  dataLength: number
) {
  const headerLength = XMP_APP1_HEADER.length;
  if (
    dataLength < headerLength ||
    dataOffset + dataLength > bytes.length ||
    ascii(bytes, dataOffset, dataOffset + headerLength) !== XMP_APP1_HEADER
  ) {
    return null;
  }

  return new TextDecoder().decode(
    bytes.slice(dataOffset + headerLength, dataOffset + dataLength)
  );
}

function rewriteXmpDpiText(xmp: string, dpi: number) {
  const dpiText = DPI_RATIONAL_TEXT(dpi);
  return xmp
    .replace(
      /(\btiff:XResolution\s*=\s*["'])([^"']+)(["'])/g,
      (_match, prefix, _value, suffix) => `${prefix}${dpiText}${suffix}`
    )
    .replace(
      /(\btiff:YResolution\s*=\s*["'])([^"']+)(["'])/g,
      (_match, prefix, _value, suffix) => `${prefix}${dpiText}${suffix}`
    )
    .replace(
      /(\btiff:ResolutionUnit\s*=\s*["'])([^"']+)(["'])/g,
      (_match, prefix, _value, suffix) => `${prefix}2${suffix}`
    )
    .replace(
      /(<tiff:XResolution\b[^>]*>)([\s\S]*?)(<\/tiff:XResolution>)/g,
      (_match, prefix, _value, suffix) => `${prefix}${dpiText}${suffix}`
    )
    .replace(
      /(<tiff:YResolution\b[^>]*>)([\s\S]*?)(<\/tiff:YResolution>)/g,
      (_match, prefix, _value, suffix) => `${prefix}${dpiText}${suffix}`
    )
    .replace(
      /(<tiff:ResolutionUnit\b[^>]*>)([\s\S]*?)(<\/tiff:ResolutionUnit>)/g,
      (_match, prefix, _value, suffix) => `${prefix}2${suffix}`
    );
}

function readXmpResolutionValue(
  xmp: string,
  field: 'XResolution' | 'YResolution'
) {
  const attribute = xmp.match(
    new RegExp(`\\btiff:${field}\\s*=\\s*["']([^"']+)["']`)
  );
  const element = xmp.match(
    new RegExp(`<tiff:${field}\\b[^>]*>([\\s\\S]*?)<\\/tiff:${field}>`)
  );
  return parseXmpResolution(attribute?.[1] ?? element?.[1] ?? '');
}

function readXmpUnitValue(xmp: string) {
  const attribute = xmp.match(/\btiff:ResolutionUnit\s*=\s*["']([^"']+)["']/);
  const element = xmp.match(
    /<tiff:ResolutionUnit\b[^>]*>([\s\S]*?)<\/tiff:ResolutionUnit>/
  );
  const value = Number((attribute?.[1] ?? element?.[1] ?? '').trim());
  return Number.isFinite(value) ? value : null;
}

function parseXmpResolution(value: string) {
  const trimmed = value.trim();
  const rational = trimmed.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (rational) {
    const numerator = Number(rational[1]);
    const denominator = Number(rational[2]);
    if (
      Number.isFinite(numerator) &&
      Number.isFinite(denominator) &&
      denominator
    ) {
      return numerator / denominator;
    }
  }

  const number = Number(trimmed);
  return Number.isFinite(number) ? number : null;
}

function readPngExifDpi(
  bytes: Uint8Array,
  dataOffset: number,
  dataLength: number
): Pick<ImageDpiInfo, 'dpiX' | 'dpiY' | 'dpiSource'> | null {
  const context = readTiffContext(bytes, dataOffset, dataLength);
  if (!context) return null;
  return readTiffDpi(bytes, context, 'png-exif');
}

function readExifDpi(
  bytes: Uint8Array,
  dataOffset: number,
  dataLength: number
): Pick<ImageDpiInfo, 'dpiX' | 'dpiY' | 'dpiSource'> | null {
  const context = readExifTiffContext(bytes, dataOffset, dataLength);
  if (!context) return null;
  return readTiffDpi(bytes, context, 'jpeg-exif');
}

function patchExifDpi(
  bytes: Uint8Array,
  dataOffset: number,
  dataLength: number,
  dpi: number
) {
  const context = readExifTiffContext(bytes, dataOffset, dataLength);
  if (!context) return null;
  if (!canPatchTiffDpi(bytes, context)) return null;
  return patchTiffDpi(bytes, context, dpi);
}

function readTiffDpi(
  bytes: Uint8Array,
  context: ExifTiffContext,
  dpiSource: 'jpeg-exif' | 'png-exif'
): Pick<ImageDpiInfo, 'dpiX' | 'dpiY' | 'dpiSource'> | null {
  const dpiEntries = findTiffDpiEntries(bytes, context);
  if (!dpiEntries) return null;

  const dpiUnit = readTiffInlineShort(
    bytes,
    dpiEntries.unit.entryOffset + 8,
    context.endian
  );
  if (dpiUnit !== 2 && dpiUnit !== 3) return null;

  const xValue = readTiffRational(
    bytes,
    context,
    dpiEntries.xResolution.valueOffset
  );
  const yValue = readTiffRational(
    bytes,
    context,
    dpiEntries.yResolution.valueOffset
  );
  if (!xValue || !yValue) return null;

  const scale = dpiUnit === 3 ? 2.54 : 1;
  return {
    dpiX: Math.round(xValue * scale),
    dpiY: Math.round(yValue * scale),
    dpiSource,
  };
}

function canPatchTiffDpi(bytes: Uint8Array, context: ExifTiffContext) {
  const dpiEntries = findTiffDpiEntries(bytes, context);
  if (!dpiEntries) return false;
  return (
    tiffOffsetInBounds(context, dpiEntries.xResolution.valueOffset, 8) &&
    tiffOffsetInBounds(context, dpiEntries.yResolution.valueOffset, 8)
  );
}

function patchTiffDpi(
  bytes: Uint8Array,
  context: ExifTiffContext,
  dpi: number
) {
  const dpiEntries = findTiffDpiEntries(bytes, context);
  if (!dpiEntries) return bytes;

  const copy = new Uint8Array(bytes);
  writeTiffRational(copy, context, dpiEntries.xResolution.valueOffset, dpi, 1);
  writeTiffRational(copy, context, dpiEntries.yResolution.valueOffset, dpi, 1);
  writeTiffInlineShort(
    copy,
    dpiEntries.unit.entryOffset + 8,
    2,
    context.endian
  );
  return copy;
}

function findTiffDpiEntries(bytes: Uint8Array, context: ExifTiffContext) {
  const entries = readIfd0Entries(bytes, context);
  if (!entries) return null;

  const xResolution = entries.find(
    (entry) => entry.tag === EXIF_TAG_X_RESOLUTION
  );
  const yResolution = entries.find(
    (entry) => entry.tag === EXIF_TAG_Y_RESOLUTION
  );
  const unit = entries.find((entry) => entry.tag === EXIF_TAG_RESOLUTION_UNIT);

  if (!xResolution || !yResolution || !unit) return null;
  if (
    xResolution.type !== TIFF_TYPE_RATIONAL ||
    yResolution.type !== TIFF_TYPE_RATIONAL ||
    xResolution.count < 1 ||
    yResolution.count < 1 ||
    unit.type !== TIFF_TYPE_SHORT ||
    unit.count < 1 ||
    !tiffOffsetInBounds(context, xResolution.valueOffset, 8) ||
    !tiffOffsetInBounds(context, yResolution.valueOffset, 8)
  ) {
    return null;
  }

  return { xResolution, yResolution, unit };
}

type TiffEndian = 'little' | 'big';

interface ExifTiffContext {
  tiffStart: number;
  tiffLength: number;
  endian: TiffEndian;
  ifd0Offset: number;
}

interface TiffIfdEntry {
  tag: number;
  type: number;
  count: number;
  valueOffset: number;
  entryOffset: number;
}

function readExifTiffContext(
  bytes: Uint8Array,
  dataOffset: number,
  dataLength: number
): ExifTiffContext | null {
  if (!isExif(bytes, dataOffset, dataLength)) return null;
  return readTiffContext(
    bytes,
    dataOffset + EXIF_HEADER.length,
    dataLength - EXIF_HEADER.length
  );
}

function readTiffContext(
  bytes: Uint8Array,
  tiffStart: number,
  tiffLength: number
): ExifTiffContext | null {
  if (tiffLength < 8 || tiffStart + tiffLength > bytes.length) return null;

  const byteOrder = ascii(bytes, tiffStart, tiffStart + 2);
  const endian: TiffEndian | null =
    byteOrder === 'II' ? 'little' : byteOrder === 'MM' ? 'big' : null;
  if (!endian || readTiffUint16(bytes, tiffStart + 2, endian) !== 42)
    return null;

  const ifd0RelativeOffset = readTiffUint32(bytes, tiffStart + 4, endian);
  if (!tiffRangeInBounds(tiffLength, ifd0RelativeOffset, 2)) return null;

  return {
    tiffStart,
    tiffLength,
    endian,
    ifd0Offset: tiffStart + ifd0RelativeOffset,
  };
}

function readIfd0Entries(bytes: Uint8Array, context: ExifTiffContext) {
  const ifd0RelativeOffset = context.ifd0Offset - context.tiffStart;
  if (!tiffRangeInBounds(context.tiffLength, ifd0RelativeOffset, 2))
    return null;

  const count = readTiffUint16(bytes, context.ifd0Offset, context.endian);
  const entriesOffset = ifd0RelativeOffset + 2;
  const entriesByteLength = count * 12;
  if (
    !tiffRangeInBounds(context.tiffLength, entriesOffset, entriesByteLength + 4)
  ) {
    return null;
  }

  const entries: TiffIfdEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    const entryOffset = context.ifd0Offset + 2 + index * 12;
    entries.push({
      tag: readTiffUint16(bytes, entryOffset, context.endian),
      type: readTiffUint16(bytes, entryOffset + 2, context.endian),
      count: readTiffUint32(bytes, entryOffset + 4, context.endian),
      valueOffset: readTiffUint32(bytes, entryOffset + 8, context.endian),
      entryOffset,
    });
  }

  return entries;
}

function readTiffRational(
  bytes: Uint8Array,
  context: ExifTiffContext,
  offset: number
) {
  if (!tiffOffsetInBounds(context, offset, 8)) return null;
  const absoluteOffset = context.tiffStart + offset;
  const numerator = readTiffUint32(bytes, absoluteOffset, context.endian);
  const denominator = readTiffUint32(bytes, absoluteOffset + 4, context.endian);
  if (!denominator) return null;
  return numerator / denominator;
}

function writeTiffRational(
  bytes: Uint8Array,
  context: ExifTiffContext,
  offset: number,
  numerator: number,
  denominator: number
) {
  const absoluteOffset = context.tiffStart + offset;
  writeTiffUint32(bytes, absoluteOffset, numerator, context.endian);
  writeTiffUint32(bytes, absoluteOffset + 4, denominator, context.endian);
}

function readTiffInlineShort(
  bytes: Uint8Array,
  offset: number,
  endian: TiffEndian
) {
  return readTiffUint16(bytes, offset, endian);
}

function writeTiffInlineShort(
  bytes: Uint8Array,
  offset: number,
  value: number,
  endian: TiffEndian
) {
  writeTiffUint16(bytes, offset, value, endian);
  bytes[offset + 2] = 0;
  bytes[offset + 3] = 0;
}

function createMinimalExifDpiData(dpi: number) {
  const tiff = new Uint8Array(66);
  tiff[0] = 0x4d;
  tiff[1] = 0x4d;
  writeTiffUint16(tiff, 2, 42, 'big');
  writeTiffUint32(tiff, 4, 8, 'big');
  writeTiffUint16(tiff, 8, 3, 'big');

  writeMinimalExifEntry(
    tiff,
    10,
    EXIF_TAG_X_RESOLUTION,
    TIFF_TYPE_RATIONAL,
    1,
    50
  );
  writeMinimalExifEntry(
    tiff,
    22,
    EXIF_TAG_Y_RESOLUTION,
    TIFF_TYPE_RATIONAL,
    1,
    58
  );
  writeMinimalExifEntry(
    tiff,
    34,
    EXIF_TAG_RESOLUTION_UNIT,
    TIFF_TYPE_SHORT,
    1,
    2
  );
  writeTiffUint32(tiff, 46, 0, 'big');
  writeTiffUint32(tiff, 50, dpi, 'big');
  writeTiffUint32(tiff, 54, 1, 'big');
  writeTiffUint32(tiff, 58, dpi, 'big');
  writeTiffUint32(tiff, 62, 1, 'big');

  return concat(EXIF_HEADER, tiff);
}

function writeMinimalExifEntry(
  bytes: Uint8Array,
  offset: number,
  tag: number,
  type: number,
  count: number,
  value: number
) {
  writeTiffUint16(bytes, offset, tag, 'big');
  writeTiffUint16(bytes, offset + 2, type, 'big');
  writeTiffUint32(bytes, offset + 4, count, 'big');
  if (type === TIFF_TYPE_SHORT && count === 1) {
    writeTiffUint16(bytes, offset + 8, value, 'big');
    bytes[offset + 10] = 0;
    bytes[offset + 11] = 0;
    return;
  }
  writeTiffUint32(bytes, offset + 8, value, 'big');
}

function jpegExifInsertOffset(bytes: Uint8Array) {
  for (const segment of jpegSegments(bytes)) {
    if (segment.marker === 0xe0 && isJfif(bytes, segment.dataOffset)) {
      return segment.nextOffset;
    }
  }
  return 2;
}

function createJpegSegment(marker: number, data: Uint8Array) {
  const length = data.length + 2;
  if (length > 0xffff) throw new Error('JPEG metadata segment is too large.');
  const segment = new Uint8Array(data.length + 4);
  segment[0] = 0xff;
  segment[1] = marker;
  writeUint16(segment, 2, length);
  segment.set(data, 4);
  return segment;
}

function tiffOffsetInBounds(
  context: ExifTiffContext,
  offset: number,
  length: number
) {
  return tiffRangeInBounds(context.tiffLength, offset, length);
}

function tiffRangeInBounds(
  totalLength: number,
  offset: number,
  length: number
) {
  return offset >= 0 && length >= 0 && offset <= totalLength - length;
}

function isExif(bytes: Uint8Array, offset: number, length: number) {
  if (length < EXIF_HEADER.length || offset + length > bytes.length)
    return false;
  return EXIF_HEADER.every((byte, index) => bytes[offset + index] === byte);
}

function* jpegSegments(bytes: Uint8Array) {
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) break;
    let markerOffset = offset;
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;

    if (marker === 0xd9 || marker === 0xda) break;
    if (marker >= 0xd0 && marker <= 0xd7) continue;
    if (offset + 2 > bytes.length) break;

    const length = readUint16(bytes, offset);
    if (length < 2 || offset + length > bytes.length) break;
    yield {
      marker,
      markerOffset,
      length,
      dataOffset: offset + 2,
      nextOffset: offset + length,
    };
    offset += length;
  }
}

function createPngChunk(type: string, data: Uint8Array) {
  const typeBytes = new TextEncoder().encode(type);
  const chunk = new Uint8Array(12 + data.length);
  writeUint32(chunk, 0, data.length);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  const crcInput = concat(typeBytes, data);
  writeUint32(chunk, 8 + data.length, crc32(crcInput));
  return chunk;
}

function crc32(bytes: Uint8Array) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
      let value = i;
      for (let bit = 0; bit < 8; bit += 1) {
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      }
      crcTable[i] = value >>> 0;
    }
  }

  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
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

function writeUint32(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function readUint16(bytes: Uint8Array, offset: number) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function writeUint16(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = (value >>> 8) & 0xff;
  bytes[offset + 1] = value & 0xff;
}

function readTiffUint16(bytes: Uint8Array, offset: number, endian: TiffEndian) {
  if (endian === 'little') return bytes[offset] | (bytes[offset + 1] << 8);
  return readUint16(bytes, offset);
}

function readTiffUint32(bytes: Uint8Array, offset: number, endian: TiffEndian) {
  if (endian === 'little') {
    return (
      (bytes[offset] |
        (bytes[offset + 1] << 8) |
        (bytes[offset + 2] << 16) |
        (bytes[offset + 3] << 24)) >>>
      0
    );
  }
  return readUint32(bytes, offset);
}

function writeTiffUint16(
  bytes: Uint8Array,
  offset: number,
  value: number,
  endian: TiffEndian
) {
  if (endian === 'little') {
    bytes[offset] = value & 0xff;
    bytes[offset + 1] = (value >>> 8) & 0xff;
    return;
  }
  writeUint16(bytes, offset, value);
}

function writeTiffUint32(
  bytes: Uint8Array,
  offset: number,
  value: number,
  endian: TiffEndian
) {
  if (endian === 'little') {
    bytes[offset] = value & 0xff;
    bytes[offset + 1] = (value >>> 8) & 0xff;
    bytes[offset + 2] = (value >>> 16) & 0xff;
    bytes[offset + 3] = (value >>> 24) & 0xff;
    return;
  }
  writeUint32(bytes, offset, value);
}

function pixelsPerMeterToDpi(value: number) {
  return Math.round(value * 0.0254);
}

function ascii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.slice(start, end));
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

function evenLength(value: number) {
  return value + (value % 2);
}

function looksLikePng(bytes: Uint8Array) {
  return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
}

function looksLikeJpeg(bytes: Uint8Array) {
  return bytes[0] === 0xff && bytes[1] === 0xd8;
}

function assertPng(bytes: Uint8Array) {
  if (!looksLikePng(bytes)) throw new Error('The file is not a valid PNG.');
}

function assertJpeg(bytes: Uint8Array) {
  if (!looksLikeJpeg(bytes)) throw new Error('The file is not a valid JPEG.');
}

function isJfif(bytes: Uint8Array, offset: number) {
  return ascii(bytes, offset, offset + 5) === 'JFIF\0';
}

function isStartOfFrame(marker: number) {
  return (
    (marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf)
  );
}

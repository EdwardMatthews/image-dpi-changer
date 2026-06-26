'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileImage,
  ImageUp,
  Info,
  Lock,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

import {
  convertImageDpi,
  formatBytes,
  formatPrintSize,
  isSupportedImageMime,
  type ImageDpiInfo,
} from '@/lib/image-dpi';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const DPI_PRESETS = [72, 96, 150, 200, 300, 600];
const DPI_CONTROL_BUTTON_CLASS =
  'h-10 cursor-pointer !border-[#171412] !bg-[#171412] !text-white hover:!bg-[#2a2521] hover:!text-white';
const DPI_CONTROL_INPUT_CLASS =
  'h-10 !border-[#171412] !bg-[#171412] px-3 text-center !text-white selection:bg-white/20';
const CONVERTED_ACTION_BUTTON_CLASS =
  'cursor-pointer !border-[#171412] !bg-[#171412] !text-white hover:!bg-[#2a2521] hover:!text-white';

function clampDpi(value: number) {
  return Math.min(65535, Math.max(1, Math.round(value)));
}

type SourceImage = {
  id: string;
  name: string;
  mime: string;
  size: number;
  bytes: Uint8Array;
};

type ConvertedImage = {
  id: string;
  source: SourceImage;
  before: ImageDpiInfo;
  after: ImageDpiInfo;
  bytes: Uint8Array;
  url: string;
  outputName: string;
};

export function DpiChangerTool() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const customDpiInputRef = useRef<HTMLInputElement | null>(null);
  const [dpi, setDpi] = useState(300);
  const [customDpiText, setCustomDpiText] = useState('300');
  const [customDpiEditing, setCustomDpiEditing] = useState(false);
  const [sources, setSources] = useState<SourceImage[]>([]);
  const [results, setResults] = useState<ConvertedImage[]>([]);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [showUploadPanel, setShowUploadPanel] = useState(true);

  const supportedCount = sources.length;

  useEffect(() => {
    const converted: ConvertedImage[] = [];
    const urls: string[] = [];

    for (const source of sources) {
      try {
        const result = convertImageDpi(source.bytes, source.mime, dpi);
        const blobPart = result.bytes.buffer.slice(
          result.bytes.byteOffset,
          result.bytes.byteOffset + result.bytes.byteLength
        ) as ArrayBuffer;
        const blob = new Blob([blobPart], { type: source.mime });
        const url = URL.createObjectURL(blob);
        urls.push(url);
        converted.push({
          id: source.id,
          source,
          before: result.before,
          after: result.after,
          bytes: result.bytes,
          url,
          outputName: outputFileName(source.name, dpi, result.extension),
        });
      } catch (conversionError) {
        setError(
          conversionError instanceof Error
            ? conversionError.message
            : 'Could not convert this file.'
        );
      }
    }

    setResults(converted);
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [sources, dpi]);

  useEffect(() => {
    if (!customDpiEditing) setCustomDpiText(String(dpi));
  }, [customDpiEditing, dpi]);

  useEffect(() => {
    if (customDpiEditing) {
      customDpiInputRef.current?.focus();
      customDpiInputRef.current?.select();
    }
  }, [customDpiEditing]);

  const summary = useMemo(() => {
    if (!results.length) return 'Upload PNG or JPEG files to begin.';
    return `${results.length} file${results.length === 1 ? '' : 's'} ready at ${dpi} DPI.`;
  }, [dpi, results.length]);

  async function loadFiles(
    fileList: FileList | File[],
    options: { append?: boolean } = {}
  ) {
    setError('');
    const files = Array.from(fileList);
    const next: SourceImage[] = [];
    const unsupported = files.filter(
      (file) => !isSupportedImageMime(file.type)
    );

    for (const file of files) {
      if (!isSupportedImageMime(file.type)) continue;
      const buffer = await file.arrayBuffer();
      next.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
        name: file.name,
        mime: file.type,
        size: file.size,
        bytes: new Uint8Array(buffer),
      });
    }

    if (unsupported.length) {
      setError(
        'Some files were skipped. Only PNG and JPEG images are supported.'
      );
    }
    if (next.length) {
      setSources((current) => (options.append ? [...current, ...next] : next));
      setShowUploadPanel(false);
    }
  }

  function downloadOne(result: ConvertedImage) {
    const link = document.createElement('a');
    link.href = result.url;
    link.download = result.outputName;
    document.body.append(link);
    link.click();
    link.remove();
  }

  function downloadAll() {
    results.forEach((result, index) => {
      window.setTimeout(() => downloadOne(result), index * 120);
    });
  }

  function selectPresetDpi(preset: number) {
    setDpi(preset);
    setCustomDpiText(String(preset));
    setCustomDpiEditing(false);
  }

  function startCustomDpiEditing() {
    setCustomDpiText(String(dpi));
    setCustomDpiEditing(true);
  }

  function updateCustomDpi(value: string) {
    const digitsOnly = value.replace(/\D/g, '');
    setCustomDpiText(digitsOnly);

    if (digitsOnly) {
      setDpi(clampDpi(Number(digitsOnly)));
    }
  }

  function commitCustomDpi() {
    const value = customDpiText ? clampDpi(Number(customDpiText)) : dpi;
    setDpi(value);
    setCustomDpiText(String(value));
  }

  return (
    <section
      id="tool"
      className="overflow-hidden rounded-lg border border-[#d8d3c8] bg-white shadow-[0_24px_80px_rgba(23,20,18,0.12)]"
    >
      <div className="border-b border-white/10 bg-[#171412] p-5 text-white sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex h-6 items-center rounded-md border border-white/15 bg-white/10 px-2 text-xs font-medium text-white/85">
                Local browser processing
              </span>
              <span className="inline-flex h-6 items-center rounded-md border border-white/15 px-2 text-xs font-medium text-white/70">
                PNG and JPEG
              </span>
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">
              DPI workbench
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
              Set the DPI value a portal, printer, or publisher is asking for.
              The pixels stay the same; the metadata and print-size readout
              update so you know what the receiving system will see.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white/85">
            <Lock className="size-4" />
            <span>Your files stay on this device</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 bg-[#fbfbf8] p-4 sm:p-6">
        {showUploadPanel ? (
          <button
            type="button"
            className={cn(
              'flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors duration-200 focus-visible:ring-3 focus-visible:ring-[#0f766e]/30 focus-visible:outline-none',
              dragging
                ? 'border-[#0f766e] bg-[#ecfdf5]'
                : 'border-[#d6d0c5] bg-white hover:border-[#0f766e]/70 hover:bg-[#f5faf7]'
            )}
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              void loadFiles(event.dataTransfer.files, {
                append: supportedCount > 0,
              });
            }}
          >
            <div className="mb-4 flex size-14 items-center justify-center rounded-lg border border-[#ded8cc] bg-[#f7f8f5]">
              <ImageUp className="size-7 text-[#0f766e]" strokeWidth={1.75} />
            </div>
            <span className="text-lg font-semibold">
              {supportedCount ? 'Drop more images here' : 'Drop images here'}
            </span>
            <span className="mt-2 max-w-md text-sm leading-6 text-[#635f57]">
              Choose one or more PNG or JPEG files that are failing a DPI
              requirement. The tool rewrites the density metadata in memory and
              prepares a corrected download.
            </span>
            <span className="mt-4 inline-flex h-10 items-center rounded-lg bg-[#171412] px-4 text-sm font-medium text-white transition-colors duration-200">
              {supportedCount ? 'Add images' : 'Select images'}
            </span>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg"
              multiple
              className="sr-only"
              onChange={(event) => {
                if (event.target.files) {
                  void loadFiles(event.target.files, {
                    append: supportedCount > 0,
                  });
                }
                event.currentTarget.value = '';
              }}
            />
          </button>
        ) : (
          <div className="rounded-lg border border-[#ded8cc] bg-white p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <Label htmlFor="dpi-value" className="text-[#171412]">
                  Target DPI
                </Label>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#635f57]">
                  Set the DPI metadata for the files below. The converted files
                  update immediately when you choose a preset or type a custom
                  value.
                </p>
              </div>
              <Button
                type="button"
                className={CONVERTED_ACTION_BUTTON_CLASS}
                onClick={() => setShowUploadPanel(true)}
              >
                <ImageUp className="size-4" />
                Continue upload
              </Button>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                  {DPI_PRESETS.map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      variant={dpi === preset ? 'default' : 'outline'}
                      className={cn(
                        DPI_CONTROL_BUTTON_CLASS,
                        dpi === preset &&
                          'ring-2 ring-[#d6a84f] ring-offset-1 ring-offset-white'
                      )}
                      onClick={() => selectPresetDpi(preset)}
                    >
                      {preset}
                    </Button>
                  ))}
                </div>
                <p className="mt-3 text-sm leading-6 text-[#635f57]">
                  300 DPI is the usual print-submission request. Use a custom
                  value when an intake form names a specific density.
                </p>
              </div>

              {customDpiEditing ? (
                <Input
                  ref={customDpiInputRef}
                  id="dpi-value"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={customDpiText}
                  className={DPI_CONTROL_INPUT_CLASS}
                  aria-label="Custom DPI value"
                  onChange={(event) => updateCustomDpi(event.target.value)}
                  onBlur={commitCustomDpi}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      commitCustomDpi();
                      event.currentTarget.blur();
                    }
                  }}
                />
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    DPI_CONTROL_BUTTON_CLASS,
                    !DPI_PRESETS.includes(dpi) &&
                      'ring-2 ring-[#d6a84f] ring-offset-1 ring-offset-white'
                  )}
                  onClick={startCustomDpiEditing}
                >
                  {!DPI_PRESETS.includes(dpi) ? `Custom ${dpi}` : 'Custom'}
                </Button>
              )}
            </div>

            <div className="mt-4 grid gap-3 rounded-lg border border-[#ded8cc] bg-[#fbfbf8] p-4 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <ShieldCheck className="size-4 text-[#0f766e]" />
                Privacy and behavior
              </div>
              <p className="leading-6 text-[#635f57]">
                No upload endpoint is used. The image dpi changer fixes the
                metadata side of the problem; it does not invent extra pixels or
                make a low-resolution photo sharper.
              </p>
            </div>
          </div>
        )}

        {error ? (
          <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm">
            {error}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-lg border border-[#ded8cc] bg-white">
          <div className="flex flex-col gap-3 border-b border-[#e2ded5] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">Converted files</h2>
              <p className="mt-1 text-sm text-[#635f57]">{summary}</p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className={CONVERTED_ACTION_BUTTON_CLASS}
                disabled={!supportedCount}
                onClick={() => {
                  setSources([]);
                  setError('');
                  setShowUploadPanel(true);
                }}
              >
                <Trash2 className="size-4" />
                Clear
              </Button>
              <Button
                type="button"
                className={CONVERTED_ACTION_BUTTON_CLASS}
                disabled={!results.length}
                onClick={downloadAll}
              >
                <Download className="size-4" />
                Download all
              </Button>
            </div>
          </div>

          {results.length ? (
            <div className="divide-y">
              {results.map((result) => (
                <div
                  key={result.id}
                  className="grid gap-4 p-4 md:grid-cols-[72px_minmax(0,1fr)_auto]"
                >
                  <div className="flex size-18 items-center justify-center overflow-hidden rounded-lg border border-[#ded8cc] bg-[#f7f8f5]">
                    <img
                      src={result.url}
                      alt={`Preview of ${result.source.name}`}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <FileImage className="text-primary size-4" />
                      <h3 className="truncate font-medium">
                        {result.source.name}
                      </h3>
                      <Badge className="rounded-md border-[#171412] bg-[#171412] text-white">
                        {formatBytes(result.source.size)}
                      </Badge>
                      <Badge className="rounded-md border-[#171412] bg-[#171412] text-white">
                        {result.after.kind.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <Stat
                        label="Pixels"
                        value={dimensionText(result.after)}
                      />
                      <Stat label="Before" value={dpiText(result.before)} />
                      <Stat label="After" value={dpiText(result.after)} />
                      <Stat
                        label="Print size"
                        value={`${formatPrintSize(result.after.width, result.after.dpiX)} x ${formatPrintSize(
                          result.after.height,
                          result.after.dpiY
                        )}`}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 md:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      className={CONVERTED_ACTION_BUTTON_CLASS}
                      onClick={() => downloadOne(result)}
                    >
                      <Download className="size-4" />
                      Download
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
              <Info className="size-8 text-[#8a8174]" />
              <p className="max-w-md text-sm leading-6 text-[#635f57]">
                Conversion details appear here before you download, so you can
                check the DPI tag, pixel size, and print-size estimate before
                resubmitting the file.
              </p>
            </div>
          )}
        </div>

        <div className="grid gap-3 rounded-lg border border-[#ded8cc] bg-[#171412] p-4 text-sm text-white sm:grid-cols-3">
          <TrustItem
            icon={CheckCircle2}
            title="Metadata only"
            text="Fix the DPI tag without resampling the image."
          />
          <TrustItem
            icon={RefreshCw}
            title="Instant evidence"
            text="Change the target DPI and the result readout refreshes."
          />
          <TrustItem
            icon={Lock}
            title="Private"
            text="The browser does the work without sending images away."
          />
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#e2ded5] bg-[#fbfbf8] p-3">
      <div className="text-xs font-medium text-[#6c675f]">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}

function TrustItem({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof CheckCircle2;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-[#d6a84f]" />
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 leading-6 text-white/65">{text}</p>
      </div>
    </div>
  );
}

function outputFileName(name: string, dpi: number, extension: 'jpg' | 'png') {
  const base = name.replace(/\.[^.]+$/, '') || 'image';
  return `${base}-${dpi}dpi.${extension}`;
}

function dimensionText(info: ImageDpiInfo) {
  if (!info.width || !info.height) return 'unknown';
  return `${info.width} x ${info.height} px`;
}

function dpiText(info: ImageDpiInfo) {
  if (!info.dpiX || !info.dpiY) return 'not set';
  if (info.dpiX === info.dpiY) return `${info.dpiX} DPI`;
  return `${info.dpiX} x ${info.dpiY} DPI`;
}

import { createFileRoute } from '@tanstack/react-router';
import {
  BadgeCheck,
  CheckCircle2,
  FileImage,
  Gauge,
  Lock,
  Printer,
  Ruler,
  ShieldCheck,
} from 'lucide-react';

import { envConfigs } from '@/config';
import { Footer } from '@/blocks/footer';
import { Header } from '@/blocks/header';
import { DpiChangerTool } from '@/components/dpi-changer-tool';

const PRIMARY_KEYWORD = 'image dpi changer';
const PAGE_TITLE = 'Image DPI Changer - Change DPI Online';
const PAGE_DESCRIPTION =
  'Image DPI changer for private PNG and JPEG metadata updates. Set 72, 96, 150, 200, 300, or 600 DPI online without uploading files.';

const useCases = [
  {
    icon: Printer,
    title: 'A print portal blocks the upload',
    text: 'The image may already have enough pixels, but the intake form checks the DPI tag first. Set the requested metadata before you resubmit.',
  },
  {
    icon: Ruler,
    title: 'A file looks right, but the size reads wrong',
    text: 'Changing DPI changes the physical size software calculates from the same pixels. Use the print-size readout to catch that mismatch.',
  },
  {
    icon: Lock,
    title: 'The image is private or client-owned',
    text: 'Scans, proofs, product shots, and unpublished artwork should not be uploaded to a random converter for a metadata-only change.',
  },
  {
    icon: Gauge,
    title: 'Several files need the same requirement',
    text: 'Select a batch, apply one target DPI, and download files with a clear suffix so the corrected versions are easy to identify.',
  },
];

const workflow = [
  {
    title: 'A DPI tag that receiving software can read',
    text: 'The image dpi changer writes PNG pHYs and eXIf metadata, then synchronizes JPEG JFIF, EXIF, Photoshop, and XMP resolution tags, so common upload portals and desktop tools see the same target DPI.',
  },
  {
    title: 'A before-and-after check, not blind conversion',
    text: 'You can see the pixel dimensions, original DPI when available, target DPI, file size, and estimated print size before using the download.',
  },
  {
    title: 'A local download without sending the file away',
    text: 'The browser reads the image, rewrites the metadata in memory, and creates a download on your device. There is no upload queue to trust.',
  },
];

const limitations = [
  'Changing DPI does not add pixels. If the file is too small for the requested print size, the honest fix is a better source image or real resizing workflow.',
  'PNG files can expose DPI through both pHYs and eXIf. This tool keeps those values aligned so macOS Preview, sips, and upload portals do not disagree.',
  'JPEG files can carry more than one density hint. This tool updates JFIF density, EXIF XResolution/YResolution, Photoshop ResolutionInfo, and XMP tiff resolution when those tags are present.',
  'WebP, TIFF, HEIC, PDF, RAW, and animated formats need different metadata containers, so they are intentionally outside this focused tool.',
];

const faqs = [
  {
    question: 'My image has enough pixels. Why did the site still reject it?',
    answer:
      'Many portals do a simple metadata check before they evaluate the image itself. If the DPI tag is missing, set to 72, or set to 96, the file can fail even when the pixel dimensions are usable.',
  },
  {
    question: 'Will changing DPI make a low-resolution image print sharper?',
    answer:
      'No. DPI metadata changes how the existing pixels are interpreted for print size. It cannot create missing detail, so a small image still needs a better source file or a real resizing workflow.',
  },
  {
    question: 'When is an image dpi changer the right tool?',
    answer:
      'Use it when the requirement is about DPI, PPI, print density, or a 300 DPI metadata tag. It is especially useful for PNG or JPEG files that already have the pixels you need.',
  },
  {
    question: 'Do my images leave my browser?',
    answer:
      'No upload endpoint is used for the conversion. The browser reads the file locally, rewrites the DPI metadata in memory, and prepares the corrected download on the same device.',
  },
  {
    question: 'When should I not rely on this tool alone?',
    answer:
      'Do not use DPI metadata as a substitute for resolution. If the final print needs 2400 x 3000 pixels and your image is 900 x 600, changing DPI only changes the reported physical size.',
  },
  {
    question: 'What should I check before resubmitting the converted file?',
    answer:
      'Check the target DPI, pixel dimensions, estimated print size, output format, and file size. Those details tell you whether the file now matches the rule that blocked the first upload.',
  },
];

function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#f7f8f5] text-[#171412]">
      <Header />
      <main className="overflow-hidden">
        <section className="border-b border-[#dedbd2] px-4 pt-16 pb-14 sm:px-6 sm:pt-20 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-5xl text-center">
              <div className="inline-flex items-center gap-2 rounded-lg border border-[#d7d2c7] bg-white px-3 py-2 text-sm font-medium shadow-sm">
                <ShieldCheck className="size-4 text-[#0f766e]" />
                Private image metadata workbench
              </div>
              <div className="mt-6 space-y-5">
                <h1 className="mx-auto max-w-4xl text-5xl leading-[1.02] font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl">
                  Image DPI Changer
                </h1>
                <p className="mx-auto max-w-3xl text-lg leading-8 text-[#5f5a52]">
                  When a printer, marketplace, school form, or publisher rejects
                  a usable image because the DPI tag is wrong, you do not need a
                  full photo editor. This image dpi changer updates the metadata
                  those systems inspect, shows you what changed, and keeps the
                  file on your device.
                </p>
              </div>
            </div>

            <div className="mt-10">
              <DpiChangerTool />
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <HeroStat label="Formats" value="PNG + JPEG" />
              <HeroStat label="Common target" value="300 DPI" />
              <HeroStat label="Upload required" value="No" />
              <HeroStat label="Pixel resize" value="No" />
            </div>
          </div>
        </section>

        <section id="use-cases" className="bg-white px-4 py-18 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Why people need this"
              title="Most DPI problems are compliance problems, not design problems."
              description="People search for an image dpi changer when a workflow stops them: a 300 DPI rule, a missing density tag, a print-size mismatch, or a privacy concern around upload-based converters."
            />
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {useCases.map(({ icon: Icon, title, text }) => (
                <div
                  key={title}
                  className="rounded-lg border border-[#e2ded5] bg-[#fbfbf8] p-5 transition-colors duration-200 hover:border-[#b8aa91] hover:bg-white"
                >
                  <div className="flex size-10 items-center justify-center rounded-lg border border-[#ded8cc] bg-white">
                    <Icon
                      className="size-5 text-[#8a5a12]"
                      strokeWidth={1.75}
                    />
                  </div>
                  <h3 className="mt-5 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#635f57]">
                    {text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          className="bg-[#171412] px-4 py-18 text-white sm:px-6 lg:px-8"
        >
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold tracking-wide text-[#d6a84f] uppercase">
                What we provide
              </p>
              <h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                The result is not just a new file. It is confidence before you
                send it.
              </h2>
              <p className="mt-5 max-w-xl leading-7 text-white/70">
                A vague converter leaves you guessing whether the file will pass
                the next check. This tool focuses on the pieces that reduce that
                uncertainty: the metadata field, the before/after readout, and a
                local download you can trace. That is the practical job of an
                image dpi changer.
              </p>
            </div>
            <div className="grid gap-3">
              {workflow.map((step, index) => (
                <div
                  key={step.title}
                  className="grid gap-4 rounded-lg border border-white/15 bg-white/[0.04] p-5 sm:grid-cols-[48px_1fr]"
                >
                  <div className="flex size-12 items-center justify-center rounded-lg bg-white text-sm font-semibold text-[#171412]">
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="font-semibold">{step.title}</h3>
                    <p className="mt-2 leading-7 text-white/70">{step.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-[#dedbd2] bg-[#f7f8f5] px-4 py-18 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <article>
              <p className="text-sm font-semibold tracking-wide text-[#8a5a12] uppercase">
                What changes
              </p>
              <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                An image dpi changer edits the instruction attached to the
                pixels.
              </h2>
              <div className="mt-6 space-y-5 leading-7 text-[#5f5a52]">
                <p>
                  DPI is a print-density instruction. It tells layout, print, or
                  upload software how many image dots should map to one inch. A
                  3000 x 2400 pixel file tagged at 300 DPI is interpreted as 10
                  x 8 inches. The same pixels tagged at 150 DPI are interpreted
                  as 20 x 16 inches.
                </p>
                <p>
                  That is why a file can look sharp on screen and still fail a
                  submission rule. The portal may not be judging the visible
                  image first. It may be reading a header and looking for 300
                  DPI, 200 DPI, or another required value. The image dpi changer
                  gives you a controlled way to write that value and verify the
                  physical-size implication.
                </p>
                <p>
                  The important boundary is honest: changing DPI does not create
                  detail. It solves the metadata side of the problem. If the
                  pixels are already enough, the new tag can unblock the
                  workflow. If the pixels are not enough, the readout helps you
                  see that before wasting another upload attempt. A transparent
                  image dpi changer should make that boundary impossible to
                  miss.
                </p>
              </div>
            </article>

            <div className="grid gap-4">
              <figure className="overflow-hidden rounded-lg border border-[#ded8cc] bg-white shadow-sm">
                <img
                  src="/imgs/illustrations/dpi-metadata-flow.webp"
                  alt="A visual explanation of unchanged image pixels flowing through DPI metadata into different print-size interpretations"
                  className="w-full"
                  loading="lazy"
                  decoding="async"
                />
              </figure>

              <div className="rounded-lg border border-[#ded8cc] bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <FileImage className="size-6 text-[#0f766e]" />
                  <h2 className="text-xl font-semibold">Before you resubmit</h2>
                </div>
                <div className="mt-6 grid gap-4">
                  {limitations.map((item) => (
                    <div key={item} className="flex gap-3">
                      <CheckCircle2 className="mt-1 size-4 shrink-0 text-[#0f766e]" />
                      <p className="text-sm leading-6 text-[#635f57]">{item}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 rounded-lg border border-[#e2ded5] bg-[#f7f8f5] p-4">
                  <p className="text-xs font-semibold tracking-wide text-[#8a5a12] uppercase">
                    Print-size rule
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#635f57]">
                    An 8 x 10 inch print at 300 DPI needs 2400 x 3000 pixels.
                    Change the tag after the pixel dimensions are already right.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white px-4 py-18 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Where it helps"
              title="Built for the moments where a small metadata mismatch costs real time."
              description="The page reports original DPI when available, new DPI after conversion, pixel dimensions, print-size estimate, format, and file size. A good image dpi changer makes that evidence obvious before resubmitting."
            />
            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              <EvidenceBlock
                title="Application and school portals"
                text="When a form asks for a 300 DPI JPEG or PNG, you can fix the density tag, confirm the print-size estimate, and send the corrected file without opening Photoshop."
              />
              <EvidenceBlock
                title="Print shops and publisher intake"
                text="When the file has the right pixels but the wrong physical-size instruction, the converted download gives print software a density value it can interpret."
              />
              <EvidenceBlock
                title="Client, product, and personal images"
                text="When the image should not leave your machine, the browser File API reads it locally, rewrites the header in memory, and generates the download on the same device."
              />
            </div>
          </div>
        </section>

        <section
          id="faq"
          className="border-t border-[#dedbd2] bg-[#f7f8f5] px-4 py-18 sm:px-6 lg:px-8"
        >
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.78fr_1.22fr]">
            <div>
              <p className="text-sm font-semibold tracking-wide text-[#8a5a12] uppercase">
                FAQ
              </p>
              <h2 className="mt-3 max-w-md text-3xl font-semibold tracking-tight text-balance">
                Questions that matter when a DPI rule is blocking your file.
              </h2>
              <p className="mt-5 max-w-md leading-7 text-[#5f5a52]">
                These answers focus on the decision points that save another
                rejected upload: whether metadata is enough, whether the pixels
                are sufficient, and whether the file stays private. A useful
                image dpi changer should make those tradeoffs clear before you
                download.
              </p>
            </div>
            <div className="divide-y divide-[#e2ded5] rounded-lg border border-[#ded8cc] bg-white">
              {faqs.map((faq) => (
                <div key={faq.question} className="p-5 sm:p-6">
                  <h3 className="font-semibold">{faq.question}</h3>
                  <p className="mt-2 leading-7 text-[#5f5a52]">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
      <div>
        <p className="text-sm font-semibold tracking-wide text-[#8a5a12] uppercase">
          {eyebrow}
        </p>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {title}
        </h2>
      </div>
      <p className="max-w-2xl leading-7 text-[#5f5a52] lg:justify-self-end">
        {description}
      </p>
    </div>
  );
}

function EvidenceBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-[#e2ded5] bg-[#fbfbf8] p-6">
      <div className="mb-5 flex size-10 items-center justify-center rounded-lg bg-[#171412] text-white">
        <BadgeCheck className="size-5" />
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#635f57]">{text}</p>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#ded8cc] bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-[#6c675f]">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: PAGE_TITLE },
      {
        name: 'description',
        content: PAGE_DESCRIPTION,
      },
      { name: 'keywords', content: PRIMARY_KEYWORD },
    ],
    links: [{ rel: 'canonical', href: `${envConfigs.app_url}/` }],
  }),
  component: HomePage,
});

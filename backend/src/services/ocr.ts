import { createWorker } from "tesseract.js";
import sharp from "sharp";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import fs from "fs/promises";
import os from "os";

export interface OcrResult {
  text: string;
  processingTimeMs: number;
}

type OcrWorker = Awaited<ReturnType<typeof createWorker>>;

// ---------------------------------------------------------------------------
// Reusable Tesseract worker pool.
//
// Previously every upload created + terminated a worker (engine + language
// data spin-up each time — seconds per upload, 3x for scanned PDFs).
// Workers are expensive to start but safe to reuse: a small pool is built
// lazily on first use (or via prewarmOcr() at boot) and shared by all
// requests for the process lifetime.
// ---------------------------------------------------------------------------

const OCR_POOL_SIZE = Math.max(
  1,
  Math.min(parseInt(process.env.OCR_WORKERS || "", 10) || 2, os.cpus().length || 1)
);

type PooledWorker = { worker: OcrWorker; busy: boolean };

let pool: PooledWorker[] = [];
let poolInit: Promise<void> | null = null;
let workersCreated = 0;
const waiters: Array<() => void> = [];

async function ensurePool(): Promise<void> {
  if (!poolInit) {
    poolInit = (async () => {
      for (let i = 0; i < OCR_POOL_SIZE; i++) {
        const worker = await createWorker("eng");
        workersCreated++;
        pool.push({ worker, busy: false });
      }
      console.log(`[ocr] worker pool ready (${pool.length} workers)`);
    })().catch((err) => {
      // Reset so the next request retries pool creation instead of
      // hanging on a rejected init promise forever.
      poolInit = null;
      throw err;
    });
  }
  return poolInit;
}

async function acquireWorker(): Promise<PooledWorker> {
  await ensurePool();
  for (;;) {
    const free = pool.find((p) => !p.busy);
    if (free) {
      free.busy = true;
      return free;
    }
    await new Promise<void>((resolve) => waiters.push(resolve));
  }
}

function releaseWorker(pw: PooledWorker): void {
  pw.busy = false;
  waiters.shift()?.();
}

/** Warm up the OCR worker pool at boot so the first upload skips engine spin-up. Fire-and-forget safe. */
export function prewarmOcr(): void {
  ensurePool().catch((err) => {
    console.warn("[ocr] worker prewarm failed (non-fatal, will retry on demand):", err);
  });
}

/** Introspection for ops/smoke tests: pool size, workers ever created, queued waiters. */
export function ocrPoolStats(): {
  poolSize: number;
  workersCreated: number;
  queuedWaiters: number;
} {
  return { poolSize: pool.length, workersCreated, queuedWaiters: waiters.length };
}

/**
 * Preprocess an image buffer for better OCR accuracy.
 * - Convert to grayscale
 * - Normalize contrast
 * - Sharpen
 * - Downscale if too large
 */
async function preprocessImage(input: Buffer): Promise<Buffer> {
  const image = sharp(input);
  const metadata = await image.metadata();

  let pipeline = image;
  if (metadata.width && metadata.width > 2000) {
    pipeline = pipeline.resize({ width: 2000, withoutEnlargement: true });
  }
  if (metadata.height && metadata.height > 2000) {
    pipeline = pipeline.resize({ height: 2000, withoutEnlargement: true });
  }

  return pipeline.grayscale().normalize().sharpen().png().toBuffer();
}

/**
 * Run Tesseract OCR on a valid image buffer using a pooled worker.
 * The worker is always released back to the pool in a finally block so
 * one bad image can never wedge the pool.
 */
async function ocrImageBuffer(imageBuffer: Buffer): Promise<string> {
  const pw = await acquireWorker();
  try {
    const { data } = await pw.worker.recognize(imageBuffer);
    return data.text ?? "";
  } finally {
    releaseWorker(pw);
  }
}

/**
 * Extract text from a PDF file.
 *
 * Strategy:
 *  1. Try embedded text extraction via pdf-parse (fast path —
 *     works for all digitally-created PDFs, no OCR needed).
 *  2. If no usable text is found, the PDF is scan/image-based:
 *     render the first pages as PNG screenshots and OCR those.
 *
 * Tesseract NEVER receives a raw PDF — only valid PNG buffers.
 */
async function pdfToText(pdfPath: string): Promise<string> {
  const buffer = await fs.readFile(pdfPath);

  // Step 1: try embedded text extraction
  try {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const text = (result.text ?? "").trim();

    // If we got meaningful text, use it directly — no OCR needed
    if (text.length >= 20) {
      return text;
    }
  } catch (err) {
    console.warn("pdf-parse getText failed, falling back to screenshot+OCR:", err);
  }

  // Step 2: scanned PDF — render pages as images and OCR them
  try {
    const parser = new PDFParse({ data: buffer });
    const screenshots = await parser.getScreenshot({ scale: 2 });

    // screenshots.pages is an array of { data: Uint8Array/Buffer, ... }
    const pages: any[] = (screenshots as any).pages ?? [];

    // OCR at most the first 3 pages to bound processing time.
    // Pages run concurrently across the worker pool instead of
    // sequentially — ~Nx faster on multi-page scanned PDFs.
    const results = await Promise.all(
      pages.slice(0, 3).map(async (page) => {
        const pngBuffer = Buffer.from(page.data ?? page);
        const preprocessed = await preprocessImage(pngBuffer);
        const pageText = await ocrImageBuffer(preprocessed);
        return pageText.trim();
      })
    );

    return results.filter((t) => t.length > 0).join("\n");
  } catch (err) {
    console.error("PDF screenshot+OCR fallback failed:", err);
    throw new Error(
      "Could not extract text from this PDF. It may be corrupted, password-protected, or contain no readable content."
    );
  }
}

/**
 * Extract text from a DOC/DOCX file via mammoth.
 */
async function docToText(docPath: string): Promise<string> {
  const result = await mammoth.extractRawText({ path: docPath });
  return result.value ?? "";
}

/**
 * Main file processing function.
 * Handles images, PDFs, and Word documents.
 * NEVER throws an uncaught error that could crash the server —
 * all failures are returned as thrown Errors to the route handler.
 */
export async function processFile(
  filePath: string,
  fileType: string
): Promise<OcrResult> {
  const startTime = Date.now();
  const ext = fileType.toLowerCase().replace(/^\./, "");
  let text = "";

  if (["jpg", "jpeg", "png", "tiff", "tif", "bmp", "webp"].includes(ext)) {
    // Image: preprocess then OCR
    const raw = await fs.readFile(filePath);
    const preprocessed = await preprocessImage(raw);
    text = await ocrImageBuffer(preprocessed);
  } else if (ext === "pdf") {
    // PDF: embedded-text first, screenshot+OCR fallback
    text = await pdfToText(filePath);
  } else if (["doc", "docx"].includes(ext)) {
    // Word: direct text extraction
    text = await docToText(filePath);
  } else {
    throw new Error(`Unsupported file type: .${ext}`);
  }

  return {
    text: text.trim(),
    processingTimeMs: Date.now() - startTime,
  };
}

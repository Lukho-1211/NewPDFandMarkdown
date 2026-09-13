import {
  getDocument,
  type PDFDocumentProxy,
  type PDFPageProxy,
} from "pdfjs-dist/legacy/build/pdf.mjs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { WorksheetFigureImage, WorksheetFigureMeta } from "@/lib/worksheet-figures";

const RENDER_SCALE = 2;
/** Expand each box slightly so axes/labels are retained (fraction of page). */
const PAD_FRAC = 0.02;

const STANDARD_FONT_DATA_URL = pathToFileURL(
  path.join(process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts") + path.sep,
).href;

type CanvasAndContext = {
  canvas: {
    width: number;
    height: number;
    toBuffer: (mime?: string) => Buffer;
  };
  context: CanvasRenderingContext2D;
};

type PageCache = Map<number, { entry: CanvasAndContext; width: number; height: number }>;

type CanvasFactory = {
  create: (width: number, height: number) => CanvasAndContext;
  reset: (canvasAndContext: CanvasAndContext, width: number, height: number) => void;
  destroy: (canvasAndContext: CanvasAndContext) => void;
};

async function renderPage(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  cache: PageCache,
  canvasFactory: CanvasFactory,
): Promise<{ entry: CanvasAndContext; width: number; height: number }> {
  const cached = cache.get(pageNumber);
  if (cached) return cached;

  if (pageNumber < 1 || pageNumber > pdf.numPages) {
    throw new Error(
      `Figure references page ${pageNumber}, but the PDF has ${pdf.numPages} page(s).`,
    );
  }

  const page: PDFPageProxy = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: RENDER_SCALE });
  const width = Math.max(1, Math.ceil(viewport.width));
  const height = Math.max(1, Math.ceil(viewport.height));
  const entry = canvasFactory.create(width, height);

  await page.render({
    canvasContext: entry.context,
    viewport,
    // Required by Node canvas factory in pdfjs-dist 4.x
    canvas: entry.canvas,
  } as Parameters<PDFPageProxy["render"]>[0] & { canvas: unknown }).promise;

  const rendered = { entry, width, height };
  cache.set(pageNumber, rendered);
  return rendered;
}

function cropRegion(
  pageEntry: CanvasAndContext,
  pageWidth: number,
  pageHeight: number,
  box_2d: [number, number, number, number],
  canvasFactory: CanvasFactory,
): Uint8Array {
  const [yMin, xMin, yMax, xMax] = box_2d;
  const padX = PAD_FRAC * 1000;
  const padY = PAD_FRAC * 1000;
  const left = Math.max(0, (xMin - padX) / 1000) * pageWidth;
  const top = Math.max(0, (yMin - padY) / 1000) * pageHeight;
  const right = Math.min(1, (xMax + padX) / 1000) * pageWidth;
  const bottom = Math.min(1, (yMax + padY) / 1000) * pageHeight;

  const cropW = Math.max(1, Math.round(right - left));
  const cropH = Math.max(1, Math.round(bottom - top));
  const sx = Math.max(0, Math.floor(left));
  const sy = Math.max(0, Math.floor(top));
  const sw = Math.min(cropW, pageWidth - sx);
  const sh = Math.min(cropH, pageHeight - sy);

  const crop = canvasFactory.create(cropW, cropH);
  crop.context.fillStyle = "#ffffff";
  crop.context.fillRect(0, 0, cropW, cropH);
  crop.context.drawImage(
    pageEntry.canvas as unknown as CanvasImageSource,
    sx,
    sy,
    sw,
    sh,
    0,
    0,
    cropW,
    cropH,
  );

  const png = new Uint8Array(crop.canvas.toBuffer("image/png"));
  canvasFactory.destroy(crop);
  return png;
}

/**
 * Rasterize referenced PDF pages and crop each figure region to PNG bytes.
 * Throws if any crop fails — callers must not save a graph-less worksheet.
 */
export async function extractPdfFigures(
  pdfBytes: Uint8Array | Buffer,
  figures: WorksheetFigureMeta[],
): Promise<WorksheetFigureImage[]> {
  if (figures.length === 0) return [];

  // Always copy into a plain Uint8Array. Node Buffer subclasses Uint8Array, and
  // Buffer.slice() still returns a Buffer — pdf.js rejects that with a hard error.
  const data = Uint8Array.from(pdfBytes);

  const loadingTask = getDocument({
    data,
    useSystemFonts: true,
    isEvalSupported: false,
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
  });
  const pdf = await loadingTask.promise;
  const canvasFactory = (pdf as PDFDocumentProxy & { canvasFactory: CanvasFactory })
    .canvasFactory;
  if (!canvasFactory?.create) {
    throw new Error("PDF renderer is missing a Node canvas factory.");
  }

  const cache: PageCache = new Map();

  try {
    const images: WorksheetFigureImage[] = [];
    for (const fig of figures) {
      const page = await renderPage(pdf, fig.page, cache, canvasFactory);
      const pngBytes = cropRegion(
        page.entry,
        page.width,
        page.height,
        fig.box_2d,
        canvasFactory,
      );
      if (pngBytes.byteLength < 64) {
        throw new Error(`Cropped figure ${fig.id} produced an empty image.`);
      }
      images.push({
        id: fig.id,
        description: fig.description,
        pngBytes,
      });
    }
    return images;
  } finally {
    for (const page of cache.values()) {
      try {
        canvasFactory.destroy(page.entry);
      } catch {
        // ignore cleanup errors
      }
    }
    await pdf.destroy();
  }
}

/**
 * Smoke test for branded PDF generation with inline graph crops (no Gemini).
 * Run: npx tsx scripts/smoke-pdf.ts
 */
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import { PDFDocument, PDFName } from "pdf-lib";
import { buildWorksheetPdf } from "../lib/build-worksheet-pdf";
import { extractPdfFigures } from "../lib/extract-pdf-figures";
import {
  parseWorksheetTranscription,
  rewriteFigureMarkersForDownload,
} from "../lib/worksheet-figures";

const require = createRequire(import.meta.url);

async function makeSourceScanWithGraph(): Promise<Uint8Array> {
  // Use the same @napi-rs/canvas that pdfjs-dist bundles to avoid native ABI clashes.
  const { createCanvas } = require("pdfjs-dist/node_modules/@napi-rs/canvas") as {
    createCanvas: (w: number, h: number) => {
      getContext: (type: "2d") => CanvasRenderingContext2D;
      toBuffer: (mime: string) => Buffer;
    };
  };

  const width = 595;
  const height = 842;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#14213d";
  ctx.font = "bold 18px sans-serif";
  ctx.fillText("Grade 12 Worksheet", 48, 48);

  ctx.fillStyle = "#000000";
  ctx.font = "14px sans-serif";
  ctx.fillText("1. Consider the graph of y = x^2 below.", 48, 90);

  const gx = 120;
  const gy = 180;
  const gw = 320;
  const gh = 280;
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2;
  ctx.strokeRect(gx, gy, gw, gh);
  ctx.beginPath();
  ctx.moveTo(gx + 40, gy + gh - 20);
  ctx.lineTo(gx + 40, gy + 20);
  ctx.moveTo(gx + 40, gy + gh - 20);
  ctx.lineTo(gx + gw - 20, gy + gh - 20);
  ctx.stroke();

  ctx.strokeStyle = "#e67e22";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  const points = [
    [gx + 60, gy + 60],
    [gx + 100, gy + 160],
    [gx + 140, gy + 200],
    [gx + 180, gy + 220],
    [gx + 220, gy + 200],
    [gx + 260, gy + 160],
  ];
  points.forEach(([x, y], i) => {
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = "#000000";
  ctx.font = "14px sans-serif";
  ctx.fillText("y = x^2", gx + 180, gy - 12);

  const png = canvas.toBuffer("image/png");
  const doc = await PDFDocument.create();
  const page = doc.addPage([width, height]);
  const image = await doc.embedPng(png);
  page.drawImage(image, { x: 0, y: 0, width, height });
  return doc.save();
}

function countEmbeddedImages(pdfBytes: Uint8Array): number {
  const text = Buffer.from(pdfBytes).toString("latin1");
  const matches = text.match(/\/Subtype\s*\/Image/g);
  return matches?.length ?? 0;
}

async function main() {
  const textOnly = await buildWorksheetPdf(`# Calculus revision

1. Differentiate f(x) = x² + 3x − 1
2. Evaluate ∫₀¹ (2x + 1) dx
`);
  await writeFile("smoke-output-text.pdf", textOnly);
  console.log(`Wrote smoke-output-text.pdf (${textOnly.length} bytes)`);

  const transcription = parseWorksheetTranscription({
    markdown: `# Graph practice

1. Consider the curve below.

[[FIG:1]]

2. State the turning point.
`,
    figures: [
      {
        id: 1,
        page: 1,
        description: "parabola y = x² with axes",
        box_2d: [200, 180, 560, 760],
      },
    ],
  });
  const downloadMd = rewriteFigureMarkersForDownload(
    transcription.markdown,
    transcription.figures,
  );
  if (!downloadMd.includes("[Figure: parabola y = x² with axes]")) {
    throw new Error("Expected readable [Figure: …] placeholder in download markdown.");
  }
  if (downloadMd.includes("[[FIG:")) {
    throw new Error("Download markdown still contains internal figure markers.");
  }

  const sourceScan = await makeSourceScanWithGraph();
  // Match the API route: it passes Node Buffer into extractPdfFigures.
  const crops = await extractPdfFigures(Buffer.from(sourceScan), transcription.figures);
  if (crops.length !== 1 || crops[0].pngBytes.byteLength < 500) {
    throw new Error("Expected a non-empty PNG crop for the graph.");
  }
  await writeFile("smoke-figure-1.png", crops[0].pngBytes);
  console.log(`Wrote smoke-figure-1.png (${crops[0].pngBytes.byteLength} bytes)`);

  const withGraph = await buildWorksheetPdf(transcription.markdown, crops);
  await writeFile("smoke-output.pdf", withGraph);
  console.log(`Wrote smoke-output.pdf (${withGraph.length} bytes)`);

  const imageCount = countEmbeddedImages(withGraph);
  if (imageCount < 1) {
    throw new Error("Output PDF does not contain an embedded graph image.");
  }

  const reloaded = await PDFDocument.load(withGraph);
  if (reloaded.getPageCount() < 1) {
    throw new Error("Output PDF has no pages.");
  }
  const page = reloaded.getPages()[0];
  const resources = page.node.Resources();
  const xObject = resources?.lookup(PDFName.of("XObject"));
  if (!xObject) {
    throw new Error("Output PDF page has no XObject resources for the graph.");
  }

  console.log(`OK: embedded image count ≈ ${imageCount}, pages=${reloaded.getPageCount()}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

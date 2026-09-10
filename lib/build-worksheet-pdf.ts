import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { readFile } from "node:fs/promises";
import path from "node:path";

const COLORS = {
  navy: rgb(0x14 / 255, 0x21 / 255, 0x3d / 255),
  amber: rgb(0xfc / 255, 0xa3 / 255, 0x11 / 255),
  muted: rgb(0xe5 / 255, 0xe5 / 255, 0xe5 / 255),
  paper: rgb(1, 1, 1),
  ink: rgb(0, 0, 0),
};

const A4 = { width: 595.28, height: 841.89 };
const MARGIN_X = 48;
const HEADER_HEIGHT = 64;
const FOOTER_Y = 36;
const BODY_TOP = A4.height - HEADER_HEIGHT - 28;
const LINE_GAP = 4;

type Run = { text: string; bold?: boolean };

function parseInline(line: string): Run[] {
  const runs: Run[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|__[^_]+__)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(line)) !== null) {
    if (match.index > last) {
      runs.push({ text: line.slice(last, match.index) });
    }
    const token = match[0];
    if (
      (token.startsWith("**") && token.endsWith("**")) ||
      (token.startsWith("__") && token.endsWith("__"))
    ) {
      runs.push({ text: token.slice(2, -2), bold: true });
    } else if (token.startsWith("*") && token.endsWith("*")) {
      runs.push({ text: token.slice(1, -1), bold: true });
    } else {
      runs.push({ text: token });
    }
    last = match.index + token.length;
  }
  if (last < line.length) {
    runs.push({ text: line.slice(last) });
  }
  if (runs.length === 0) {
    runs.push({ text: line });
  }
  return runs;
}

function wrapRuns(
  runs: Run[],
  maxWidth: number,
  regular: PDFFont,
  bold: PDFFont,
  size: number,
): Run[][] {
  const lines: Run[][] = [];
  let current: Run[] = [];
  let currentWidth = 0;

  const pushLine = () => {
    if (current.length) {
      lines.push(current);
    }
    current = [];
    currentWidth = 0;
  };

  for (const run of runs) {
    const font = run.bold ? bold : regular;
    const words = run.text.split(/(\s+)/);
    for (const word of words) {
      if (!word) continue;
      const w = font.widthOfTextAtSize(word, size);
      if (currentWidth + w > maxWidth && currentWidth > 0) {
        pushLine();
        if (/^\s+$/.test(word)) continue;
      }
      current.push({ text: word, bold: run.bold });
      currentWidth += w;
    }
  }
  pushLine();
  return lines.length ? lines : [[{ text: "" }]];
}

async function loadFonts(doc: PDFDocument): Promise<{ regular: PDFFont; bold: PDFFont }> {
  doc.registerFontkit(fontkit);
  try {
    const regularBytes = await readFile(
      path.join(process.cwd(), "fonts", "NotoSans-Regular.ttf"),
    );
    const boldBytes = await readFile(path.join(process.cwd(), "fonts", "NotoSans-Bold.ttf"));
    const regular = await doc.embedFont(regularBytes, { subset: true });
    const bold = await doc.embedFont(boldBytes, { subset: true });
    return { regular, bold };
  } catch {
    const regular = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    return { regular, bold };
  }
}

function drawHeader(page: PDFPage) {
  const { width, height } = page.getSize();
  page.drawRectangle({
    x: 0,
    y: height - HEADER_HEIGHT,
    width,
    height: HEADER_HEIGHT,
    color: COLORS.navy,
  });
  page.drawRectangle({
    x: 0,
    y: height - HEADER_HEIGHT - 3,
    width,
    height: 3,
    color: COLORS.amber,
  });
  page.drawRectangle({
    x: 0,
    y: height - HEADER_HEIGHT - 5,
    width,
    height: 1.5,
    color: COLORS.muted,
  });
}

function drawHeaderTitle(page: PDFPage, font: PDFFont) {
  const { height } = page.getSize();
  page.drawText("Ember Maths12", {
    x: MARGIN_X,
    y: height - 40,
    size: 18,
    font,
    color: COLORS.amber,
  });
}

function drawFooter(page: PDFPage, font: PDFFont, pageNumber: number, totalPages: number) {
  const { width } = page.getSize();
  const label = `${pageNumber} / ${totalPages}`;
  const size = 9;
  const tw = font.widthOfTextAtSize(label, size);
  page.drawText(label, {
    x: (width - tw) / 2,
    y: FOOTER_Y,
    size,
    font,
    color: COLORS.navy,
  });
}

export async function buildWorksheetPdf(markdown: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const { regular, bold } = await loadFonts(doc);
  const maxWidth = A4.width - MARGIN_X * 2;

  type Block =
    | { kind: "heading"; level: number; runs: Run[] }
    | { kind: "para"; runs: Run[] }
    | { kind: "list"; ordered: boolean; index: number; runs: Run[] }
    | { kind: "blank" };

  const blocks: Block[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let listCounter = 0;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      blocks.push({ kind: "blank" });
      listCounter = 0;
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line.trim());
    if (heading) {
      listCounter = 0;
      blocks.push({
        kind: "heading",
        level: heading[1].length,
        runs: parseInline(heading[2]),
      });
      continue;
    }

    const ordered = /^(\d+)[.)]\s+(.*)$/.exec(line.trim());
    if (ordered) {
      listCounter = Number(ordered[1]);
      blocks.push({
        kind: "list",
        ordered: true,
        index: listCounter,
        runs: parseInline(ordered[2]),
      });
      continue;
    }

    const bullet = /^[-*•]\s+(.*)$/.exec(line.trim());
    if (bullet) {
      listCounter = 0;
      blocks.push({
        kind: "list",
        ordered: false,
        index: 0,
        runs: parseInline(bullet[1]),
      });
      continue;
    }

    listCounter = 0;
    blocks.push({ kind: "para", runs: parseInline(line.trim()) });
  }

  let page = doc.addPage([A4.width, A4.height]);
  drawHeader(page);
  drawHeaderTitle(page, bold);
  let y = BODY_TOP;
  const pages: PDFPage[] = [page];

  const ensureSpace = (needed: number) => {
    if (y - needed < FOOTER_Y + 24) {
      page = doc.addPage([A4.width, A4.height]);
      drawHeader(page);
      drawHeaderTitle(page, bold);
      pages.push(page);
      y = BODY_TOP;
    }
  };

  const drawWrapped = (
    runs: Run[],
    size: number,
    indent: number,
    prefix?: string,
  ) => {
    const prefixWidth = prefix
      ? regular.widthOfTextAtSize(prefix, size) + 6
      : 0;
    const wrapped = wrapRuns(runs, maxWidth - indent - prefixWidth, regular, bold, size);
    const lineHeight = size + LINE_GAP;

    for (let i = 0; i < wrapped.length; i++) {
      ensureSpace(lineHeight);
      let x = MARGIN_X + indent;
      if (i === 0 && prefix) {
        page.drawText(prefix, {
          x,
          y,
          size,
          font: regular,
          color: COLORS.ink,
        });
        x += prefixWidth;
      } else if (prefix) {
        x += prefixWidth;
      }
      for (const run of wrapped[i]) {
        if (!run.text) continue;
        const font = run.bold ? bold : regular;
        page.drawText(run.text, {
          x,
          y,
          size,
          font,
          color: COLORS.ink,
        });
        x += font.widthOfTextAtSize(run.text, size);
      }
      y -= lineHeight;
    }
  };

  for (const block of blocks) {
    if (block.kind === "blank") {
      y -= 10;
      continue;
    }

    if (block.kind === "heading") {
      const size = block.level === 1 ? 16 : block.level === 2 ? 14 : 12;
      y -= 8;
      ensureSpace(size + LINE_GAP);
      drawWrapped(block.runs, size, 0);
      y -= 4;
      continue;
    }

    if (block.kind === "list") {
      const prefix = block.ordered ? `${block.index}.` : "•";
      drawWrapped(block.runs, 11, 8, prefix);
      y -= 2;
      continue;
    }

    drawWrapped(block.runs, 11, 0);
    y -= 2;
  }

  const total = pages.length;
  pages.forEach((p, i) => drawFooter(p, regular, i + 1, total));

  // Fill page backgrounds behind content? pdf-lib draws in order; white is default.
  // Explicitly paint paper on each page under header for clarity.
  for (const p of pages) {
    // Content already drawn; skip re-painting to avoid covering text.
    void p;
  }

  const bytes = await doc.save();
  return bytes;
}

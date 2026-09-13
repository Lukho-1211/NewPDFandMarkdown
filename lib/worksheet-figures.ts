/** Stable inline marker written into Gemini markdown, e.g. [[FIG:1]] */
export const FIGURE_MARKER_RE = /^\[\[FIG:(\d+)\]\]\s*$/;
export const FIGURE_MARKER_GLOBAL_RE = /\[\[FIG:(\d+)\]\]/g;

export type FigureBox2d = [number, number, number, number];

export type WorksheetFigureMeta = {
  id: number;
  page: number;
  description: string;
  /** [yMin, xMin, yMax, xMax] normalized to 0–1000 */
  box_2d: FigureBox2d;
};

export type WorksheetTranscription = {
  markdown: string;
  figures: WorksheetFigureMeta[];
};

export type WorksheetFigureImage = {
  id: number;
  description: string;
  pngBytes: Uint8Array;
};

/** JSON Schema for Gemini structured output (`responseJsonSchema`). */
export const WORKSHEET_TRANSCRIPTION_SCHEMA = {
  type: "object",
  properties: {
    markdown: {
      type: "string",
      description:
        "Full worksheet Markdown. Insert [[FIG:n]] alone on its own line wherever a graph or diagram belongs.",
    },
    figures: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            description: "Matches [[FIG:id]] in markdown. Start at 1.",
          },
          page: {
            type: "integer",
            description: "1-based page number in the source PDF.",
          },
          description: {
            type: "string",
            description: "Short plain-language description of the figure.",
          },
          box_2d: {
            type: "array",
            description:
              "Bounding box [yMin, xMin, yMax, xMax] normalized to 0–1000 for that page.",
            items: { type: "number" },
            minItems: 4,
            maxItems: 4,
          },
        },
        required: ["id", "page", "description", "box_2d"],
        additionalProperties: false,
      },
    },
  },
  required: ["markdown", "figures"],
  additionalProperties: false,
} as const;

export function figureMarker(id: number): string {
  return `[[FIG:${id}]]`;
}

export function collectFigureMarkerIds(markdown: string): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const match of markdown.matchAll(FIGURE_MARKER_GLOBAL_RE)) {
    const id = Number(match[1]);
    if (!Number.isInteger(id) || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeBox(raw: unknown): FigureBox2d {
  if (!Array.isArray(raw) || raw.length !== 4 || !raw.every(isFiniteNumber)) {
    throw new Error("Each figure box_2d must be [yMin, xMin, yMax, xMax].");
  }
  const box = raw.map((n) => Math.max(0, Math.min(1000, n))) as FigureBox2d;
  const [yMin, xMin, yMax, xMax] = box;
  if (yMax <= yMin || xMax <= xMin) {
    throw new Error("Each figure box_2d must have positive width and height.");
  }
  // Reject near-empty boxes (less than ~1% of the page on either axis).
  if (yMax - yMin < 10 || xMax - xMin < 10) {
    throw new Error("Figure bounding box is too small to crop reliably.");
  }
  return box;
}

export function parseWorksheetTranscription(raw: unknown): WorksheetTranscription {
  if (!raw || typeof raw !== "object") {
    throw new Error("Transcription must be a JSON object.");
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.markdown !== "string" || !obj.markdown.trim()) {
    throw new Error("Transcription markdown is empty.");
  }
  if (!Array.isArray(obj.figures)) {
    throw new Error("Transcription figures must be an array.");
  }

  const figures: WorksheetFigureMeta[] = obj.figures.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Figure at index ${index} is invalid.`);
    }
    const fig = item as Record<string, unknown>;
    const id = fig.id;
    const page = fig.page;
    const description = fig.description;
    if (!Number.isInteger(id) || (id as number) < 1) {
      throw new Error(`Figure at index ${index} has an invalid id.`);
    }
    if (!Number.isInteger(page) || (page as number) < 1) {
      throw new Error(`Figure ${id} has an invalid page number.`);
    }
    if (typeof description !== "string" || !description.trim()) {
      throw new Error(`Figure ${id} is missing a description.`);
    }
    return {
      id: id as number,
      page: page as number,
      description: description.trim(),
      box_2d: normalizeBox(fig.box_2d),
    };
  });

  const byId = new Map<number, WorksheetFigureMeta>();
  for (const fig of figures) {
    if (byId.has(fig.id)) {
      throw new Error(`Duplicate figure id ${fig.id}.`);
    }
    byId.set(fig.id, fig);
  }

  const markerIds = collectFigureMarkerIds(obj.markdown);
  const markerSet = new Set(markerIds);
  const metaIds = new Set(figures.map((f) => f.id));

  for (const id of markerIds) {
    if (!metaIds.has(id)) {
      throw new Error(`Markdown references [[FIG:${id}]] but no figure metadata was returned.`);
    }
  }
  for (const id of metaIds) {
    if (!markerSet.has(id)) {
      throw new Error(`Figure ${id} has metadata but no [[FIG:${id}]] marker in the markdown.`);
    }
  }

  return {
    markdown: obj.markdown.trim(),
    figures,
  };
}

/** Replace [[FIG:n]] with readable [Figure: …] placeholders for download. */
export function rewriteFigureMarkersForDownload(
  markdown: string,
  figures: WorksheetFigureMeta[],
): string {
  const byId = new Map(figures.map((f) => [f.id, f]));
  return markdown.replace(FIGURE_MARKER_GLOBAL_RE, (_full, idText: string) => {
    const id = Number(idText);
    const fig = byId.get(id);
    const description = fig?.description?.trim() || `figure ${id}`;
    return `[Figure: ${description}]`;
  });
}

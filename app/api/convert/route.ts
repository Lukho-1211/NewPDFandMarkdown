import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { canUploadRole } from "@/lib/auth";
import { buildWorksheetPdf } from "@/lib/build-worksheet-pdf";
import { extractPdfFigures } from "@/lib/extract-pdf-figures";
import { sanitizeMarkdown } from "@/lib/sanitize-markdown";
import { createClient } from "@/lib/supabase/server";
import {
  parseWorksheetTranscription,
  rewriteFigureMarkersForDownload,
  WORKSHEET_TRANSCRIPTION_SCHEMA,
} from "@/lib/worksheet-figures";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 20 * 1024 * 1024;

const TRANSCRIBE_PROMPT = `You are converting a scanned Grade 12 maths worksheet PDF into structured JSON.

Return a JSON object with:
- "markdown": the worksheet as Markdown
- "figures": an array of graph/diagram crops to preserve from the scan

Markdown rules:
1. Write ALL mathematics as normal text or Unicode characters. NEVER use LaTeX.
   - Good: x², √(x+1), π, ≤, ≥, ≠, ±, ×, ÷, θ, α, a/b, (x+1)/(x-2)
   - Bad: $x^2$, \\frac, \\sqrt, \\begin{align}, \\(, \\), $$
2. Preserve question numbers, part labels (a)(b)(c), and section headings.
3. Use Markdown headings (# ## ###) for titles and section names when present.
4. Use numbered or bulleted lists where the worksheet uses them.
5. Keep the original order of content.
6. Prefer clear line breaks between questions.
7. For every diagram, graph, sketch, or figure that cannot be transcribed as text:
   - Insert a marker alone on its own line: [[FIG:n]] where n is 1, 2, 3, …
   - Add a matching entry in "figures" with the same id.
8. Do NOT write [Figure: …] placeholders. Use [[FIG:n]] markers only.
9. If the worksheet has no graphs/diagrams, return "figures": [].

Figure rules:
- id: integer matching [[FIG:id]]
- page: 1-based source PDF page number containing the figure
- description: short plain-language description of what is shown
- box_2d: [yMin, xMin, yMax, xMax] normalized to integers 0–1000 for that page
  (origin is the top-left of the page; y grows downward, x grows rightward)
- Crop tightly around the graph/diagram including axes, labels, and scales
- Only include true figures (graphs, diagrams, sketches), not ordinary text blocks`;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (typeof userId !== "string") {
    return NextResponse.json(
      { error: "Sign in to convert a worksheet." },
      { status: 401 },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (!canUploadRole(profile?.role)) {
    return NextResponse.json(
      { error: "Only teachers and admins can upload worksheets." },
      { status: 403 },
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "GEMINI_API_KEY is missing. Copy .env.example to .env.local and add your key.",
      },
      { status: 500 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Could not read the upload. Try a smaller PDF (max 20 MB)." },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a PDF file to upload." }, { status: 400 });
  }

  if (file.type && file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF files are accepted." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File is too large. Maximum size is 20 MB." },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");
  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { text: TRANSCRIBE_PROMPT },
            {
              inlineData: {
                mimeType: "application/pdf",
                data: base64,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: WORKSHEET_TRANSCRIPTION_SCHEMA,
        temperature: 0.2,
      },
    });

    const rawText = response.text?.trim() ?? "";
    if (!rawText) {
      return NextResponse.json(
        { error: "Gemini returned an empty transcription. Try another scan." },
        { status: 502 },
      );
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { error: "Gemini returned invalid JSON. Try another scan." },
        { status: 502 },
      );
    }

    const transcription = parseWorksheetTranscription(parsedJson);
    const markdownForPdf = sanitizeMarkdown(transcription.markdown);
    // Re-validate markers after sanitize (sanitize should not strip [[FIG:n]]).
    const sanitizedTranscription = parseWorksheetTranscription({
      markdown: markdownForPdf,
      figures: transcription.figures,
    });

    let figureImages;
    try {
      figureImages = await extractPdfFigures(buffer, sanitizedTranscription.figures);
    } catch (cropErr) {
      const message =
        cropErr instanceof Error ? cropErr.message : "Could not crop figures from the scan.";
      return NextResponse.json(
        {
          error: `Could not preserve graphs from the scan: ${message}`,
        },
        { status: 502 },
      );
    }

    if (figureImages.length !== sanitizedTranscription.figures.length) {
      return NextResponse.json(
        { error: "Could not preserve graphs from the scan: figure crop count mismatch." },
        { status: 502 },
      );
    }

    const pdfBytes = await buildWorksheetPdf(markdownForPdf, figureImages);
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");
    const markdown = rewriteFigureMarkersForDownload(
      markdownForPdf,
      sanitizedTranscription.figures,
    );

    const baseName = file.name.replace(/\.pdf$/i, "") || "worksheet";

    return NextResponse.json({
      markdown,
      pdfBase64,
      fileName: baseName,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Conversion failed.";
    console.error("convert error:", err);
    return NextResponse.json(
      { error: `Conversion failed: ${message}` },
      { status: 502 },
    );
  }
}

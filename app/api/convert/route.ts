import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { canUploadRole } from "@/lib/auth";
import { buildWorksheetPdf } from "@/lib/build-worksheet-pdf";
import { sanitizeMarkdown } from "@/lib/sanitize-markdown";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 20 * 1024 * 1024;

const TRANSCRIBE_PROMPT = `You are converting a scanned Grade 12 maths worksheet PDF into Markdown.

Rules:
1. Output ONLY Markdown. No preamble, no code fences, no explanation.
2. Write ALL mathematics as normal text or Unicode characters. NEVER use LaTeX.
   - Good: x², √(x+1), π, ≤, ≥, ≠, ±, ×, ÷, θ, α, a/b, (x+1)/(x-2)
   - Bad: $x^2$, \\frac, \\sqrt, \\begin{align}, \\(, \\), $$
3. Preserve question numbers, part labels (a)(b)(c), and section headings.
4. Use Markdown headings (# ## ###) for titles and section names when present.
5. Use numbered or bulleted lists where the worksheet uses them.
6. For diagrams, graphs, or figures that cannot be transcribed as text, write a short placeholder on its own line:
   [Figure: brief description of what is shown]
7. Keep the original order of content.
8. Prefer clear line breaks between questions.`;

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
    });

    const raw = response.text?.trim() ?? "";
    if (!raw) {
      return NextResponse.json(
        { error: "Gemini returned an empty transcription. Try another scan." },
        { status: 502 },
      );
    }

    const markdown = sanitizeMarkdown(raw);
    const pdfBytes = await buildWorksheetPdf(markdown);
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

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

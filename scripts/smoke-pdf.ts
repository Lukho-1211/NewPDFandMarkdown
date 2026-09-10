/**
 * Quick smoke test for branded PDF generation (no Gemini).
 * Run: npx tsx scripts/smoke-pdf.ts
 */
import { writeFile } from "node:fs/promises";
import { buildWorksheetPdf } from "../lib/build-worksheet-pdf";

const sample = `# Calculus revision

1. Differentiate f(x) = x² + 3x − 1
2. Evaluate ∫₀¹ (2x + 1) dx
3. Solve for θ: sin θ = √2 / 2 where 0 ≤ θ ≤ 2π

## Notes

- Use **Unicode** maths only
- [Figure: unit circle with angle θ marked]
`;

async function main() {
  const bytes = await buildWorksheetPdf(sample);
  await writeFile("smoke-output.pdf", bytes);
  console.log(`Wrote smoke-output.pdf (${bytes.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

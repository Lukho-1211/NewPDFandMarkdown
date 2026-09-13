/**
 * Strip common LaTeX leftovers if the model slips, keeping Unicode maths.
 * Preserves [[FIG:n]] markers used for graph crop placement.
 */
export function sanitizeMarkdown(input: string): string {
  let text = input.trim();

  // Protect figure markers from LaTeX/cleanup passes
  const markers: string[] = [];
  text = text.replace(/\[\[FIG:\d+\]\]/g, (match) => {
    const token = `@@FIGMARKER${markers.length}@@`;
    markers.push(match);
    return token;
  });

  // Remove markdown code fences if the model wraps the whole answer
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:markdown|md)?\s*/i, "").replace(/\s*```$/, "");
  }

  // $...$ and $$...$$ → inner content
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, "$1");
  text = text.replace(/\$([^$\n]+)\$/g, "$1");

  // \( ... \) and \[ ... \]
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, "$1");
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, "$1");

  // Common LaTeX commands → Unicode / plain text
  const replacements: [RegExp, string][] = [
    [/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "($1)/($2)"],
    [/\\sqrt\{([^{}]+)\}/g, "√($1)"],
    [/\\sqrt/g, "√"],
    [/\\pm/g, "±"],
    [/\\times/g, "×"],
    [/\\div/g, "÷"],
    [/\\leq/g, "≤"],
    [/\\geq/g, "≥"],
    [/\\neq/g, "≠"],
    [/\\approx/g, "≈"],
    [/\\infty/g, "∞"],
    [/\\pi\b/g, "π"],
    [/\\theta\b/g, "θ"],
    [/\\alpha\b/g, "α"],
    [/\\beta\b/g, "β"],
    [/\\gamma\b/g, "γ"],
    [/\\delta\b/g, "δ"],
    [/\\lambda\b/g, "λ"],
    [/\\mu\b/g, "μ"],
    [/\\sigma\b/g, "σ"],
    [/\\omega\b/g, "ω"],
    [/\\cdot/g, "·"],
    [/\\ldots/g, "…"],
    [/\\dots/g, "…"],
    [/\\degree/g, "°"],
    [/\\%/g, "%"],
    [/\\_/g, "_"],
    [/\\\{/g, "{"],
    [/\\\}/g, "}"],
    [/\\left/g, ""],
    [/\\right/g, ""],
    [/\\,/g, " "],
    [/\\;/g, " "],
    [/\\quad/g, "  "],
    [/\\qquad/g, "    "],
    [/\^\{([^{}]+)\}/g, "^$1"],
    [/_\{([^{}]+)\}/g, "_$1"],
    [/\\begin\{[a-zA-Z*]+\}/g, ""],
    [/\\end\{[a-zA-Z*]+\}/g, ""],
    [/\\[a-zA-Z]+\*?/g, ""],
  ];

  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement);
  }

  // Collapse leftover braces from frac etc.
  text = text.replace(/\{([^{}]+)\}/g, "$1");

  // Normalise whitespace
  text = text.replace(/[ \t]+\n/g, "\n");
  text = text.replace(/\n{3,}/g, "\n\n");

  // Restore figure markers
  text = text.replace(/@@FIGMARKER(\d+)@@/g, (_full, indexText: string) => {
    return markers[Number(indexText)] ?? "";
  });

  return text.trim();
}

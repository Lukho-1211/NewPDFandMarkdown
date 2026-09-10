# Ember Maths12 — PDF to Markdown

Upload a scanned maths PDF. Download:

1. **Markdown** — Unicode maths (no LaTeX)
2. **PDF** — recreated worksheet headed **Ember Maths12**

## Setup

```bash
npm install
cp .env.example .env.local
```

Add your Gemini key to `.env.local`:

```
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.6-flash
```

Get a key at [Google AI Studio](https://aistudio.google.com/apikey).

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), drop a scanned maths PDF, then download the Markdown and branded PDF.

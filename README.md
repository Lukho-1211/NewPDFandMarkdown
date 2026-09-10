# Ember Maths12 — class planner

Shared **Term → Week → Day** calendar for Grade 12 maths worksheets.

- **Teachers and admins** create terms, upload a scanned PDF, and replace a day’s worksheet.
- **Students** open the same calendar and download Markdown plus the Ember Maths12 PDF.

Conversion still uses `POST /api/convert`. Files are stored in Supabase (Postgres metadata + Storage PDFs).

## Setup

```bash
npm install
cp .env.example .env.local
```

Add keys to `.env.local`:

```
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.6-flash
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

Get a Gemini key at [Google AI Studio](https://aistudio.google.com/apikey). Sign in with an existing Ember Maths12 account (teacher, admin, or student).

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in, then open a term, week, and day.

export const TERM_MIN = 1;
export const TERM_MAX = 4;
export const WEEK_MIN = 1;
export const WEEK_MAX = 13;
export const WORKSHEETS_BUCKET = "worksheets";

export const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
};

export type PlannerDay = {
  term: number;
  week: number;
  day: Weekday;
  file_name: string;
  markdown: string;
  pdf_path: string;
};

export function parseTerm(value: string): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n < TERM_MIN || n > TERM_MAX) return null;
  return n;
}

export function parseWeek(value: string): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n < WEEK_MIN || n > WEEK_MAX) return null;
  return n;
}

export function parseWeekday(value: string): Weekday | null {
  return WEEKDAYS.includes(value as Weekday) ? (value as Weekday) : null;
}

export function worksheetPath(term: number, week: number, day: Weekday) {
  return `${term}/${week}/${day}/${Date.now()}.pdf`;
}

export function weeks() {
  return Array.from({ length: WEEK_MAX }, (_, i) => i + 1);
}

export function unusedTerms(existing: number[]) {
  const used = new Set(existing);
  return Array.from({ length: TERM_MAX }, (_, i) => i + 1).filter(
    (n) => !used.has(n),
  );
}

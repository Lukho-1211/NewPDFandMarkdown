"use client";

import {
  CheckCircle,
  FilePdf,
  FileText,
  SpinnerGap,
  UploadSimple,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import type { PlannerDay, Weekday } from "@/lib/planner";
import { WORKSHEETS_BUCKET, worksheetPath } from "@/lib/planner";
import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 20 * 1024 * 1024;

type Status = "idle" | "working" | "done" | "error";

type ConvertResult = {
  markdown: string;
  pdfBase64: string;
  fileName: string;
};

function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function base64ToBlob(base64: string, mime: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

export function WorksheetConverter({
  term,
  week,
  day,
  canUpload,
  existing,
}: {
  term: number;
  week: number;
  day: Weekday;
  canUpload: boolean;
  existing: PlannerDay | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>(existing ? "done" : "idle");
  const [phase, setPhase] = useState("Reading scan…");
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(
    existing?.file_name ?? null,
  );
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<ConvertResult | null>(
    existing
      ? {
          markdown: existing.markdown,
          pdfBase64: "",
          fileName: existing.file_name,
        }
      : null,
  );
  const [pdfPath, setPdfPath] = useState(existing?.pdf_path ?? null);
  const [replacing, setReplacing] = useState(false);

  const resetToExisting = () => {
    if (!existing) return;
    setStatus("done");
    setError(null);
    setFileName(existing.file_name);
    setResult({
      markdown: existing.markdown,
      pdfBase64: "",
      fileName: existing.file_name,
    });
    setPdfPath(existing.pdf_path);
    setReplacing(false);
    setPhase("Reading scan…");
    if (inputRef.current) inputRef.current.value = "";
  };

  const startReplace = () => {
    setStatus("idle");
    setError(null);
    setResult(null);
    setFileName(null);
    setReplacing(true);
    if (inputRef.current) inputRef.current.value = "";
  };

  const convert = useCallback(
    async (file: File) => {
      if (!canUpload) {
        setStatus("error");
        setError("Only teachers and admins can upload worksheets.");
        return;
      }
      if (file.type && file.type !== "application/pdf") {
        setStatus("error");
        setError("Only PDF files are accepted.");
        return;
      }
      if (file.size > MAX_BYTES) {
        setStatus("error");
        setError("File is too large. Maximum size is 20 MB.");
        return;
      }

      setFileName(file.name);
      setStatus("working");
      setError(null);
      setResult(null);
      setPhase("Reading scan…");

      const form = new FormData();
      form.append("file", file);

      const phaseTimer = window.setTimeout(() => {
        setPhase("Building worksheet…");
      }, 2500);

      try {
        const res = await fetch("/api/convert", {
          method: "POST",
          body: form,
        });
        const data = (await res.json()) as ConvertResult & { error?: string };
        if (!res.ok) {
          throw new Error(data.error || "Conversion failed.");
        }

        setPhase("Saving to class planner…");
        const converted = {
          markdown: data.markdown,
          pdfBase64: data.pdfBase64,
          fileName: data.fileName,
        };

        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Sign in again to save this worksheet.");

        const blob = base64ToBlob(converted.pdfBase64, "application/pdf");
        const path = worksheetPath(term, week, day);
        const { error: uploadError } = await supabase.storage
          .from(WORKSHEETS_BUCKET)
          .upload(path, blob, {
            contentType: "application/pdf",
            upsert: false,
          });
        if (uploadError) throw new Error(uploadError.message);

        const { error: upsertError } = await supabase.from("planner_days").upsert({
          term,
          week,
          day,
          file_name: converted.fileName,
          markdown: converted.markdown,
          pdf_path: path,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        });
        if (upsertError) {
          await supabase.storage.from(WORKSHEETS_BUCKET).remove([path]);
          throw new Error(upsertError.message);
        }

        if (existing?.pdf_path && existing.pdf_path !== path) {
          await supabase.storage
            .from(WORKSHEETS_BUCKET)
            .remove([existing.pdf_path]);
        }

        setPdfPath(path);
        setResult(converted);
        setStatus("done");
        setReplacing(false);
        router.refresh();
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Conversion failed.");
      } finally {
        window.clearTimeout(phaseTimer);
      }
    },
    [canUpload, day, existing, router, term, week],
  );

  const onFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void convert(file);
  };

  const downloadPdf = async () => {
    if (!result) return;
    if (result.pdfBase64) {
      downloadBlob(
        `${result.fileName}-ember.pdf`,
        base64ToBlob(result.pdfBase64, "application/pdf"),
      );
      return;
    }
    if (!pdfPath) return;
    const supabase = createClient();
    const { data, error: downloadError } = await supabase.storage
      .from(WORKSHEETS_BUCKET)
      .download(pdfPath);
    if (downloadError || !data) {
      setError(downloadError?.message || "Could not download the PDF.");
      return;
    }
    downloadBlob(`${result.fileName}-ember.pdf`, data);
  };

  if (!canUpload && !existing) {
    return (
      <div className="rounded-2xl border border-ember-muted/25 bg-white/[0.03] px-6 py-12 text-center">
        <p className="font-[family-name:var(--font-outfit)] text-lg font-semibold">
          No worksheet yet
        </p>
        <p className="mt-2 text-sm text-ember-muted">
          A teacher or admin will upload this day’s worksheet.
        </p>
      </div>
    );
  }

  return (
    <div>
      {status === "idle" && canUpload && (
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            onFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-16 text-center transition-colors duration-200 ${
            dragOver
              ? "border-ember-amber bg-ember-amber/10"
              : "border-ember-muted/40 bg-white/[0.03] hover:border-ember-amber/70 hover:bg-white/[0.05]"
          }`}
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ember-amber/15 text-ember-amber">
            <UploadSimple size={28} weight="bold" aria-hidden />
          </span>
          <p className="mt-5 font-[family-name:var(--font-outfit)] text-lg font-semibold text-ember-paper">
            Drop your scanned PDF here
          </p>
          <p className="mt-2 text-sm text-ember-muted">
            or click to browse · PDF only · max 20 MB
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(e) => onFiles(e.target.files)}
          />
        </div>
      )}

      {status === "working" && (
        <div className="flex flex-col items-center rounded-2xl border border-ember-muted/25 bg-white/[0.03] px-6 py-16 text-center">
          <SpinnerGap
            size={36}
            className="animate-spin text-ember-amber"
            weight="bold"
            aria-hidden
          />
          <p className="mt-5 font-[family-name:var(--font-outfit)] text-lg font-semibold">
            {phase}
          </p>
          {fileName && (
            <p className="mt-2 truncate text-sm text-ember-muted">{fileName}</p>
          )}
        </div>
      )}

      {status === "error" && (
        <div className="rounded-2xl border border-red-400/40 bg-red-950/40 px-6 py-10 text-center">
          <WarningCircle
            size={36}
            className="mx-auto text-red-300"
            weight="fill"
            aria-hidden
          />
          <p className="mt-4 font-[family-name:var(--font-outfit)] text-lg font-semibold text-ember-paper">
            Could not convert
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-ember-muted">
            {error}
          </p>
          <button
            type="button"
            onClick={() => {
              if (existing && !replacing) {
                resetToExisting();
                return;
              }
              setStatus("idle");
              setError(null);
              setFileName(null);
              setResult(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-full bg-ember-amber px-5 py-2.5 text-sm font-semibold text-ember-ink transition-transform duration-150 hover:brightness-105 active:scale-[0.98]"
          >
            Try again
          </button>
        </div>
      )}

      {status === "done" && result && (
        <div className="rounded-2xl border border-ember-muted/25 bg-white/[0.03] px-6 py-10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle
                size={28}
                className="text-ember-amber"
                weight="fill"
                aria-hidden
              />
              <div>
                <p className="font-[family-name:var(--font-outfit)] text-lg font-semibold">
                  Ready to download
                </p>
                <p className="text-sm text-ember-muted">{fileName}</p>
              </div>
            </div>
            {canUpload && (
              <button
                type="button"
                onClick={startReplace}
                aria-label="Replace worksheet"
                className="cursor-pointer rounded-full p-2 text-ember-muted transition-colors hover:bg-white/10 hover:text-ember-paper"
              >
                <X size={20} weight="bold" />
              </button>
            )}
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() =>
                downloadText(
                  `${result.fileName}.md`,
                  result.markdown,
                  "text/markdown;charset=utf-8",
                )
              }
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-ember-amber px-4 py-3.5 text-sm font-semibold text-ember-ink transition-transform duration-150 hover:brightness-105 active:scale-[0.98]"
            >
              <FileText size={20} weight="bold" aria-hidden />
              Download Markdown
            </button>
            <button
              type="button"
              onClick={() => void downloadPdf()}
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-ember-muted/50 bg-ember-paper px-4 py-3.5 text-sm font-semibold text-ember-navy transition-transform duration-150 hover:bg-ember-muted active:scale-[0.98]"
            >
              <FilePdf size={20} weight="bold" aria-hidden />
              Download PDF
            </button>
          </div>

          {canUpload && (
            <button
              type="button"
              onClick={startReplace}
              className="mt-6 cursor-pointer text-sm text-ember-muted underline-offset-4 hover:text-ember-amber hover:underline"
            >
              Replace worksheet
            </button>
          )}
        </div>
      )}

      {replacing && status === "idle" && existing && (
        <button
          type="button"
          onClick={resetToExisting}
          className="mt-4 cursor-pointer text-sm text-ember-muted underline-offset-4 hover:text-ember-amber hover:underline"
        >
          Keep current worksheet
        </button>
      )}
    </div>
  );
}

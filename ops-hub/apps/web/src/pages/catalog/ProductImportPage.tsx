import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";

import { importProducts } from "../../lib/api/products";
import type { ImportResult } from "../../lib/api/products";
import { useT } from "../../lib/i18n";
import { formatNumber } from "../../lib/format";
import {
  Breadcrumbs,
  Button,
  Card,
  ConfirmDialog,
  PageHeader,
  ProgressBar,
  StatCard,
  Table,
  Tag,
  THead,
  TH,
  TD,
  TR,
  useToast,
} from "../../components/ui";
import { InfoIcon } from "./AvailabilityBuckets";

type ImportFormat = "csv" | "xlsx";
type Step = "upload" | "report";

interface LoadedFile {
  name: string;
  size: number;
  content: string;
}

function formatSize(bytes: number): string {
  return bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${Math.round(bytes / 1024)} KB`
      : `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
}

/** Step indicator: Upload → Report, wired to the ProgressBar. */
function StepIndicator({ step }: { step: Step }) {
  const t = useT();
  const percent = step === "upload" ? 0 : 100;
  return (
    <div className="flex flex-col gap-2" aria-label={t("import.stepsAria")}>
      <ol className="flex items-center gap-2 text-body2 font-semibold">
        {[t("import.step1"), t("import.step2")].map((label, index) => {
          const current = (index === 0 ? "upload" : "report") === step;
          const done = index === 0 && step === "report";
          return (
            <li key={label} className="flex items-center gap-2">
              <span
                aria-current={current ? "step" : undefined}
                className={`flex h-7 w-7 items-center justify-center rounded-pill text-caption ${
                  current || done
                    ? "bg-primary text-white"
                    : "bg-ink-200 text-ink-600"
                }`}
              >
                {done ? "✓" : index + 1}
              </span>
              <span
                className={current || done ? "text-ink-900" : "text-ink-500"}
              >
                {label}
              </span>
              {index === 0 ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="mx-1 text-ink-400 rtl:-scale-x-100"
                  aria-hidden="true"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              ) : null}
            </li>
          );
        })}
      </ol>
      <ProgressBar value={percent} label={t("import.progressLabel")} />
    </div>
  );
}

/** Step 1: format select + file picker + dry-run/real checkbox. */
function UploadStep({
  format,
  onFormatChange,
  file,
  onFileChange,
  executeReal,
  onExecuteRealChange,
  onSubmit,
  submitting,
}: {
  format: ImportFormat;
  onFormatChange: (format: ImportFormat) => void;
  file: LoadedFile | null;
  onFileChange: (file: LoadedFile | null) => void;
  executeReal: boolean;
  onExecuteRealChange: (checked: boolean) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const t = useT();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const accept = format === "csv" ? ".csv,text/csv" : ".xlsx";

  const loadFile = (chosen: File): void => {
    const matches =
      format === "csv"
        ? chosen.name.toLowerCase().endsWith(".csv")
        : chosen.name.toLowerCase().endsWith(".xlsx");
    if (!matches) {
      onFileChange(null);
      setFileError(
        t("import.wrongExtension", { format: format.toUpperCase() }),
      );
      return;
    }
    setFileError(null);
    const reader = new FileReader();
    reader.onerror = () => {
      toast.showToast("error", t("import.readFailed"));
    };
    reader.onload = () => {
      const raw = String(reader.result ?? "");
      // XLSX travels as base64 (data URL); CSV as plain text.
      const content =
        format === "xlsx"
          ? raw.slice(raw.indexOf("base64,") + "base64,".length)
          : raw;
      onFileChange({ name: chosen.name, size: chosen.size, content });
    };
    if (format === "csv") {
      reader.readAsText(chosen);
    } else {
      reader.readAsDataURL(chosen);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-body2 font-semibold text-ink-800">
              {t("import.format")}
            </span>
            <select
              value={format}
              onChange={(event) => {
                onFormatChange(event.target.value as ImportFormat);
                onFileChange(null);
              }}
              aria-label={t("import.format")}
              className="h-11 rounded-sm border border-ink-300 bg-surface px-3 text-body1 text-ink-900 focus:border-primary"
            >
              <option value="csv">CSV</option>
              <option value="xlsx">XLSX</option>
            </select>
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-body2 font-semibold text-ink-800">
              {t("import.file")}
            </span>
            <div className="flex items-center gap-3">
              <Button
                variant="outlined"
                onClick={() => inputRef.current?.click()}
              >
                {t("import.chooseFile")}
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept={accept}
                className="sr-only"
                aria-label={t("import.chooseFile")}
                onChange={(event) => {
                  const chosen = event.target.files?.[0];
                  if (chosen !== undefined) {
                    loadFile(chosen);
                  }
                  event.target.value = "";
                }}
              />
              {file !== null ? (
                <span className="text-body2 text-ink-700" dir="ltr">
                  {t("import.fileSelected", {
                    name: file.name,
                    size: formatSize(file.size),
                  })}
                </span>
              ) : (
                <span className="text-caption text-ink-500">
                  {t("import.fileHint", { format: format.toUpperCase() })}
                </span>
              )}
            </div>
            {fileError !== null ? (
              <p className="text-caption font-semibold text-alert" role="alert">
                {fileError}
              </p>
            ) : null}
          </div>
        </div>
        <label className="flex items-start gap-2 rounded-lg border border-warning bg-warning-light p-3">
          <input
            type="checkbox"
            checked={executeReal}
            onChange={(event) => onExecuteRealChange(event.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 rounded-sm border-ink-400 focus:ring-primary"
          />
          <span>
            <span className="block text-body2 font-bold text-ink-900">
              {t("import.executeActually")}
            </span>
            <span className="block text-caption text-ink-700">
              {t("import.executeHint")}
            </span>
          </span>
        </label>
        <div className="flex items-center justify-between gap-3">
          {fileError !== null || file === null ? null : <span />}
          <Button
            loading={submitting}
            disabled={file === null}
            onClick={onSubmit}
            className="ms-auto"
          >
            {executeReal ? t("import.runReal") : t("import.runDry")}
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** Step 2: counts, progress, success banner, and the errors table. */
function ReportStep({
  result,
  onStartOver,
}: {
  result: ImportResult;
  onStartOver: () => void;
}) {
  const t = useT();
  const acceptedPercent =
    result.totalRows === 0
      ? 100
      : Math.round(
          ((result.totalRows - result.errors.length) / result.totalRows) * 100,
        );

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-subtitle1 font-bold text-ink-900">
            {t("import.reportTitle")}
          </h2>
          <Tag tone={result.dryRun ? "info" : "alert"}>
            {result.dryRun ? t("import.badge.dryRun") : t("import.badge.real")}
          </Tag>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <StatCard
            label={t("import.totalRows")}
            value={formatNumber(result.totalRows)}
          />
          <StatCard
            label={t("import.createdCount")}
            value={formatNumber(result.createdCount)}
          />
          <StatCard
            label={t("import.errorsCount")}
            value={formatNumber(result.errors.length)}
            hint={undefined}
          />
        </div>
        <ProgressBar
          value={acceptedPercent}
          label={t("import.progressLabel")}
          className="mt-4"
        />
        {result.errors.length === 0 ? (
          <div
            role="status"
            className="mt-4 flex items-start gap-2 rounded-lg border border-success bg-success-light p-3 text-body2 text-success"
          >
            <span aria-hidden="true" className="mt-0.5 font-bold">
              ✓
            </span>
            {t("import.successBanner")}
          </div>
        ) : (
          <div
            role="status"
            className="mt-4 flex items-start gap-2 rounded-lg border border-warning bg-warning-light p-3 text-body2 text-ink-800"
          >
            <InfoIcon className="mt-0.5 shrink-0 text-warning" />
            {t("import.partialBanner", {
              created: formatNumber(result.createdCount),
              total: formatNumber(result.totalRows),
            })}
          </div>
        )}
      </Card>
      {result.errors.length > 0 ? (
        <Card className="border-warning p-4">
          <h3 className="text-subtitle2 font-bold text-ink-900">
            {t("import.errorsTitle")}
          </h3>
          <p className="mt-1 text-caption text-ink-600">
            {t("import.errorsHint")}
          </p>
          <div className="mt-3 overflow-hidden rounded-lg border border-warning-light">
            <Table ariaLabel={t("import.errorsAria")} zebra>
              <THead>
                <tr>
                  <TH className="w-20 bg-warning-light">
                    {t("import.col.row")}
                  </TH>
                  <TH className="bg-warning-light">{t("import.col.reason")}</TH>
                </tr>
              </THead>
              <tbody>
                {result.errors.map((rowError) => (
                  <TR key={rowError.row}>
                    <TD className="font-mono font-bold text-warning" dir="ltr">
                      {rowError.row}
                    </TD>
                    <TD className="text-ink-800">{rowError.reason}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      ) : null}
      <div className="flex items-center gap-3">
        <Button variant="outlined" onClick={onStartOver}>
          {t("import.startOver")}
        </Button>
        <Link to="/products" className="text-body2 text-info hover:underline">
          {t("import.backToProducts")}
        </Link>
      </div>
    </div>
  );
}

/** /products/import — dry-run-first import wizard. */
export function ProductImportPage() {
  const t = useT();
  const [format, setFormat] = useState<ImportFormat>("csv");
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [executeReal, setExecuteReal] = useState(false);
  const [pendingReal, setPendingReal] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [result, setResult] = useState<ImportResult | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      if (file === null) {
        return Promise.reject(new Error("no file"));
      }
      return importProducts({
        format,
        content: file.content,
        dryRun: !executeReal,
      });
    },
    onSuccess: (importResult) => {
      setResult(importResult);
      setStep("report");
    },
    onError: () => {
      setResult(null);
    },
  });

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4">
      <Breadcrumbs
        items={[
          { label: t("breadcrumbs.home"), to: "/" },
          { label: t("nav.products"), to: "/products" },
          { label: t("import.title") },
        ]}
      />
      <PageHeader
        title={t("import.title")}
        description={t("import.description")}
      />
      <StepIndicator step={step} />
      {step === "upload" ? (
        <>
          <UploadStep
            format={format}
            onFormatChange={setFormat}
            file={file}
            onFileChange={setFile}
            executeReal={executeReal}
            onExecuteRealChange={(checked) => {
              if (checked) {
                setPendingReal(true);
              } else {
                setExecuteReal(false);
              }
            }}
            onSubmit={() => mutation.mutate()}
            submitting={mutation.isPending}
          />
          {mutation.isError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-alert bg-alert-light p-3 text-body2 text-alert"
            >
              <span aria-hidden="true" className="mt-0.5 font-bold">
                ✕
              </span>
              {t("import.importFailed")}
            </div>
          ) : null}
          <ConfirmDialog
            open={pendingReal}
            onClose={() => setPendingReal(false)}
            onConfirm={() => {
              setPendingReal(false);
              setExecuteReal(true);
            }}
            title={t("import.confirmRealTitle")}
            body={t("import.confirmRealBody")}
            confirmLabel={t("import.runReal")}
          />
        </>
      ) : null}
      {step === "report" && result !== null ? (
        <ReportStep
          result={result}
          onStartOver={() => {
            setResult(null);
            setFile(null);
            setExecuteReal(false);
            setStep("upload");
          }}
        />
      ) : null}
    </div>
  );
}

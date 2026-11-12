import { useState } from "react";

import { Button, Card, PageHeader, useToast } from "../../components/ui";
import { ApiError } from "../../lib/api/client";
import {
  downloadExport,
  EXPORT_RESOURCES,
  type ExportResource,
} from "../../lib/api/exports";
import { useT } from "../../lib/i18n";

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function ExportsPage() {
  const t = useT();
  const toast = useToast();
  const [busy, setBusy] = useState<ExportResource | null>(null);

  const download = async (resource: ExportResource) => {
    setBusy(resource);
    try {
      const { blob, filename } = await downloadExport(resource);
      saveBlob(blob, filename);
    } catch (error) {
      const detail =
        error instanceof ApiError ? error.problem.detail : undefined;
      toast.showToast("error", detail ?? t("exports.failed"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4">
      <PageHeader
        title={t("exports.title")}
        description={t("exports.description")}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {EXPORT_RESOURCES.map((resource) => (
          <Card key={resource}>
            <h2 className="text-subtitle1 font-bold text-ink-900">
              {t(`exports.${resource}.title`)}
            </h2>
            <p className="mt-1 text-body2 text-ink-700">
              {t(`exports.${resource}.body`)}
            </p>
            <div className="mt-4 flex justify-end">
              <Button
                variant="outlined"
                loading={busy === resource}
                disabled={busy !== null && busy !== resource}
                onClick={() => void download(resource)}
              >
                {t("exports.download")}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

import { downloadFile } from "./client";
import { filenameFromDisposition } from "./download";

export const EXPORT_RESOURCES = [
  "orders",
  "products",
  "inventory",
  "customers",
] as const;
export type ExportResource = (typeof EXPORT_RESOURCES)[number];

/** Downloads `GET /v1/exports/:resource.csv` and returns the file with its server-chosen name. */
export async function downloadExport(
  resource: ExportResource,
): Promise<{ blob: Blob; filename: string }> {
  const { blob, disposition } = await downloadFile(
    `/v1/exports/${resource}.csv`,
  );
  return {
    blob,
    filename: filenameFromDisposition(disposition, `${resource}.csv`),
  };
}

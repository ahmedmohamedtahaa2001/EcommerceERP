import { apiFetch } from "./client";
import type { CompanyProfile } from "../../pages/admin/company-form";

export interface CompanyRecord extends CompanyProfile {
  slug: string;
}

/** `GET /v1/settings/company` → 200. */
export function getCompany(): Promise<CompanyRecord> {
  return apiFetch<CompanyRecord>("/v1/settings/company");
}

/** `PATCH /v1/settings/company` → 200: send only the fields that changed. */
export function updateCompany(
  body: Partial<CompanyProfile>,
): Promise<CompanyRecord> {
  return apiFetch<CompanyRecord>("/v1/settings/company", {
    method: "PATCH",
    body,
  });
}

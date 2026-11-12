import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  Button,
  Card,
  Input,
  PageHeader,
  Skeleton,
  useToast,
} from "../../components/ui";
import { ApiError } from "../../lib/api/client";
import { getCompany, updateCompany } from "../../lib/api/company";
import { useT } from "../../lib/i18n";
import {
  changedFields,
  COUNTRIES,
  CURRENCIES,
  TIMEZONES,
  type CompanyProfile,
} from "./company-form";

export function SettingsPage() {
  const t = useT();
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["company"], queryFn: getCompany });
  const [draft, setDraft] = useState<CompanyProfile | null>(null);

  useEffect(() => {
    if (query.data && draft === null) {
      const { slug: _slug, ...profile } = query.data;
      setDraft(profile);
    }
  }, [query.data, draft]);

  const mutation = useMutation({
    mutationFn: (patch: Partial<CompanyProfile>) => updateCompany(patch),
    onSuccess: async (saved) => {
      const { slug: _slug, ...profile } = saved;
      setDraft(profile);
      toast.showToast("success", t("company.saved"));
      await queryClient.invalidateQueries({ queryKey: ["company"] });
    },
    onError: (error) => {
      const detail =
        error instanceof ApiError ? error.problem.detail : undefined;
      toast.showToast("error", detail ?? t("company.saveFailed"));
    },
  });

  if (query.isLoading || draft === null || query.data === undefined) {
    return <Skeleton className="h-64" />;
  }
  const saved = query.data;
  const savedProfile: CompanyProfile = {
    name: saved.name,
    timezone: saved.timezone,
    defaultCurrency: saved.defaultCurrency,
    countryCode: saved.countryCode,
    allowNegativeStock: saved.allowNegativeStock,
  };
  const patch = changedFields(savedProfile, draft);
  const dirty = Object.keys(patch).length > 0;

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4">
      <PageHeader
        title={t("company.title")}
        description={t("company.description")}
      />
      <Card>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (dirty) mutation.mutate(patch);
          }}
        >
          <Input
            label={t("company.name")}
            value={draft.name}
            onChange={(event) =>
              setDraft({ ...draft, name: event.target.value })
            }
            required
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-body2 text-ink-800">
              {t("company.timezone")}
              <select
                value={draft.timezone}
                onChange={(event) =>
                  setDraft({ ...draft, timezone: event.target.value })
                }
                className="h-11 rounded-sm border border-ink-300 bg-surface px-3 text-body1"
              >
                {TIMEZONES.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-body2 text-ink-800">
              {t("company.currency")}
              <select
                value={draft.defaultCurrency}
                onChange={(event) =>
                  setDraft({ ...draft, defaultCurrency: event.target.value })
                }
                className="h-11 rounded-sm border border-ink-300 bg-surface px-3 text-body1"
              >
                {CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-body2 text-ink-800">
              {t("company.country")}
              <select
                value={draft.countryCode}
                onChange={(event) =>
                  setDraft({ ...draft, countryCode: event.target.value })
                }
                className="h-11 rounded-sm border border-ink-300 bg-surface px-3 text-body1"
              >
                {COUNTRIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex items-start gap-2 text-body2 text-ink-800">
            <input
              type="checkbox"
              className="mt-1"
              checked={draft.allowNegativeStock}
              onChange={(event) =>
                setDraft({ ...draft, allowNegativeStock: event.target.checked })
              }
            />
            <span>
              {t("company.negativeStock")}
              <span className="block text-caption text-ink-600">
                {t("company.negativeStock.hint")}
              </span>
            </span>
          </label>
          <div className="flex items-center justify-between gap-3">
            <p className="text-caption text-ink-600">
              {t("company.slug", { slug: saved.slug })}
            </p>
            <Button
              type="submit"
              loading={mutation.isPending}
              disabled={!dirty}
            >
              {t("action.save")}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

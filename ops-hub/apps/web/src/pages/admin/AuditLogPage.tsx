import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import type { ReactNode } from "react";

import {
  listAudit,
  type AuditActorType,
  type AuditEntry,
} from "../../lib/api/admin";
import { useT } from "../../lib/i18n";
import { formatDate, formatRelative } from "../../lib/format";
import { Breadcrumbs, PageHeader } from "../../components/ui/Breadcrumbs";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Skeleton } from "../../components/ui/Skeleton";
import { Table, THead, TH, TR, TD } from "../../components/ui/Table";
import { Tag, type TagTone } from "../../components/ui/Tag";

const LIMIT_OPTIONS = [50, 100, 200] as const;
const SKELETON_ROWS = 6;

const ACTOR_TONES: Record<AuditActorType, TagTone> = {
  user: "primary",
  api_key: "secondary",
  system: "neutral",
};

/** Filter bar — drafts locally, Apply commits them to the URL (shareable). */
function AuditFilters({
  objectType,
  objectId,
  limit,
  onApply,
  onReset,
}: {
  objectType: string;
  objectId: string;
  limit: number;
  onApply: (next: {
    objectType: string;
    objectId: string;
    limit: number;
  }) => void;
  onReset: () => void;
}) {
  const t = useT();
  const [draftType, setDraftType] = useState(objectType);
  const [draftId, setDraftId] = useState(objectId);
  const [draftLimit, setDraftLimit] = useState(String(limit));

  return (
    <Card className="p-4">
      <p className="mb-3 text-body2 font-bold text-ink-800">
        {t("audit.filter.title")}
      </p>
      <form
        className="flex flex-col gap-3 md:flex-row md:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          onApply({
            objectType: draftType.trim(),
            objectId: draftId.trim(),
            limit: Number(draftLimit),
          });
        }}
      >
        <Input
          className="md:max-w-48"
          label={t("audit.filter.objectType")}
          placeholder={t("audit.filter.objectTypePlaceholder")}
          value={draftType}
          onChange={(event) => setDraftType(event.target.value)}
        />
        <Input
          className="md:max-w-56"
          label={t("audit.filter.objectId")}
          placeholder={t("audit.filter.objectIdPlaceholder")}
          value={draftId}
          onChange={(event) => setDraftId(event.target.value)}
        />
        <Select
          className="md:max-w-32"
          label={t("audit.filter.limit")}
          value={draftLimit}
          onChange={(event) => setDraftLimit(event.target.value)}
          options={LIMIT_OPTIONS.map((value) => ({
            value: String(value),
            label: String(value),
          }))}
        />
        <div className="flex gap-2">
          <Button type="submit">{t("audit.filter.apply")}</Button>
          <Button variant="ghost" onClick={onReset}>
            {t("audit.filter.reset")}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** Actor tag + mono id (user / api_key / system). */
function ActorCell({ type, id }: { type: AuditActorType; id: string | null }) {
  const t = useT();
  return (
    <div className="flex flex-col items-start gap-1">
      <Tag tone={ACTOR_TONES[type]}>{t(`audit.actor.${type}`)}</Tag>
      {id !== null ? (
        <span dir="ltr" className="font-mono text-caption text-ink-500">
          {id}
        </span>
      ) : null}
    </div>
  );
}

/** Pretty-printed before/after JSON on the neutral-100 surface. */
function JsonSnapshot({
  label,
  value,
  emptyNote,
}: {
  label: string;
  value: unknown;
  emptyNote: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-caption font-bold text-ink-700">{label}</span>
      {value === null || value === undefined ? (
        <p className="text-caption text-ink-500">{emptyNote}</p>
      ) : (
        <pre
          dir="ltr"
          className="overflow-x-auto rounded-sm bg-ink-100 p-3 font-mono text-caption leading-relaxed text-ink-800"
        >
          {JSON.stringify(value, null, 2)}
        </pre>
      )}
    </div>
  );
}

/** Rows + inline-expansion detail rows (before/after JSON). */
function Rows({
  entries,
  expanded,
  onToggle,
}: {
  entries: AuditEntry[];
  expanded: ReadonlySet<number>;
  onToggle: (id: number) => void;
}) {
  const t = useT();
  return (
    <tbody>
      {entries.map((entry) => {
        const isOpen = expanded.has(entry.id);
        return (
          <Fragment key={entry.id}>
            <TR>
              <TD>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`audit-detail-${entry.id}`}
                  aria-label={t("audit.table.expandHint")}
                  onClick={() => onToggle(entry.id)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-ink-600 transition-colors hover:bg-ink-200"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
              </TD>
              <TD>
                <span className="whitespace-nowrap text-ink-800">
                  {formatDate(entry.createdAt)}
                </span>
                <span className="block text-caption text-ink-500">
                  {formatRelative(entry.createdAt)}
                </span>
              </TD>
              <TD>
                <ActorCell type={entry.actorType} id={entry.actorId} />
              </TD>
              <TD>
                <code dir="ltr" className="font-mono text-caption text-ink-800">
                  {entry.action}
                </code>
              </TD>
              <TD>
                <span className="font-semibold text-ink-800">
                  {entry.objectType}
                </span>
                {entry.objectId !== null ? (
                  <code
                    dir="ltr"
                    className="block font-mono text-caption text-ink-500"
                  >
                    {entry.objectId}
                  </code>
                ) : null}
              </TD>
              <TD />
            </TR>
            {isOpen ? (
              <tr id={`audit-detail-${entry.id}`} key={`${entry.id}-detail`}>
                <td colSpan={6} className="px-4 py-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <JsonSnapshot
                      label={t("audit.detail.before")}
                      value={entry.before}
                      emptyNote={t("audit.detail.beforeNull")}
                    />
                    <JsonSnapshot
                      label={t("audit.detail.after")}
                      value={entry.after}
                      emptyNote={t("audit.detail.afterNull")}
                    />
                  </div>
                </td>
              </tr>
            ) : null}
          </Fragment>
        );
      })}
    </tbody>
  );
}

export function AuditLogPage() {
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());

  const objectType = searchParams.get("objectType") ?? "";
  const objectId = searchParams.get("objectId") ?? "";
  const limit = Number(searchParams.get("limit") ?? "50");

  const query = useQuery({
    queryKey: ["audit", objectType, objectId, limit],
    queryFn: () => {
      const params: { objectType?: string; objectId?: string; limit?: number } =
        { limit };
      if (objectType !== "") params.objectType = objectType;
      if (objectId !== "") params.objectId = objectId;
      return listAudit(params);
    },
  });

  const entries = query.data?.entries ?? [];
  const toggle = (id: number): void => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const columns: ReactNode = (
    <THead>
      <tr>
        <TH className="w-12">
          <span className="sr-only">{t("audit.table.expand")}</span>
        </TH>
        <TH>{t("audit.table.timestamp")}</TH>
        <TH>{t("audit.table.actor")}</TH>
        <TH>{t("audit.table.action")}</TH>
        <TH>{t("audit.table.object")}</TH>
        <TH />
      </tr>
    </THead>
  );

  return (
    <>
      <Breadcrumbs
        items={[
          { label: t("breadcrumbs.home"), to: "/" },
          { label: t("nav.audit") },
        ]}
      />
      <PageHeader
        title={t("nav.audit")}
        description={t("audit.description")}
        className="mt-4"
      />

      <div
        role="note"
        className="mt-4 flex items-center gap-2 rounded-sm bg-primary-lightest px-3 py-2 text-caption font-semibold text-primary-dark"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        {t("audit.immutableNote")}
      </div>

      <div className="mt-4">
        <AuditFilters
          objectType={objectType}
          objectId={objectId}
          limit={limit}
          onApply={(next) =>
            setSearchParams(
              {
                objectType: next.objectType,
                objectId: next.objectId,
                limit: String(next.limit),
              },
              { replace: true },
            )
          }
          onReset={() => setSearchParams({}, { replace: true })}
        />
      </div>

      <div className="mt-4">
        {query.isLoading ? (
          <Card aria-busy="true" role="status">
            <Table ariaLabel={t("nav.audit")}>
              {columns}
              <tbody>
                {Array.from({ length: SKELETON_ROWS }, (_, index) => (
                  <tr key={index} className="border-b border-ink-200">
                    {Array.from({ length: 6 }, (_, cell) => (
                      <TD key={cell}>
                        <Skeleton className="h-4 w-full min-w-16" />
                      </TD>
                    ))}
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        ) : query.isError ? (
          <ErrorState
            error={query.error}
            onRetry={() => void query.refetch()}
            className="bg-surface shadow-sm"
          />
        ) : entries.length === 0 ? (
          <Card>
            <EmptyState
              title={t("audit.emptyTitle")}
              description={t("audit.emptyHint")}
            />
          </Card>
        ) : (
          <>
            <Card>
              <Table ariaLabel={t("nav.audit")} zebra>
                {columns}
                <Rows entries={entries} expanded={expanded} onToggle={toggle} />
              </Table>
            </Card>
            <p className="mt-3 text-caption text-ink-600">
              {t("audit.resultCount", { count: entries.length })}
            </p>
          </>
        )}
      </div>
    </>
  );
}

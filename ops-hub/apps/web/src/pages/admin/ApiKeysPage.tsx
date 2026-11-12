import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  type ApiKey,
  type CreatedApiKey,
} from "../../lib/api/admin";
import { problemMessage } from "../../lib/api/problem-message";
import { useT } from "../../lib/i18n";
import { formatDate, formatRelative } from "../../lib/format";
import { Breadcrumbs, PageHeader } from "../../components/ui/Breadcrumbs";
import { Button } from "../../components/ui/Button";

import { Checkbox } from "../../components/ui/Checkbox";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Tag } from "../../components/ui/Tag";
import { useToast } from "../../components/ui/Toast";

/** Static scope catalog (matched to the API's scope checks). */
const SCOPES = [
  "orders:read",
  "orders:write",
  "products:read",
  "products:write",
  "inventory:read",
  "inventory:write",
  "audit:read",
  "admin:write",
] as const;

type ModalStep = "closed" | "form" | "reveal";

function errorDetail(error: unknown, fallback: string): string {
  return problemMessage(error, fallback);
}

/** One-time secret reveal inside the create modal. */
function SecretReveal({
  created,
  onDone,
}: {
  created: CreatedApiKey;
  onDone: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const [saved, setSaved] = useState(false);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(created.secret);
      toast.showToast("success", t("apiKeys.toast.copied"));
    } catch {
      toast.showToast("error", t("apiKeys.toast.copyFailed"));
    }
  };

  return (
    <>
      <div
        role="alert"
        className="flex items-start gap-2 rounded-sm bg-warning-light px-3 py-2.5 text-caption font-semibold text-ink-900"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--flora-warning)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mt-0.5 shrink-0"
          aria-hidden="true"
        >
          <path d="m21.7 18.3-8-14.3a2 2 0 0 0-3.4 0l-8 14.3A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-2.7Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
        {t("apiKeys.reveal.warning")}
      </div>
      <div className="mt-3 flex items-stretch gap-2">
        <code
          dir="ltr"
          className="min-w-0 flex-1 overflow-x-auto rounded-sm bg-ink-100 px-3 py-2.5 font-mono text-body2 text-ink-900"
        >
          {created.secret}
        </code>
        <Button
          variant="outlined"
          size="sm"
          className="shrink-0 self-center"
          onClick={() => void copy()}
        >
          {t("apiKeys.reveal.copy")}
        </Button>
      </div>
      <div className="mt-4 flex flex-col gap-1">
        <Checkbox
          label={t("apiKeys.reveal.confirm")}
          checked={saved}
          onChange={setSaved}
        />
        <p className="text-caption text-ink-500">
          {t("apiKeys.reveal.savedHint")}
        </p>
      </div>
      <Button className="mt-4 w-full" disabled={!saved} onClick={onDone}>
        {t("apiKeys.reveal.done")}
      </Button>
    </>
  );
}

/** Create form: name, scoped checkboxes, optional IP allowlist. */
function CreateKeyForm({
  onSubmit,
  submitting,
}: {
  onSubmit: (body: {
    name: string;
    scopes: string[];
    ipAllowlist?: string[];
  }) => void;
  submitting: boolean;
}) {
  const t = useT();
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<ReadonlySet<string>>(new Set());
  const [ipAllowlist, setIpAllowlist] = useState("");

  const valid = name.trim() !== "" && scopes.size > 0;

  return (
    <form
      id="create-key-form"
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const ips = ipAllowlist
          .split(",")
          .map((ip) => ip.trim())
          .filter((ip) => ip !== "");
        const body: { name: string; scopes: string[]; ipAllowlist?: string[] } =
          {
            name: name.trim(),
            scopes: [...scopes],
          };
        if (ips.length > 0) {
          body.ipAllowlist = ips;
        }
        onSubmit(body);
      }}
    >
      <Input
        label={t("apiKeys.modal.name")}
        placeholder={t("apiKeys.modal.namePlaceholder")}
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-body2 font-semibold text-ink-800">
          {t("apiKeys.modal.scopes")}
        </legend>
        <div className="grid grid-cols-1 gap-2 rounded-sm border border-ink-200 p-3 sm:grid-cols-2">
          {SCOPES.map((scope) => (
            <Checkbox
              key={scope}
              label={
                <span dir="ltr" className="font-mono text-caption">
                  {t(`apiKeys.scope.${scope}`)}
                </span>
              }
              checked={scopes.has(scope)}
              onChange={(checked) =>
                setScopes((current) => {
                  const next = new Set(current);
                  if (checked) {
                    next.add(scope);
                  } else {
                    next.delete(scope);
                  }
                  return next;
                })
              }
            />
          ))}
        </div>
        <p className="text-caption text-ink-500">
          {t("apiKeys.modal.scopesHint")}
        </p>
      </fieldset>
      <Input
        label={t("apiKeys.modal.ipAllowlist")}
        placeholder="203.0.113.7, 198.51.100.22"
        dir="ltr"
        value={ipAllowlist}
        onChange={(event) => setIpAllowlist(event.target.value)}
        hint={t("apiKeys.modal.ipHint")}
      />
      <Button
        type="submit"
        form="create-key-form"
        loading={submitting}
        disabled={!valid}
        className="mt-2"
      >
        {t("apiKeys.modal.create")}
      </Button>
    </form>
  );
}

export function ApiKeysPage() {
  const t = useT();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<ModalStep>("closed");
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);

  const query = useQuery({ queryKey: ["api-keys"], queryFn: listApiKeys });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["api-keys"] });
  };

  const createMutation = useMutation({
    mutationFn: createApiKey,
    onSuccess: (key) => {
      invalidate();
      setCreated(key);
      setStep("reveal");
      toast.showToast("success", t("apiKeys.toast.created"));
    },
    onError: (error) =>
      toast.showToast("error", errorDetail(error, t("state.error"))),
  });

  const revokeMutation = useMutation({
    mutationFn: revokeApiKey,
    onSuccess: () => {
      invalidate();
      setRevokeTarget(null);
      toast.showToast("success", t("apiKeys.toast.revoked"));
    },
    onError: (error) =>
      toast.showToast("error", errorDetail(error, t("state.error"))),
  });

  const closeModal = (): void => {
    setStep("closed");
    setCreated(null);
  };

  const renderScopes = (row: ApiKey) => {
    const visible = row.scopes.slice(0, 2);
    const rest = row.scopes.length - visible.length;
    return (
      <div className="flex max-w-56 flex-wrap gap-1">
        {visible.map((scope) => (
          <Tag key={scope} tone="primary">
            <span dir="ltr" className="font-mono">
              {scope}
            </span>
          </Tag>
        ))}
        {rest > 0 ? (
          <Tag tone="neutral" title={row.scopes.join(", ")}>
            {t("apiKeys.scopesMore", { count: rest })}
          </Tag>
        ) : null}
      </div>
    );
  };

  const columns: Column<ApiKey>[] = [
    {
      key: "name",
      header: t("apiKeys.table.name"),
      render: (row) => (
        <span className="font-semibold text-ink-900">{row.name}</span>
      ),
    },
    {
      key: "keyPrefix",
      header: t("apiKeys.table.keyPrefix"),
      render: (row) => (
        <code dir="ltr" className="font-mono text-caption text-ink-700">
          {row.keyPrefix}…
        </code>
      ),
    },
    { key: "scopes", header: t("apiKeys.table.scopes"), render: renderScopes },
    {
      key: "ipAllowlist",
      header: t("apiKeys.table.ipAllowlist"),
      render: (row) =>
        row.ipAllowlist === null ? (
          <Tag tone="neutral">{t("apiKeys.ipUnrestricted")}</Tag>
        ) : (
          <Tag tone="info" title={row.ipAllowlist.join(", ")}>
            {t("apiKeys.ipCount", { count: row.ipAllowlist.length })}
          </Tag>
        ),
    },
    {
      key: "lastUsedAt",
      header: t("apiKeys.table.lastUsedAt"),
      render: (row) => (
        <span className="whitespace-nowrap text-ink-700">
          {row.lastUsedAt === null
            ? t("apiKeys.neverUsed")
            : formatRelative(row.lastUsedAt)}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: t("apiKeys.table.createdAt"),
      render: (row) => (
        <span className="whitespace-nowrap text-ink-700">
          {formatDate(row.createdAt)}
        </span>
      ),
    },
    {
      key: "status",
      header: t("apiKeys.table.status"),
      render: (row) =>
        row.revokedAt !== null ? (
          <Tag tone="alert">{t("apiKeys.status.revoked")}</Tag>
        ) : (
          <Tag tone="success">{t("apiKeys.status.active")}</Tag>
        ),
    },
    {
      key: "actions",
      header: t("apiKeys.table.actions"),
      render: (row) =>
        row.revokedAt === null ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-alert hover:bg-alert-light"
            onClick={() => setRevokeTarget(row)}
          >
            {t("apiKeys.revoke")}
          </Button>
        ) : null,
    },
  ];

  const rows = query.data?.keys ?? [];
  const activeCount = rows.filter((row) => row.revokedAt === null).length;

  return (
    <>
      <Breadcrumbs
        items={[
          { label: t("breadcrumbs.home"), to: "/" },
          { label: t("nav.apiKeys") },
        ]}
      />
      <PageHeader
        title={t("nav.apiKeys")}
        description={t("apiKeys.description")}
        className="mt-4"
        actions={
          <Button onClick={() => setStep("form")}>
            {t("apiKeys.action.new")}
          </Button>
        }
      />

      <div className="mt-6">
        <DataTable
          columns={columns}
          rows={rows}
          state={query}
          getRowKey={(row) => row.id}
          ariaLabel={t("nav.apiKeys")}
          emptyTitle={t("apiKeys.emptyTitle")}
          emptyDescription={t("apiKeys.emptyHint")}
          emptyAction={
            <Button onClick={() => setStep("form")}>
              {t("apiKeys.action.new")}
            </Button>
          }
          footer={
            rows.length > 0 ? (
              <p className="text-caption text-ink-600">
                {t("table.rows", { count: activeCount })}
              </p>
            ) : undefined
          }
        />
      </div>

      <p className="mt-6 flex items-start gap-2 rounded-sm bg-ink-100 px-3 py-2.5 text-caption text-ink-700">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mt-0.5 shrink-0"
          aria-hidden="true"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        {t("apiKeys.securityNote")}
      </p>

      <Modal
        open={step !== "closed"}
        onClose={closeModal}
        title={
          step === "reveal"
            ? t("apiKeys.reveal.title")
            : t("apiKeys.modal.title")
        }
      >
        {step === "reveal" && created !== null ? (
          <SecretReveal created={created} onDone={closeModal} />
        ) : (
          <CreateKeyForm
            submitting={createMutation.isPending}
            onSubmit={(body) => createMutation.mutate(body)}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        onConfirm={() =>
          revokeTarget !== null && revokeMutation.mutate(revokeTarget.id)
        }
        title={t("apiKeys.revokeConfirmTitle")}
        body={t("apiKeys.revokeConfirmBody", {
          name: revokeTarget?.name ?? "",
        })}
        confirmLabel={t("apiKeys.revokeAction")}
        loading={revokeMutation.isPending}
      />
    </>
  );
}

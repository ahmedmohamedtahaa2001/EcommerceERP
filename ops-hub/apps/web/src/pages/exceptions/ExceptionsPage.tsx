import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useT } from "../../lib/i18n";
import {
  listExceptions,
  assignException,
  resolveException,
  type OrderException,
} from "../../lib/api/orders";
import { useToast } from "../../components/ui/Toast";
import {
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  Table,
  TD,
  TH,
  THead,
  TR,
  Tabs,
  Tag,
} from "../../components/ui";
import { formatRelative } from "../../lib/format";
import { AssignDialog } from "./AssignDialog";
import { ResolveDialog } from "./ResolveDialog";

const SKELETON_ROWS = 6;

function isOverdue(dueAt: string): boolean {
  return new Date(dueAt).getTime() < Date.now();
}

function reasonLabel(code: string, t: (key: string) => string): string {
  const key = `reason.${code}`;
  const label = t(key);
  return label === key ? code : label;
}

function ExceptionRow({
  exception,
  onAssign,
  onResolve,
}: {
  exception: OrderException;
  onAssign: (exception: OrderException) => void;
  onResolve: (exception: OrderException) => void;
}) {
  const t = useT();
  const overdue = isOverdue(exception.dueAt);
  const duplicate = exception.reasonCode === "DUPLICATE_SUSPECTED";

  return (
    <TR>
      <TD>
        <div className="flex flex-col gap-1">
          <Link
            to={`/orders/${encodeURIComponent(exception.orderId)}`}
            className="font-mono text-body2 font-semibold text-info hover:underline"
          >
            {exception.orderId}
          </Link>
          {duplicate ? (
            <Tag tone="secondary">{t("exceptions.duplicateTag")}</Tag>
          ) : null}
        </div>
      </TD>
      <TD>
        <Tag tone={duplicate ? "secondary" : "warning"}>
          {reasonLabel(exception.reasonCode, t)}
        </Tag>
      </TD>
      <TD>
        {exception.ownerId ? (
          <span className="text-body2 text-ink-800">{exception.ownerId}</span>
        ) : (
          <span className="text-ink-400">{t("exceptions.noOwner")}</span>
        )}
      </TD>
      <TD>
        <div
          className={`flex items-center gap-1.5 text-caption ${
            overdue ? "font-semibold text-warning" : "text-ink-500"
          }`}
        >
          {overdue ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          ) : null}
          <time dateTime={exception.dueAt}>
            {formatRelative(exception.dueAt)}
          </time>
          {overdue ? (
            <Tag tone="warning" className="ms-1">
              {t("exceptions.overdue")}
            </Tag>
          ) : null}
        </div>
      </TD>
      <TD>
        {exception.status === "open" ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outlined"
              size="sm"
              onClick={() => onAssign(exception)}
            >
              {t("action.assign")}
            </Button>
            <Button size="sm" onClick={() => onResolve(exception)}>
              {t("action.resolve")}
            </Button>
          </div>
        ) : (
          <span className="text-caption text-ink-600">
            {exception.resolution ?? "—"}
          </span>
        )}
      </TD>
    </TR>
  );
}

export function ExceptionsPage() {
  const t = useT();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("open");
  const [assignTarget, setAssignTarget] = useState<OrderException | null>(null);
  const [resolveTarget, setResolveTarget] = useState<OrderException | null>(
    null,
  );

  const query = useQuery({
    queryKey: ["exceptions", tab],
    queryFn: () => listExceptions({ status: tab }),
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["exceptions"] });
  };

  const assignMutation = useMutation({
    mutationFn: ({ id, ownerId }: { id: string; ownerId: string }) =>
      assignException(id, ownerId),
    onSuccess: (exception) => {
      invalidate();
      setAssignTarget(null);
      toast.showToast(
        "success",
        t("exceptions.toast.assigned", { owner: exception.ownerId ?? "" }),
      );
    },
    onError: () => toast.showToast("error", t("exceptions.toast.failed")),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, resolution }: { id: string; resolution: string }) =>
      resolveException(id, resolution),
    onSuccess: () => {
      invalidate();
      setResolveTarget(null);
      toast.showToast("success", t("exceptions.toast.resolved"));
    },
    onError: () => toast.showToast("error", t("exceptions.toast.failed")),
  });

  const rows = query.data?.exceptions ?? [];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("exceptions.title")}
        description={t("exceptions.description")}
      />

      <Tabs
        items={[
          { id: "open", label: t("exceptions.tab.open") },
          { id: "resolved", label: t("exceptions.tab.resolved") },
        ]}
        value={tab}
        onChange={setTab}
      >
        {query.isLoading ? (
          <div
            role="status"
            aria-busy="true"
            className="rounded-lg bg-surface shadow-sm"
          >
            <Table ariaLabel={t("exceptions.title")}>
              <THead>
                <tr>
                  <TH>{t("exceptions.columns.order")}</TH>
                  <TH>{t("exceptions.columns.reason")}</TH>
                  <TH>{t("exceptions.columns.owner")}</TH>
                  <TH>{t("exceptions.columns.due")}</TH>
                  <TH>{t("exceptions.columns.actions")}</TH>
                </tr>
              </THead>
              <tbody>
                {Array.from({ length: SKELETON_ROWS }, (_, index) => (
                  <tr key={index} className="border-b border-ink-200">
                    {Array.from({ length: 5 }, (_, cell) => (
                      <TD key={cell}>
                        <Skeleton className="h-4 w-full min-w-16" />
                      </TD>
                    ))}
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        ) : query.isError ? (
          <ErrorState
            error={query.error}
            onRetry={() => void query.refetch()}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title={
              tab === "open"
                ? t("exceptions.empty.open.title")
                : t("exceptions.empty.resolved.title")
            }
            description={
              tab === "open"
                ? t("exceptions.empty.open.hint")
                : t("exceptions.empty.resolved.hint")
            }
          />
        ) : (
          <div className="rounded-lg bg-surface shadow-sm">
            <Table ariaLabel={t("exceptions.title")}>
              <THead>
                <tr>
                  <TH>{t("exceptions.columns.order")}</TH>
                  <TH>{t("exceptions.columns.reason")}</TH>
                  <TH>{t("exceptions.columns.owner")}</TH>
                  <TH>{t("exceptions.columns.due")}</TH>
                  <TH>{t("exceptions.columns.actions")}</TH>
                </tr>
              </THead>
              <tbody>
                {rows.map((exception) => (
                  <ExceptionRow
                    key={exception.id}
                    exception={exception}
                    onAssign={setAssignTarget}
                    onResolve={setResolveTarget}
                  />
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Tabs>

      <AssignDialog
        open={assignTarget !== null}
        onClose={() => setAssignTarget(null)}
        onAssign={(ownerId) =>
          assignTarget !== null &&
          assignMutation.mutate({ id: assignTarget.id, ownerId })
        }
        assigning={assignMutation.isPending}
      />
      <ResolveDialog
        open={resolveTarget !== null}
        onClose={() => setResolveTarget(null)}
        onResolve={(resolution) =>
          resolveTarget !== null &&
          resolveMutation.mutate({ id: resolveTarget.id, resolution })
        }
        resolving={resolveMutation.isPending}
      />
    </div>
  );
}

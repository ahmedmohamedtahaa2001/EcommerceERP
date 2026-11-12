import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  Tag,
  useToast,
} from "../../components/ui";
import { problemMessage } from "../../lib/api/problem-message";
import {
  installStarterAutomations,
  listStarterAutomations,
  setAutomationEnabled,
  testRunAutomation,
  type AutomationRun,
} from "../../lib/api/automations";
import { useT } from "../../lib/i18n";

/** Automations (FEATURES.md module 12): the starter set, each switchable and testable. */
export function AgentsPage() {
  const t = useT();
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["automations"],
    queryFn: listStarterAutomations,
  });
  const [lastRun, setLastRun] = useState<AutomationRun | null>(null);

  const fail = (error: unknown) =>
    toast.showToast("error", problemMessage(error, t("state.error")));
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["automations"] });

  const install = useMutation({
    mutationFn: installStarterAutomations,
    onSuccess: async () => {
      toast.showToast("success", t("agents.installed"));
      await refresh();
    },
    onError: fail,
  });
  const toggle = useMutation({
    mutationFn: (input: { key: string; enabled: boolean }) =>
      setAutomationEnabled(input.key, input.enabled),
    onSuccess: refresh,
    onError: fail,
  });
  const run = useMutation({
    mutationFn: testRunAutomation,
    onSuccess: setLastRun,
    onError: fail,
  });

  const automations = query.data?.automations ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("nav.agents")}
        description={t("agents.description")}
      />

      {query.isLoading ? (
        <Skeleton className="h-40" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : automations.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            title={t("agents.empty.title")}
            description={t("agents.empty.body")}
          />
          <div className="mt-4 flex justify-center">
            <Button
              loading={install.isPending}
              onClick={() => install.mutate()}
            >
              {t("agents.install")}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {automations.map((automation) => (
            <Card key={automation.key} className="flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-subtitle1 font-bold text-ink-900">
                  {t(`agents.automation.${automation.key}`)}
                </h3>
                <Tag tone={automation.enabled ? "success" : "neutral"}>
                  {automation.enabled ? t("agents.on") : t("agents.off")}
                </Tag>
              </div>
              <p className="text-body2 text-ink-600">
                {t("agents.trigger")}:{" "}
                {t(`agents.trigger.${automation.triggerEvent}`)}
              </p>
              <div className="mt-auto flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outlined"
                  loading={
                    toggle.isPending && toggle.variables?.key === automation.key
                  }
                  onClick={() =>
                    toggle.mutate({
                      key: automation.key,
                      enabled: !automation.enabled,
                    })
                  }
                >
                  {automation.enabled
                    ? t("agents.turnOff")
                    : t("agents.turnOn")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={run.isPending && run.variables === automation.key}
                  onClick={() => run.mutate(automation.key)}
                >
                  {t("agents.testRun")}
                </Button>
              </div>
              {lastRun?.key === automation.key ? (
                <p
                  role="status"
                  className="rounded-sm bg-ink-100 px-3 py-2 text-caption text-ink-700"
                >
                  {lastRun.ran
                    ? t("agents.testRun.result", {
                        count: lastRun.actions.length,
                      })
                    : t("agents.testRun.skipped")}
                </p>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

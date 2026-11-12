import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { useT } from "../../lib/i18n";
import { listExceptions } from "../../lib/api/orders";
import { Button, Modal, PageHeader } from "../../components/ui";
import { DashboardKpis } from "./DashboardKpis";
import { AttentionPanel } from "./AttentionPanel";

/**
 * Dashboard (`/`, UI_PLAN §7): KPI row, open-exceptions attention panel,
 * and quick actions. Only KPIs backed by real endpoints show numbers;
 * everything else is an explicit "coming soon" tile.
 */
export function DashboardPage() {
  const t = useT();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);

  const openExceptions = useQuery({
    queryKey: ["exceptions", "open"],
    queryFn: () => listExceptions({ status: "open" }),
  });

  const closeCreate = (): void => setCreateOpen(false);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("dashboard.title")}
        description={t("dashboard.description")}
        actions={
          <>
            <Button onClick={() => setCreateOpen(true)}>
              {t("dashboard.quick.createOrder")}
            </Button>
            <Button variant="outlined" onClick={() => void navigate("/orders")}>
              {t("dashboard.quick.goToOrders")}
            </Button>
          </>
        }
      />

      <DashboardKpis
        openExceptions={openExceptions.data?.exceptions.length}
        isLoading={openExceptions.isLoading}
      />

      <AttentionPanel
        exceptions={openExceptions.data?.exceptions}
        isLoading={openExceptions.isLoading}
        isError={openExceptions.isError}
        error={openExceptions.error}
        onRetry={() => void openExceptions.refetch()}
      />

      <Modal
        open={createOpen}
        onClose={closeCreate}
        title={t("dashboard.quick.createOrderTitle")}
        footer={
          <>
            <Button variant="ghost" onClick={closeCreate}>
              {t("action.cancel")}
            </Button>
            <Button
              variant="outlined"
              onClick={() => void navigate("/exceptions")}
            >
              {t("dashboard.quick.goToExceptions")}
            </Button>
            <Button onClick={() => void navigate("/orders")}>
              {t("dashboard.quick.goToOrders")}
            </Button>
          </>
        }
      >
        <p className="text-body2 text-ink-700">
          {t("dashboard.quick.createOrderBody")}
        </p>
      </Modal>
    </div>
  );
}

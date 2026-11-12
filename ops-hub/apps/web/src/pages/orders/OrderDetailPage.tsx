import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useT } from "../../lib/i18n";
import { ApiError } from "../../lib/api/client";
import {
  getOrder,
  validateOrder,
  type OrderValidationResult,
} from "../../lib/api/orders";
import { useToast } from "../../components/ui/Toast";
import {
  Button,
  Card,
  ErrorState,
  PageHeader,
  Skeleton,
  StatusPill,
  Timeline,
} from "../../components/ui";
import { formatDate } from "../../lib/format";
import { OrderDetailsCard } from "./OrderDetailsCard";
import { ValidateOrderDialog } from "./ValidateOrderDialog";

export function OrderDetailPage() {
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { orderId } = useParams<{ orderId: string }>();
  const id = orderId ?? "";

  const [validateOpen, setValidateOpen] = useState(false);
  const [validationResult, setValidationResult] =
    useState<OrderValidationResult | null>(null);

  const orderQuery = useQuery({
    queryKey: ["order", id],
    queryFn: () => getOrder(id),
    enabled: id !== "",
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404
        ? false
        : failureCount < 2,
  });

  const validateMutation = useMutation({
    mutationFn: (locationId: string) => validateOrder(id, locationId),
    onSuccess: (result) => {
      setValidationResult(result);
      void queryClient.invalidateQueries({ queryKey: ["order", id] });
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["exceptions"] });
      const orderNumber = orderQuery.data?.order.orderNumber ?? id;
      if (result.status === "validated") {
        toast.showToast(
          "success",
          t("orders.toast.validated", { orderNumber }),
        );
      } else {
        toast.showToast("warning", t("orders.toast.onHold", { orderNumber }));
      }
    },
    onError: (error) => {
      toast.showToast(
        "error",
        error instanceof ApiError
          ? (error.problem.detail ?? t("state.error"))
          : t("state.error"),
      );
    },
  });

  const isNotFound =
    orderQuery.error instanceof ApiError && orderQuery.error.status === 404;

  if (isNotFound) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={t("orders.detail.notFound.title")} />
        <Card className="p-6">
          <p className="text-body2 text-ink-700">
            {t("orders.detail.notFound.hint")}
          </p>
          <Button
            className="mt-4"
            variant="outlined"
            onClick={() => void navigate("/orders")}
          >
            {t("orders.detail.backToOrders")}
          </Button>
        </Card>
      </div>
    );
  }

  const detail = orderQuery.data;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={detail ? detail.order.orderNumber : t("state.loading")}
        description={detail ? t("orders.detail.detailsTitle") : undefined}
        actions={
          detail ? (
            <Button
              onClick={() => {
                setValidationResult(null);
                setValidateOpen(true);
              }}
            >
              {t("action.validate")}
            </Button>
          ) : null
        }
      />

      {detail ? (
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill kind={{ type: "order", status: detail.order.status }} />
        </div>
      ) : null}

      {orderQuery.isLoading ? (
        <div
          role="status"
          aria-busy="true"
          className="grid grid-cols-1 gap-4 lg:grid-cols-3"
        >
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      ) : orderQuery.isError ? (
        <ErrorState
          error={orderQuery.error}
          onRetry={() => void orderQuery.refetch()}
        />
      ) : detail ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <OrderDetailsCard detail={detail} />
          </div>
          <Card className="p-6">
            <h2 className="text-subtitle2 font-bold text-ink-900">
              {t("orders.detail.timeline.title")}
            </h2>
            <div className="mt-4">
              <Timeline
                items={[
                  {
                    id: "created",
                    title: t("orders.detail.timeline.created"),
                    timestamp: formatDate(detail.order.createdAt),
                  },
                  {
                    id: "updated",
                    title: t("orders.detail.timeline.updated"),
                    timestamp: formatDate(detail.order.updatedAt),
                    meta: (
                      <StatusPill
                        kind={{ type: "order", status: detail.order.status }}
                      />
                    ),
                  },
                ]}
              />
            </div>
            <p className="mt-4 text-caption text-ink-500">
              {t("orders.detail.timeline.eventsSoon")}
            </p>
          </Card>
        </div>
      ) : null}

      <ValidateOrderDialog
        open={validateOpen}
        onClose={() => setValidateOpen(false)}
        onValidate={(locationId) => validateMutation.mutate(locationId)}
        validating={validateMutation.isPending}
        result={validationResult}
      />
    </div>
  );
}

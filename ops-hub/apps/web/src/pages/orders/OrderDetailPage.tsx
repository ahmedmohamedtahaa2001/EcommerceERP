import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useT } from "../../lib/i18n";
import { ApiError } from "../../lib/api/client";
import {
  getOrder,
  listOrderEvents,
  transitionOrder,
  validateOrder,
  type OrderValidationResult,
} from "../../lib/api/orders";
import { useToast } from "../../components/ui/Toast";
import {
  Button,
  Card,
  ConfirmDialog,
  ErrorState,
  Input,
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
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelNote, setCancelNote] = useState("");
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

  const eventsQuery = useQuery({
    queryKey: ["order-events", id],
    queryFn: () => listOrderEvents(id),
    enabled: id !== "",
  });

  const transitionMutation = useMutation({
    mutationFn: (input: { to: string; note?: string }) =>
      transitionOrder(id, input),
    onSuccess: (result) => {
      setCancelOpen(false);
      setCancelNote("");
      void queryClient.invalidateQueries({ queryKey: ["order", id] });
      void queryClient.invalidateQueries({ queryKey: ["order-events", id] });
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.showToast(
        "success",
        t("orders.toast.moved", { status: t(`orderStatus.${result.to}`) }),
      );
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

  const validateMutation = useMutation({
    mutationFn: (locationId: string) => validateOrder(id, locationId),
    onSuccess: (result) => {
      setValidationResult(result);
      void queryClient.invalidateQueries({ queryKey: ["order", id] });
      void queryClient.invalidateQueries({ queryKey: ["order-events", id] });
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
            <div className="flex flex-wrap items-center gap-2">
              {(detail.nextStatuses ?? []).includes("validated") ? (
                <Button
                  onClick={() => {
                    setValidationResult(null);
                    setValidateOpen(true);
                  }}
                >
                  {t("action.validate")}
                </Button>
              ) : null}
              {(detail.nextStatuses ?? [])
                .filter(
                  (status) => status !== "validated" && status !== "cancelled",
                )
                .map((status) => (
                  <Button
                    key={status}
                    variant="outlined"
                    loading={
                      transitionMutation.isPending &&
                      transitionMutation.variables?.to === status
                    }
                    onClick={() => transitionMutation.mutate({ to: status })}
                  >
                    {t(`orders.moveTo.${status}`)}
                  </Button>
                ))}
              {(detail.nextStatuses ?? []).includes("cancelled") ? (
                <Button variant="ghost" onClick={() => setCancelOpen(true)}>
                  {t("orders.moveTo.cancelled")}
                </Button>
              ) : null}
            </div>
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
                items={(eventsQuery.data?.events ?? []).map((event) => ({
                  id: event.id,
                  title:
                    event.toStatus !== null
                      ? t(`orderStatus.${event.toStatus}`)
                      : event.eventType,
                  timestamp: formatDate(event.createdAt),
                  ...(event.note
                    ? {
                        meta: (
                          <span className="text-caption text-ink-600">
                            {event.note}
                          </span>
                        ),
                      }
                    : {}),
                }))}
              />
            </div>
          </Card>
        </div>
      ) : null}

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() =>
          transitionMutation.mutate({
            to: "cancelled",
            ...(cancelNote.trim() ? { note: cancelNote.trim() } : {}),
          })
        }
        title={t("orders.cancel.title")}
        body={
          <div className="flex flex-col gap-3">
            <p>{t("orders.cancel.body")}</p>
            <Input
              label={t("orders.cancel.reason")}
              value={cancelNote}
              onChange={(event) => setCancelNote(event.target.value)}
            />
          </div>
        }
        confirmLabel={t("orders.moveTo.cancelled")}
        loading={transitionMutation.isPending}
      />
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

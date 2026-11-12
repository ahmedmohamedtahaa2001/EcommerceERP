import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { LeafLogo } from "../../layout/icons";

/**
 * Public order tracking (roadmap P1-S5-T06). No authentication: the order
 * number and the customer's phone are both required, and a wrong phone
 * returns the same "not found" as an unknown order.
 */
export function TrackPage() {
  const [params] = useSearchParams();
  const [order, setOrder] = useState(params.get("order") ?? "");
  const [phone, setPhone] = useState(params.get("phone") ?? "");
  const [result, setResult] = useState<{
    orderNumber: string;
    status: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const query = new URLSearchParams({
        order: order.trim(),
        phone: phone.trim(),
      });
      const response = await fetch(`/v1/track?${query.toString()}`);
      if (!response.ok) {
        setError("Order number or phone is not correct.");
        return;
      }
      setResult(
        (await response.json()) as { orderNumber: string; status: string },
      );
    } catch {
      setError("Could not reach the tracking service.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-bg px-4 py-10">
      <div className="flex flex-col items-center gap-3">
        <LeafLogo size={40} className="text-primary" />
        <h1 className="text-h2 font-extrabold text-ink-900">تتبع طلبك</h1>
        <p className="text-body1 text-ink-600">
          Track your order — أدخل رقم الطلب ورقم الهاتف
        </p>
      </div>

      <form
        onSubmit={(event) => void submit(event)}
        className="flex w-full max-w-md flex-col gap-4 rounded-xl border border-ink-200 bg-surface p-6 shadow-sm"
      >
        <label className="flex flex-col gap-2 text-body2 font-semibold text-ink-700">
          Order number · رقم الطلب
          <input
            type="text"
            value={order}
            onChange={(event) => setOrder(event.target.value)}
            placeholder="OP-10001"
            className="rounded border border-ink-300 px-3 py-2 text-body1 font-normal"
          />
        </label>
        <label className="flex flex-col gap-2 text-body2 font-semibold text-ink-700">
          Phone · رقم الهاتف
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="01012345678"
            className="rounded border border-ink-300 px-3 py-2 text-body1 font-normal"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-primary px-4 py-2 font-bold text-white disabled:opacity-60"
        >
          {loading ? "…" : "Track · تتبع"}
        </button>
      </form>

      {result && (
        <div className="w-full max-w-md rounded-xl border border-ink-200 bg-surface p-6">
          <p className="text-caption uppercase text-ink-500">Order · الطلب</p>
          <p className="text-h3 font-extrabold text-ink-900">
            {result.orderNumber}
          </p>
          <p className="mt-2 text-body1 text-ink-700">
            Status · الحالة: {result.status}
          </p>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="w-full max-w-md rounded-lg bg-alert-light px-4 py-3 text-body2 font-semibold text-alert"
        >
          {error}
        </p>
      )}
    </main>
  );
}

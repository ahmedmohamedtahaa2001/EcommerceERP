export interface NotificationTemplate {
  key: string;
  ar: string;
  en: string;
}

export const NOTIFICATION_TEMPLATES: NotificationTemplate[] = [
  {
    key: "confirmed",
    ar: "تم تأكيد طلبك {orderNumber}",
    en: "Your order {orderNumber} is confirmed",
  },
  {
    key: "shipped",
    ar: "تم شحن طلبك {orderNumber}",
    en: "Your order {orderNumber} has shipped",
  },
  {
    key: "out_for_delivery",
    ar: "طلبك {orderNumber} في الطريق إليك",
    en: "Your order {orderNumber} is out for delivery",
  },
  {
    key: "delayed",
    ar: "تأخر طلبك {orderNumber}",
    en: "Your order {orderNumber} is delayed",
  },
  {
    key: "delivered",
    ar: "تم تسليم طلبك {orderNumber}",
    en: "Your order {orderNumber} was delivered",
  },
];

export function renderTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

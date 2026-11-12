import { useT } from "../../lib/i18n";
import {
  SearchBar,
  Select,
  ORDER_STATUSES,
  type SelectOption,
} from "../../components/ui";

export interface OrdersFiltersProps {
  status: string;
  query: string;
  channel: string;
  onStatusChange: (status: string) => void;
  onQueryChange: (query: string) => void;
  onChannelChange: (channel: string) => void;
}

/**
 * Filter bar for the orders list: search, channel select, and the 12-state
 * status chips (UI_PLAN §4 vocabulary). URL-param state is owned by the
 * container.
 */
export function OrdersFilters({
  status,
  query,
  channel,
  onStatusChange,
  onQueryChange,
  onChannelChange,
}: OrdersFiltersProps) {
  const t = useT();

  const channelOptions: readonly SelectOption[] = [
    { value: "", label: t("orders.filter.all") },
    ...CHANNELS.map((value) => ({
      value,
      label: t(`orders.channel.${value}`),
    })),
  ];

  const chips = ["", ...ORDER_STATUSES] as const;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <SearchBar
          className="w-full max-w-sm"
          value={query}
          onChange={onQueryChange}
          placeholder={t("orders.searchPlaceholder")}
          label={t("orders.searchPlaceholder")}
        />
        <div className="w-40">
          <Select
            label={t("orders.filter.channel")}
            options={channelOptions}
            value={channel}
            onChange={(event) => onChannelChange(event.target.value)}
          />
        </div>
      </div>

      <div
        role="group"
        aria-label={t("orders.filter.status")}
        className="flex flex-wrap gap-2"
      >
        {chips.map((value) => {
          const selected = status === value;
          return (
            <button
              key={value === "" ? "all" : value}
              type="button"
              aria-pressed={selected}
              onClick={() => onStatusChange(value)}
              className={`min-h-9 whitespace-nowrap rounded-pill border px-3 text-caption font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                selected
                  ? "border-primary bg-primary text-white"
                  : "border-ink-300 bg-surface text-ink-700 hover:bg-ink-100"
              }`}
            >
              {value === ""
                ? t("orders.filter.all")
                : t(`orderStatus.${value}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const CHANNELS = ["manual", "web", "mobile_app", "whatsapp", "retail"] as const;

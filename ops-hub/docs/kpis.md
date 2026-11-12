# KPI formulas

Every metric the API exposes through `GET /v1/kpis` (optionally filtered with
`?metric=<name>`) and its exact formula. The implementation is
`apps/api/src/kpis/service.ts`; `apps/api/tests/kpis.test.ts` asserts that
this list and the implementation stay in sync.

A "day" means UTC midnight to the next UTC midnight, unless `?date=YYYY-MM-DD`
says otherwise.

| Metric                         | Unit    | Formula                                                                                              |
| ------------------------------ | ------- | ---------------------------------------------------------------------------------------------------- |
| `orders_created`               | count   | Orders whose `created_at` falls in the day                                                           |
| `orders_confirmed`             | count   | Orders in the day whose status is one of `validated, confirmed, allocated, shipped, delivered`       |
| `order_cycle_time_hours`       | hours   | Average hours from `orders.created_at` to `shipments.updated_at` (the order's shipment), rounded     |
| `inventory_accuracy_percent`   | percent | `100 − round(Σ                                                                                       | balance − Σ movements | ÷ movement count)`, floored at 0 |
| `oversold_skus`                | count   | `stock_balances` rows with bucket `on_hand` and quantity below 0                                     |
| `dock_to_stock_hours`          | hours   | Average hours from `receipts.received_at` to `receipts.released_at` for receipts received in the day |
| `shipments_delivered`          | count   | Shipments with status `delivered` created in the day                                                 |
| `shipping_on_time_percent`     | percent | `delivered ÷ (shipped + in_transit + delivered)` × 100, 100 when nothing was delivered               |
| `scan_gap_open`                | count   | Open exceptions with reason code `SCAN_GAP`                                                          |
| `wismo_tickets`                | count   | Tickets of type `wismo` created in the day                                                           |
| `cod_expected_minor`           | minor   | Sum of `payments.amount_minor` for COD payments on orders created in the day                         |
| `cod_collected_minor`          | minor   | The same sum, restricted to payments whose status is `collected`                                     |
| `cod_collection_rate_percent`  | percent | `collected ÷ expected × 100`, 100 when there is nothing expected                                     |
| `cod_unmatched_lines`          | count   | Settlement lines imported in the day that matched no order                                           |
| `cod_unmatched_minor`          | minor   | The sum of those unmatched lines' `amount_minor`                                                     |
| `support_first_response_hours` | hours   | Average hours from `tickets.created_at` to the first inbound message on the ticket                   |
| `support_resolution_hours`     | hours   | Average hours from `tickets.created_at` to `tickets.resolved_at` for tickets resolved in the day     |
| `crm_repeat_rate_percent`      | percent | Customers with more than one order ÷ all customers × 100                                             |
| `crm_unsubscribed`             | count   | Consent rows with purpose `marketing` and `granted = false`                                          |
| `open_exceptions`              | count   | Exceptions whose status is `open`                                                                    |

## Money

All money is integer minor units (piastres) plus an ISO currency code.
`cod_expected_minor` and `cod_collected_minor` are in the order's currency
(`EGP` unless the tenant says otherwise); the percentage metrics are
currency-independent.

## Related thresholds

`POST /v1/alerts/evaluate` turns some of these into alerts. It fires once per
kind per 24-hour window:

| Alert kind            | Trigger                                                        |
| --------------------- | -------------------------------------------------------------- |
| `OVERSOLD`            | `oversold_skus` above the threshold                            |
| `OPEN_EXCEPTIONS`     | `open_exceptions` above the threshold                          |
| `COD_UNMATCHED`       | `cod_expected_minor − cod_collected_minor` above the threshold |
| `COD_COLLECTION_RATE` | `cod_collection_rate_percent` below the threshold              |

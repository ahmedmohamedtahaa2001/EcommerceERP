import { useState } from "react";

import { CustomersView } from "./CustomersView";

/**
 * Customers container (route `/customers`). There is no customers list
 * endpoint to query yet (see hooks.ts), so the container only owns the
 * phone-search input state; when `GET /v1/customers` lands with
 * P3-S12-T01, the `useCustomersQuery` stub in hooks.ts is wired here
 * between the search section and the unified list.
 */
export function CustomersPage() {
  const [inputValue, setInputValue] = useState("");
  const [submittedPhone, setSubmittedPhone] = useState("");

  return (
    <CustomersView
      inputValue={inputValue}
      onInputChange={setInputValue}
      onSubmit={(value) => setSubmittedPhone(value.trim())}
      submittedPhone={submittedPhone}
    />
  );
}

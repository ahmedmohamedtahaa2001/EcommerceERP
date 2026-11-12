export interface CustomerFormValues {
  phone: string;
  fullName: string;
  email: string;
}

export type CustomerFormErrors = Partial<
  Record<keyof CustomerFormValues, "required" | "invalid">
>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Field-level checks shown next to the inputs. The server stays authoritative. */
export function validateCustomerForm(
  values: CustomerFormValues,
): CustomerFormErrors {
  const errors: CustomerFormErrors = {};
  if (values.phone.trim() === "") {
    errors.phone = "required";
  }
  const email = values.email.trim();
  if (email !== "" && !EMAIL_PATTERN.test(email)) {
    errors.email = "invalid";
  }
  return errors;
}

export function buildCustomerPayload(values: CustomerFormValues): {
  phone: string;
  fullName: string | null;
  email: string | null;
} {
  const fullName = values.fullName.trim();
  const email = values.email.trim();
  return {
    phone: values.phone.trim(),
    fullName: fullName === "" ? null : fullName,
    email: email === "" ? null : email,
  };
}

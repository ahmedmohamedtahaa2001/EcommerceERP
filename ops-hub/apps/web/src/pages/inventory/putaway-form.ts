export interface PutawayValues {
  variantId: string;
  binId: string;
  quantity: string;
}

export interface PutawayErrors {
  variantId?: "required";
  binId?: "required";
  quantity?: "invalid";
}

const WHOLE_NUMBER = /^\d+$/;

/** Field checks shown in the dialog. The API stays authoritative for stock limits. */
export function validatePutaway(values: PutawayValues): PutawayErrors {
  const errors: PutawayErrors = {};
  if (values.variantId === "") errors.variantId = "required";
  if (values.binId === "") errors.binId = "required";
  const trimmed = values.quantity.trim();
  if (!WHOLE_NUMBER.test(trimmed) || Number(trimmed) <= 0) {
    errors.quantity = "invalid";
  }
  return errors;
}

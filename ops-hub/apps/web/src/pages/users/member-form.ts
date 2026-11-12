export interface InviteValues {
  email: string;
  fullName: string;
  role: string;
  password: string;
}

export interface InviteErrors {
  email?: "required" | "invalid";
  role?: "required";
  password?: "tooShort";
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 12;

/** Field checks for the add-member dialog. The server enforces the same rules. */
export function validateInvite(values: InviteValues): InviteErrors {
  const errors: InviteErrors = {};
  const email = values.email.trim();
  if (email === "") errors.email = "required";
  else if (!EMAIL.test(email)) errors.email = "invalid";
  if (values.role === "") errors.role = "required";
  if (values.password.length < MIN_PASSWORD_LENGTH)
    errors.password = "tooShort";
  return errors;
}

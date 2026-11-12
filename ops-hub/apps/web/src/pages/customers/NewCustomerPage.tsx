import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button, Input, PageHeader, useToast } from "../../components/ui";
import { ApiError } from "../../lib/api/client";
import { createCustomer } from "../../lib/api/customers";
import { useT } from "../../lib/i18n";
import {
  buildCustomerPayload,
  validateCustomerForm,
  type CustomerFormValues,
} from "./customer-form";

const EMPTY: CustomerFormValues = { phone: "", fullName: "", email: "" };

export function NewCustomerPage() {
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<CustomerFormValues>(EMPTY);
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const errors = validateCustomerForm(values);
  const fieldError = (field: keyof CustomerFormValues) => {
    if (!touched) return null;
    const code = errors[field];
    if (code === "required") return t("customers.form.required");
    if (code === "invalid") return t("customers.form.invalidEmail");
    return null;
  };

  const mutation = useMutation({
    mutationFn: () => createCustomer(buildCustomerPayload(values)),
    onSuccess: async (customer) => {
      toast.showToast("success", t("customers.new.created"));
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      navigate(`/customers/${customer.id}`);
    },
    onError: (error) => {
      const type = error instanceof ApiError ? (error.problem.type ?? "") : "";
      const message = type.endsWith("duplicate-phone")
        ? t("customers.new.duplicatePhone")
        : type.endsWith("duplicate-email")
          ? t("customers.new.duplicateEmail")
          : t("customers.new.createFailed");
      setServerError(message);
      toast.showToast("error", message);
    },
  });

  const submit = () => {
    setTouched(true);
    setServerError(null);
    if (Object.keys(errors).length === 0) {
      mutation.mutate();
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4">
      <nav aria-label="breadcrumb" className="text-caption text-ink-600">
        <Link to="/customers" className="hover:underline">
          {t("customers.detail.back")}
        </Link>
      </nav>
      <PageHeader
        title={t("customers.new.title")}
        description={t("customers.new.description")}
      />
      <form
        className="flex max-w-xl flex-col gap-3 rounded-lg bg-surface p-5 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Input
          label={t("customers.form.name")}
          value={values.fullName}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              fullName: event.target.value,
            }))
          }
        />
        <Input
          label={t("customers.form.phone")}
          value={values.phone}
          onChange={(event) =>
            setValues((current) => ({ ...current, phone: event.target.value }))
          }
          hint={t("customers.form.phoneHint")}
          error={fieldError("phone")}
          inputMode="tel"
          dir="ltr"
          required
        />
        <Input
          label={t("customers.form.email")}
          value={values.email}
          onChange={(event) =>
            setValues((current) => ({ ...current, email: event.target.value }))
          }
          error={fieldError("email")}
          inputMode="email"
          dir="ltr"
        />
        {serverError ? (
          <p role="alert" className="text-body2 text-danger">
            {serverError}
          </p>
        ) : null}
        <div className="flex justify-end">
          <Button type="submit" loading={mutation.isPending}>
            {t("customers.new.submit")}
          </Button>
        </div>
      </form>
    </div>
  );
}

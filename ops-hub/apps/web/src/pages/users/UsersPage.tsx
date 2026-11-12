import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  Skeleton,
  Table,
  Tag,
  TD,
  TH,
  THead,
  TR,
  useToast,
} from "../../components/ui";
import { ApiError } from "../../lib/api/client";
import {
  inviteMember,
  listMembers,
  updateMember,
  type MemberRole,
  type TeamMember,
} from "../../lib/api/users";
import { formatDate } from "../../lib/format";
import { useT } from "../../lib/i18n";
import { MIN_PASSWORD_LENGTH, validateInvite } from "./member-form";

const ROLES: MemberRole[] = [
  "owner",
  "manager",
  "sales_agent",
  "warehouse",
  "finance",
  "support",
  "viewer",
];

function problemDetail(error: unknown): string | undefined {
  return error instanceof ApiError ? error.problem.detail : undefined;
}

export function UsersPage() {
  const t = useT();
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["users"], queryFn: listMembers });
  const [adding, setAdding] = useState(false);
  const [toggling, setToggling] = useState<TeamMember | null>(null);

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: MemberRole }) =>
      updateMember(id, { role }),
    onSuccess: async () => {
      toast.showToast("success", t("users.saved"));
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) =>
      toast.showToast("error", problemDetail(error) ?? t("users.saveFailed")),
  });

  const activeMutation = useMutation({
    mutationFn: (member: TeamMember) =>
      updateMember(member.id, { active: !member.active }),
    onSuccess: async () => {
      setToggling(null);
      toast.showToast("success", t("users.saved"));
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => {
      setToggling(null);
      toast.showToast("error", problemDetail(error) ?? t("users.saveFailed"));
    },
  });

  const members = query.data?.members ?? [];

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4">
      <PageHeader
        title={t("users.title")}
        description={t("users.description")}
        actions={
          <Button onClick={() => setAdding(true)}>{t("users.add")}</Button>
        }
      />

      {query.isLoading ? (
        <Skeleton className="h-40" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : members.length === 0 ? (
        <EmptyState title={t("users.empty")} />
      ) : (
        <div className="rounded-lg bg-surface shadow-sm">
          <Table ariaLabel={t("users.title")} zebra>
            <THead>
              <tr>
                <TH>{t("users.col.name")}</TH>
                <TH>{t("users.col.email")}</TH>
                <TH>{t("users.col.role")}</TH>
                <TH>{t("users.col.status")}</TH>
                <TH>{t("users.col.added")}</TH>
                <TH>
                  <span className="sr-only">{t("users.col.actions")}</span>
                </TH>
              </tr>
            </THead>
            <tbody>
              {members.map((member) => (
                <TR key={member.id}>
                  <TD>{member.fullName ?? "—"}</TD>
                  <TD dir="ltr" className="font-mono">
                    {member.email}
                  </TD>
                  <TD>
                    <select
                      aria-label={t("users.col.role")}
                      value={member.role}
                      onChange={(event) =>
                        roleMutation.mutate({
                          id: member.id,
                          role: event.target.value as MemberRole,
                        })
                      }
                      className="h-9 rounded-sm border border-ink-300 bg-surface px-2 text-body2"
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {t(`role.${role}`)}
                        </option>
                      ))}
                    </select>
                  </TD>
                  <TD>
                    <Tag tone={member.active ? "success" : "neutral"}>
                      {member.active ? t("users.active") : t("users.inactive")}
                    </Tag>
                  </TD>
                  <TD className="text-ink-600">
                    {formatDate(member.createdAt)}
                  </TD>
                  <TD>
                    <Button
                      variant="text"
                      size="sm"
                      onClick={() => setToggling(member)}
                    >
                      {member.active
                        ? t("users.deactivate")
                        : t("users.activate")}
                    </Button>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      <AddMemberModal open={adding} onClose={() => setAdding(false)} />

      <ConfirmDialog
        open={toggling !== null}
        onClose={() => setToggling(null)}
        onConfirm={() => toggling && activeMutation.mutate(toggling)}
        title={
          toggling?.active
            ? t("users.deactivate.title")
            : t("users.activate.title")
        }
        body={
          toggling?.active
            ? t("users.deactivate.body", { name: toggling.email })
            : t("users.activate.body", { name: toggling?.email ?? "" })
        }
        confirmLabel={
          toggling?.active ? t("users.deactivate") : t("users.activate")
        }
        loading={activeMutation.isPending}
      />
    </div>
  );
}

function AddMemberModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [values, setValues] = useState({
    email: "",
    fullName: "",
    role: "manager",
    password: "",
  });
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const errors = validateInvite(values);

  const mutation = useMutation({
    mutationFn: () =>
      inviteMember({
        email: values.email.trim(),
        fullName: values.fullName.trim() || undefined,
        role: values.role as MemberRole,
        password: values.password,
      }),
    onSuccess: async () => {
      toast.showToast("success", t("users.added"));
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      setValues({ email: "", fullName: "", role: "manager", password: "" });
      setTouched(false);
      setServerError(null);
      onClose();
    },
    onError: (error) =>
      setServerError(problemDetail(error) ?? t("users.addFailed")),
  });

  const fieldError = (code: string | undefined, message: string) =>
    touched && code ? message : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("users.add")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("action.cancel")}
          </Button>
          <Button
            loading={mutation.isPending}
            onClick={() => {
              setTouched(true);
              if (Object.keys(errors).length === 0) mutation.mutate();
            }}
          >
            {t("users.add.submit")}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => event.preventDefault()}
      >
        <Input
          label={t("users.form.email")}
          value={values.email}
          onChange={(event) =>
            setValues((current) => ({ ...current, email: event.target.value }))
          }
          error={fieldError(
            errors.email,
            t(
              errors.email === "invalid"
                ? "users.form.emailInvalid"
                : "users.form.required",
            ),
          )}
          dir="ltr"
          inputMode="email"
        />
        <Input
          label={t("users.form.name")}
          value={values.fullName}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              fullName: event.target.value,
            }))
          }
        />
        <label className="flex flex-col gap-1 text-body2 text-ink-800">
          {t("users.col.role")}
          <select
            value={values.role}
            onChange={(event) =>
              setValues((current) => ({ ...current, role: event.target.value }))
            }
            className="h-11 rounded-sm border border-ink-300 bg-surface px-3 text-body1"
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {t(`role.${role}`)}
              </option>
            ))}
          </select>
        </label>
        <Input
          label={t("users.form.password")}
          type="password"
          value={values.password}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              password: event.target.value,
            }))
          }
          hint={t("users.form.passwordHint", { min: MIN_PASSWORD_LENGTH })}
          error={fieldError(
            errors.password,
            t("users.form.passwordShort", { min: MIN_PASSWORD_LENGTH }),
          )}
        />
        {serverError ? (
          <p role="alert" className="text-body2 text-danger">
            {serverError}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}

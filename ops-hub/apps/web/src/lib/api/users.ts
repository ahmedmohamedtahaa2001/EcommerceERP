import { apiFetch } from "./client";

export type MemberRole =
  | "owner"
  | "manager"
  | "sales_agent"
  | "warehouse"
  | "finance"
  | "support"
  | "viewer";

export interface TeamMember {
  id: string;
  userId: string;
  email: string;
  fullName: string | null;
  role: MemberRole;
  active: boolean;
  createdAt: string;
}

/** `GET /v1/users` → 200. */
export function listMembers(): Promise<{ members: TeamMember[] }> {
  return apiFetch<{ members: TeamMember[] }>("/v1/users");
}

/** `POST /v1/users` → 201. The owner sets the first password; the member can change it later. */
export function inviteMember(body: {
  email: string;
  fullName?: string | undefined;
  role: MemberRole;
  password: string;
}): Promise<TeamMember> {
  return apiFetch<TeamMember>("/v1/users", { method: "POST", body });
}

/** `PATCH /v1/users/:id` → 200: change a role, or activate or deactivate. */
export function updateMember(
  id: string,
  body: { role?: MemberRole; active?: boolean },
): Promise<TeamMember> {
  return apiFetch<TeamMember>(`/v1/users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body,
  });
}

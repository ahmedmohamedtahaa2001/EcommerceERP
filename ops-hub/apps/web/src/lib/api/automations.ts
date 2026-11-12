import { apiFetch } from "./client";

export interface StarterAutomation {
  key: string;
  name: string;
  triggerEvent: string;
  enabled: boolean;
}

export interface AutomationRun {
  key: string;
  ran: boolean;
  actions: Array<Record<string, unknown>>;
}

export function listStarterAutomations(): Promise<{
  automations: StarterAutomation[];
}> {
  return apiFetch<{ automations: StarterAutomation[] }>(
    "/v1/starter-automations",
  );
}

export function installStarterAutomations(): Promise<{ created: number }> {
  return apiFetch<{ created: number }>("/v1/starter-automations/install", {
    method: "POST",
  });
}

export function setAutomationEnabled(
  key: string,
  enabled: boolean,
): Promise<{ key: string; enabled: boolean }> {
  return apiFetch(
    `/v1/starter-automations/${encodeURIComponent(key)}/enabled`,
    {
      method: "POST",
      body: { enabled },
    },
  );
}

/** Test run against a sample event: shows what the automation would do, without contacting customers. */
export function testRunAutomation(key: string): Promise<AutomationRun> {
  return apiFetch<AutomationRun>(
    `/v1/starter-automations/${encodeURIComponent(key)}/run`,
    {
      method: "POST",
      body: { payload: {} },
    },
  );
}

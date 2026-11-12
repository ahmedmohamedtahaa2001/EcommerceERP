import { randomUUID } from "node:crypto";

import { InvalidPhoneError, normalizePhone } from "@ops-hub/shared";

import {
  CustomerNotFoundError,
  CustomerValidationError,
  DuplicateCustomerEmailError,
  DuplicateCustomerPhoneError,
} from "./errors";
import type {
  CreateCustomerRequest,
  CustomerAddressRecord,
  CustomerRecord,
  CustomerServiceDeps,
  UpdateCustomerRequest,
} from "./types";

const MAX_NAME_LENGTH = 200;
const MAX_EMAIL_LENGTH = 254;
const MAX_SEARCH_LENGTH = 100;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_CONSTRAINT = "customers_tenant_phone_key";
const EMAIL_CONSTRAINT = "customers_tenant_email_key";

function toPhone(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new CustomerValidationError("phone is required.");
  }
  try {
    return normalizePhone(raw);
  } catch (error) {
    if (error instanceof InvalidPhoneError) {
      throw new CustomerValidationError(
        "phone must be an Egyptian mobile number.",
      );
    }
    throw error;
  }
}

function optionalName(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new CustomerValidationError("fullName must be a string.");
  }
  const trimmed = value.trim();
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new CustomerValidationError(
      `fullName must be at most ${MAX_NAME_LENGTH} characters.`,
    );
  }
  return trimmed === "" ? null : trimmed;
}

function optionalEmail(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new CustomerValidationError("email must be a string.");
  }
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "") return null;
  if (trimmed.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(trimmed)) {
    throw new CustomerValidationError("email must be a valid address.");
  }
  return trimmed;
}

function uniqueConstraint(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const { code, constraint } = error as {
    code?: unknown;
    constraint?: unknown;
  };
  return code === "23505" && typeof constraint === "string"
    ? constraint
    : undefined;
}

export class CustomerService {
  constructor(private readonly deps: CustomerServiceDeps) {}

  async create(
    tenantId: string,
    request: CreateCustomerRequest,
  ): Promise<CustomerRecord> {
    const phone = toPhone(request.phone);
    const now = this.deps.clock.now();
    const record: CustomerRecord = {
      id: randomUUID(),
      tenantId,
      phone,
      fullName: optionalName(request.fullName),
      email: optionalEmail(request.email),
      createdAt: now,
      updatedAt: now,
    };
    try {
      await this.deps.store.create(record);
    } catch (error) {
      throw this.mapUniqueViolation(error, record.phone, record.email);
    }
    return record;
  }

  async update(
    tenantId: string,
    id: string,
    request: UpdateCustomerRequest,
  ): Promise<CustomerRecord> {
    const existing = await this.deps.store.getById(tenantId, id);
    if (!existing) {
      throw new CustomerNotFoundError();
    }

    const fields: Partial<
      Pick<CustomerRecord, "phone" | "fullName" | "email">
    > = {};
    if (request.phone !== undefined) fields.phone = toPhone(request.phone);
    if (request.fullName !== undefined)
      fields.fullName = optionalName(request.fullName);
    if (request.email !== undefined)
      fields.email = optionalEmail(request.email);

    try {
      const updated = await this.deps.store.update(
        tenantId,
        id,
        fields,
        this.deps.clock.now(),
      );
      if (!updated) throw new CustomerNotFoundError();
      return updated;
    } catch (error) {
      if (error instanceof CustomerNotFoundError) throw error;
      throw this.mapUniqueViolation(
        error,
        fields.phone ?? "",
        fields.email ?? "",
      );
    }
  }

  async get(
    tenantId: string,
    id: string,
  ): Promise<{ customer: CustomerRecord; addresses: CustomerAddressRecord[] }> {
    const customer = await this.deps.store.getById(tenantId, id);
    if (!customer) {
      throw new CustomerNotFoundError();
    }
    const addresses = await this.deps.store.listAddresses(tenantId, id);
    return { customer, addresses };
  }

  async list(
    tenantId: string,
    filter: {
      q?: string;
      limit: number;
      cursor?: { createdAt: string; id: string } | null;
    },
  ): Promise<CustomerRecord[]> {
    const q = filter.q?.trim();
    if (q !== undefined && q.length > MAX_SEARCH_LENGTH) {
      throw new CustomerValidationError(
        `q must be at most ${MAX_SEARCH_LENGTH} characters.`,
      );
    }
    return this.deps.store.list(tenantId, {
      ...(q ? { q } : {}),
      limit: filter.limit,
      cursor: filter.cursor ?? null,
    });
  }

  private mapUniqueViolation(
    error: unknown,
    phone: string,
    email: string | null,
  ): unknown {
    const constraint = uniqueConstraint(error);
    if (constraint === PHONE_CONSTRAINT)
      return new DuplicateCustomerPhoneError(phone);
    if (constraint === EMAIL_CONSTRAINT) {
      return new DuplicateCustomerEmailError(email ?? "");
    }
    return error;
  }
}

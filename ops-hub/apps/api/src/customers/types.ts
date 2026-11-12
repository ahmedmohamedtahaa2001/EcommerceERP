export interface CustomerRecord {
  id: string;
  tenantId: string;
  phone: string;
  fullName: string | null;
  email: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerAddressRecord {
  id: string;
  tenantId: string;
  customerId: string;
  line1: string;
  line2: string | null;
  city: string | null;
  governorateCode: string | null;
  rawGovernorate: string | null;
  createdAt: Date;
}

export interface CreateCustomerRequest {
  phone: string;
  fullName?: string | null;
  email?: string | null;
}

export interface UpdateCustomerRequest {
  phone?: string;
  fullName?: string | null;
  email?: string | null;
}

export interface CustomerStore {
  create(record: CustomerRecord): Promise<void>;
  getById(tenantId: string, id: string): Promise<CustomerRecord | null>;
  update(
    tenantId: string,
    id: string,
    fields: Partial<Pick<CustomerRecord, "phone" | "fullName" | "email">>,
    updatedAt: Date,
  ): Promise<CustomerRecord | null>;
  list(
    tenantId: string,
    filter: {
      q?: string;
      limit: number;
      cursor?: { createdAt: string; id: string } | null;
    },
  ): Promise<CustomerRecord[]>;
  listAddresses(
    tenantId: string,
    customerId: string,
  ): Promise<CustomerAddressRecord[]>;
}

export interface CustomerServiceDeps {
  store: CustomerStore;
  clock: { now(): Date };
}

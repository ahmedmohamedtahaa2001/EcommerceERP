import { DomainError } from "@ops-hub/shared";

export class CatalogError extends DomainError {
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(code, message);
    this.statusCode = statusCode;
  }
}

export class CatalogValidationError extends CatalogError {
  constructor(message: string) {
    super("invalid-request", message, 422);
  }
}

export class ProductNotFoundError extends CatalogError {
  constructor() {
    super("product-not-found", "Product not found.", 404);
  }
}

export class VariantNotFoundError extends CatalogError {
  constructor() {
    super("variant-not-found", "Variant not found.", 404);
  }
}

export class DuplicateSkuError extends CatalogError {
  constructor(sku: string) {
    super("duplicate-sku", `SKU already exists: ${sku}`, 409);
  }
}

export class SkuImmutableError extends CatalogError {
  constructor() {
    super("sku-immutable", "SKU cannot be changed once created.", 422);
  }
}

export class DuplicateBarcodeError extends CatalogError {
  constructor(barcode: string) {
    super("duplicate-barcode", `Barcode already exists: ${barcode}`, 409);
  }
}

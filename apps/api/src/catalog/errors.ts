import { AuthError } from "../auth/errors";

export class ProductNotFoundError extends AuthError {
  constructor() {
    super("product-not-found", "Product not found.", 404);
  }
}

export class VariantNotFoundError extends AuthError {
  constructor() {
    super("variant-not-found", "Variant not found.", 404);
  }
}

export class DuplicateSkuError extends AuthError {
  constructor(sku: string) {
    super("duplicate-sku", `SKU already exists: ${sku}`, 409);
  }
}

export class SkuImmutableError extends AuthError {
  constructor() {
    super(
      "sku-immutable",
      "SKU cannot be changed after stock movements exist.",
      409,
    );
  }
}

export class ProductHasStockError extends AuthError {
  constructor() {
    super("product-has-stock", "Product cannot be deleted while stock movements exist.", 409);
  }
}

export class InvalidCatalogInputError extends AuthError {
  constructor(message: string) {
    super("invalid-catalog-input", message, 422);
  }
}

export class BundleComponentError extends AuthError {
  constructor(message: string) {
    super("invalid-bundle-component", message, 422);
  }
}
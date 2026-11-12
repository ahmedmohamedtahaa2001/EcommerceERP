import type { FastifyInstance } from "fastify";

import {
  actorAndTenant,
  requirePermission,
  requirePrincipal,
  type RequestAuthenticator,
} from "../auth/context";
import { recordAudit } from "../audit/record";
import { paginationOf, toPage } from "../platform/list-contract";
import type { AuditWriter } from "../audit/types";
import { CatalogValidationError } from "./errors";
import type { CatalogImportService } from "./import-service";
import { parseCsv, parseXlsx } from "./import-parse";
import type { CatalogService } from "./service";
import type {
  CreateProductRequest,
  CreateVariantRequest,
  UpdateProductRequest,
  UpdateVariantRequest,
} from "./types";

function asObject(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null) {
    throw new CatalogValidationError("A JSON body is required.");
  }
  return body as Record<string, unknown>;
}

/** Copies only the keys that are present, so optional fields are omitted
 * rather than set to `undefined` (required under exactOptionalPropertyTypes). */
function pick<T extends object>(
  source: Record<string, unknown>,
  keys: readonly (keyof T)[],
): T {
  const result = {} as T;
  for (const key of keys) {
    if (source[key as string] !== undefined) {
      result[key] = source[key as string] as T[keyof T];
    }
  }
  return result;
}

export function registerCatalogRoutes(
  app: FastifyInstance,
  options: {
    service: CatalogService;
    requestAuth: RequestAuthenticator;
    audit: AuditWriter;
    importService?: CatalogImportService;
  },
): void {
  const { service, requestAuth, audit, importService } = options;

  app.post(
    "/v1/products",
    { preHandler: requirePermission(requestAuth, "products:write") },
    async (request, reply) => {
      const body = asObject(request.body);
      const { tenantId } = actorAndTenant(requirePrincipal(request));

      const product = await service.createProduct(
        pick<CreateProductRequest>(body, [
          "kind",
          "nameEn",
          "nameAr",
          "descriptionEn",
          "descriptionAr",
          "category",
          "brand",
          "tags",
          "isHazardous",
          "images",
          "status",
        ]),
        tenantId,
      );

      await recordAudit(request, audit, {
        action: "product.created",
        objectType: "product",
        objectId: product.id,
        after: product,
      });

      reply.status(201);
      return product;
    },
  );

  app.get(
    "/v1/products",
    { preHandler: requirePermission(requestAuth, "products:read") },
    async (request) => {
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const { limit, cursor } = paginationOf(request);
      const rows = await service.listProducts(tenantId, {
        limit: limit + 1,
        cursor,
      });
      const page = toPage(rows, limit);
      return { products: page.items, nextCursor: page.nextCursor };
    },
  );

  app.get(
    "/v1/products/:id",
    { preHandler: requirePermission(requestAuth, "products:read") },
    async (request) => {
      const { id } = request.params as { id: string };
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      return service.getProduct(tenantId, id);
    },
  );

  app.patch(
    "/v1/products/:id",
    { preHandler: requirePermission(requestAuth, "products:write") },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = asObject(request.body);
      const { tenantId } = actorAndTenant(requirePrincipal(request));

      const before = await service.getProduct(tenantId, id);
      const updated = await service.updateProduct(
        tenantId,
        id,
        pick<UpdateProductRequest>(body, [
          "nameEn",
          "nameAr",
          "descriptionEn",
          "descriptionAr",
          "category",
          "brand",
          "tags",
          "isHazardous",
          "images",
          "status",
        ]),
      );

      await recordAudit(request, audit, {
        action: "product.updated",
        objectType: "product",
        objectId: id,
        before,
        after: updated,
      });

      return updated;
    },
  );

  app.post(
    "/v1/variants",
    { preHandler: requirePermission(requestAuth, "products:write") },
    async (request, reply) => {
      const body = asObject(request.body);
      const { tenantId } = actorAndTenant(requirePrincipal(request));

      if (typeof body.sku !== "string") {
        throw new CatalogValidationError("sku is required.");
      }

      const variant = await service.createVariant(
        pick<CreateVariantRequest>(body, [
          "productId",
          "sku",
          "barcode",
          "weightGrams",
          "dimensions",
          "priceMinor",
          "currency",
          "attributes",
          "images",
        ]),
        tenantId,
      );

      await recordAudit(request, audit, {
        action: "variant.created",
        objectType: "variant",
        objectId: variant.id,
        after: variant,
      });

      reply.status(201);
      return variant;
    },
  );

  app.get(
    "/v1/products/:productId/variants",
    { preHandler: requirePermission(requestAuth, "products:read") },
    async (request) => {
      const { productId } = request.params as { productId: string };
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      return { variants: await service.listVariants(tenantId, productId) };
    },
  );

  app.get(
    "/v1/variants/:id",
    { preHandler: requirePermission(requestAuth, "products:read") },
    async (request) => {
      const { id } = request.params as { id: string };
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      return service.getVariant(tenantId, id);
    },
  );

  app.patch(
    "/v1/variants/:id",
    { preHandler: requirePermission(requestAuth, "products:write") },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = asObject(request.body);
      const { tenantId } = actorAndTenant(requirePrincipal(request));

      if ("sku" in body) {
        throw new CatalogValidationError(
          "sku cannot be changed once a variant is created.",
        );
      }

      const before = await service.getVariant(tenantId, id);
      const updated = await service.updateVariant(
        tenantId,
        id,
        pick<UpdateVariantRequest>(body, [
          "barcode",
          "weightGrams",
          "dimensions",
          "priceMinor",
          "currency",
          "attributes",
          "images",
        ]),
      );

      await recordAudit(request, audit, {
        action: "variant.updated",
        objectType: "variant",
        objectId: id,
        before,
        after: updated,
      });

      return updated;
    },
  );

  if (importService) {
    app.post(
      "/v1/products/import",
      { preHandler: requirePermission(requestAuth, "products:write") },
      async (request) => {
        const body = asObject(request.body);
        const { tenantId } = actorAndTenant(requirePrincipal(request));

        const format = body.format;
        if (format !== "csv" && format !== "xlsx") {
          throw new CatalogValidationError('format must be "csv" or "xlsx".');
        }
        if (typeof body.content !== "string" || body.content === "") {
          throw new CatalogValidationError("content is required.");
        }
        const dryRun = body.dryRun !== false;

        const rows =
          format === "csv"
            ? parseCsv(body.content)
            : parseXlsx(Buffer.from(body.content, "base64"));

        const result = await importService.import(rows, tenantId, {
          dryRun,
          now: new Date(),
        });

        if (!dryRun && result.createdCount > 0) {
          await recordAudit(request, audit, {
            action: "product.imported",
            objectType: "product",
            objectId: null,
            after: {
              totalRows: result.totalRows,
              createdCount: result.createdCount,
              errorCount: result.errors.length,
            },
          });
        }

        return result;
      },
    );
  }
}

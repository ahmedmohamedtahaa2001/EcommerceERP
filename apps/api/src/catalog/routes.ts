import type { FastifyInstance } from "fastify";

import {
  actorAndTenant,
  requirePermission,
  requirePrincipal,
  type RequestAuthenticator,
} from "../auth/context";
import { ValidationError } from "../auth/errors";
import { recordAudit } from "../audit/record";
import type { AuditWriter } from "../audit/types";
import {
  ProductNotFoundError,
  VariantNotFoundError,
} from "./errors";
import { CatalogService } from "./service";
import type { BundleComponentInput } from "./types";
import { parseImportBuffer } from "./import";

function requireObject(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ValidationError("request body must be an object.");
  }
  return body as Record<string, unknown>;
}

function readOptional(body: Record<string, unknown>, key: string): unknown {
  return body[key];
}

function requireComponents(value: unknown): BundleComponentInput[] {
  if (!Array.isArray(value)) {
    throw new ValidationError("components must be an array.");
  }
  return value as BundleComponentInput[];
}

export function registerCatalogRoutes(
  app: FastifyInstance,
  options: {
    service: CatalogService;
    requestAuth: RequestAuthenticator;
    audit: AuditWriter;
  },
): void {
  const { service, requestAuth, audit } = options;

  app.post(
    "/v1/products",
    { preHandler: requirePermission(requestAuth, "catalog:write") },
    async (request, reply) => {
      const body = requireObject(request.body);
      const input: Parameters<typeof service.createProduct>[0] = {
        nameAr: readOptional(body, "nameAr") as string,
        nameEn: readOptional(body, "nameEn") as string,
      };
      if (body.kind !== undefined) input.kind = readOptional(body, "kind") as never;
      if (body.descriptionAr !== undefined)
        input.descriptionAr = readOptional(body, "descriptionAr") as string | null;
      if (body.descriptionEn !== undefined)
        input.descriptionEn = readOptional(body, "descriptionEn") as string | null;
      if (body.images !== undefined)
        input.images = readOptional(body, "images") as string[];
      if (body.status !== undefined)
        input.status = readOptional(body, "status") as never;

      const created = await service.createProduct(
        input,
        actorAndTenant(requirePrincipal(request)).tenantId,
      );

      await recordAudit(request, audit, {
        action: "product.created",
        objectType: "product",
        objectId: created.id,
        after: created,
      });

      reply.status(201);
      return created;
    },
  );

  app.get(
    "/v1/products",
    { preHandler: requirePermission(requestAuth, "catalog:read") },
    async (request) => {
      const query = request.query as Record<string, unknown>;
      const { limit, offset } = CatalogService.parsePagination(
        query.limit,
        query.offset,
      );
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const products = await service.listProducts(tenantId, limit, offset);
      return { products };
    },
  );

  app.get(
    "/v1/products/:id",
    { preHandler: requirePermission(requestAuth, "catalog:read") },
    async (request) => {
      const { id } = request.params as { id?: string };
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const product = id
        ? await service.getProduct(tenantId, id)
        : null;
      if (!product) throw new ProductNotFoundError();
      const variants = await service.listVariantsByProduct(tenantId, product.id);
      const components =
        product.kind === "bundle"
          ? await service.listComponents(tenantId, product.id)
          : [];
      return { product, variants, components };
    },
  );

  app.patch(
    "/v1/products/:id",
    { preHandler: requirePermission(requestAuth, "catalog:write") },
    async (request) => {
      const { id } = request.params as { id?: string };
      if (!id) throw new ProductNotFoundError();
      const body = requireObject(request.body);
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const before = await service.getProduct(tenantId, id);
      if (!before) throw new ProductNotFoundError();
      const input: Parameters<typeof service.updateProduct>[2] = {};
      if (body.nameAr !== undefined)
        input.nameAr = readOptional(body, "nameAr") as string;
      if (body.nameEn !== undefined)
        input.nameEn = readOptional(body, "nameEn") as string;
      if (body.descriptionAr !== undefined)
        input.descriptionAr = readOptional(body, "descriptionAr") as string | null;
      if (body.descriptionEn !== undefined)
        input.descriptionEn = readOptional(body, "descriptionEn") as string | null;
      if (body.images !== undefined)
        input.images = readOptional(body, "images") as string[];
      if (body.status !== undefined)
        input.status = readOptional(body, "status") as never;
      const updated = await service.updateProduct(tenantId, id, input);

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

  app.delete(
    "/v1/products/:id",
    { preHandler: requirePermission(requestAuth, "catalog:write") },
    async (request, reply) => {
      const { id } = request.params as { id?: string };
      if (!id) throw new ProductNotFoundError();
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const before = await service.getProduct(tenantId, id);
      if (!before) throw new ProductNotFoundError();
      await service.deleteProduct(tenantId, id);

      await recordAudit(request, audit, {
        action: "product.deleted",
        objectType: "product",
        objectId: id,
        before,
      });

      reply.status(204);
    },
  );

  app.post(
    "/v1/products/:id/variants",
    { preHandler: requirePermission(requestAuth, "catalog:write") },
    async (request, reply) => {
      const { id: productId } = request.params as { id?: string };
      if (!productId) throw new ProductNotFoundError();
      const body = requireObject(request.body);
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const input: Parameters<typeof service.createVariant>[2] = {
        sku: readOptional(body, "sku") as string,
      };
      if (body.attributes !== undefined)
        input.attributes = readOptional(body, "attributes") as Record<
          string,
          string
        >;
      if (body.images !== undefined)
        input.images = readOptional(body, "images") as string[];
      const created = await service.createVariant(tenantId, productId, input);

      await recordAudit(request, audit, {
        action: "variant.created",
        objectType: "variant",
        objectId: created.id,
        after: created,
      });

      reply.status(201);
      return created;
    },
  );

  app.get(
    "/v1/variants/:id",
    { preHandler: requirePermission(requestAuth, "catalog:read") },
    async (request) => {
      const { id } = request.params as { id?: string };
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const variant = id ? await service.getVariant(tenantId, id) : null;
      if (!variant) throw new VariantNotFoundError();
      return variant;
    },
  );

  app.patch(
    "/v1/variants/:id",
    { preHandler: requirePermission(requestAuth, "catalog:write") },
    async (request) => {
      const { id } = request.params as { id?: string };
      if (!id) throw new VariantNotFoundError();
      const body = requireObject(request.body);
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const before = await service.getVariant(tenantId, id);
      if (!before) throw new VariantNotFoundError();
      const input: Parameters<typeof service.updateVariant>[2] = {};
      if (body.sku !== undefined)
        input.sku = readOptional(body, "sku") as string;
      if (body.attributes !== undefined)
        input.attributes = readOptional(body, "attributes") as Record<
          string,
          string
        >;
      if (body.images !== undefined)
        input.images = readOptional(body, "images") as string[];
      const updated = await service.updateVariant(tenantId, id, input);

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

  app.delete(
    "/v1/variants/:id",
    { preHandler: requirePermission(requestAuth, "catalog:write") },
    async (request, reply) => {
      const { id } = request.params as { id?: string };
      if (!id) throw new VariantNotFoundError();
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const before = await service.getVariant(tenantId, id);
      if (!before) throw new VariantNotFoundError();
      await service.deleteVariant(tenantId, id);

      await recordAudit(request, audit, {
        action: "variant.deleted",
        objectType: "variant",
        objectId: id,
        before,
      });

      reply.status(204);
    },
  );

  app.put(
    "/v1/products/:id/components",
    { preHandler: requirePermission(requestAuth, "catalog:write") },
    async (request) => {
      const { id } = request.params as { id?: string };
      if (!id) throw new ProductNotFoundError();
      const body = requireObject(request.body);
      const components = requireComponents(readOptional(body, "components"));
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const before = await service.listComponents(tenantId, id);
      const replaced = await service.replaceComponents(tenantId, id, components);

      await recordAudit(request, audit, {
        action: "product.components_replaced",
        objectType: "product",
        objectId: id,
        before,
        after: replaced,
      });

      return { components: replaced };
    },
  );

  app.get(
    "/v1/products/:id/components",
    { preHandler: requirePermission(requestAuth, "catalog:read") },
    async (request) => {
      const { id } = request.params as { id?: string };
      if (!id) throw new ProductNotFoundError();
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const components = await service.listComponents(tenantId, id);
      return { components };
    },
  );

  app.post(
    "/v1/products/import",
    { preHandler: requirePermission(requestAuth, "catalog:write") },
    async (request) => {
      const file = await request.file();
      if (!file) {
        throw new ValidationError("file is required.");
      }
      const buffer = await file.toBuffer();
      const parsed = parseImportBuffer(buffer);
      if (parsed.parseError) {
        throw new ValidationError(parsed.parseError);
      }
      const query = request.query as Record<string, unknown>;
      const dryRun =
        query.dryRun === true ||
        query.dryRun === "true" ||
        query.dryRun === "1";
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const report = await service.importProducts(tenantId, parsed.rows, dryRun);

      await recordAudit(request, audit, {
        action: "product.imported",
        objectType: "product",
        objectId: null,
        after: report,
      });

      return report;
    },
  );
}

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  actorAndTenant,
  requirePermission,
  requirePrincipal,
  type RequestAuthenticator,
} from "../auth/context";
import { recordAudit } from "../audit/record";
import type { AuditWriter } from "../audit/types";
import { OrderValidationError } from "./errors";
import type { DuplicateDetectionService } from "./duplicate-detection-service";
import type { OrderService } from "./service";
import type { OrderValidationService } from "./validation-service";

export function registerOrderRoutes(
  app: FastifyInstance,
  options: {
    service: OrderService;
    validation: OrderValidationService;
    duplicateDetection: DuplicateDetectionService;
    requestAuth: RequestAuthenticator;
    audit: AuditWriter;
  },
): void {
  const { service, validation, duplicateDetection, requestAuth, audit } =
    options;

  app.post(
    "/v1/orders",
    { preHandler: requirePermission(requestAuth, "orders:write") },
    async (request, reply) => {
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const idempotencyKey = request.headers["idempotency-key"];

      const { result, created, duplicate } = await service.createOrder(
        tenantId,
        typeof idempotencyKey === "string" ? idempotencyKey : undefined,
        request.body,
      );

      if (created) {
        await recordAudit(request, audit, {
          action: "order.created",
          objectType: "order",
          objectId: result.order.id,
          after: { ...result, duplicate },
        });
      }

      reply.status(created ? 201 : 200);
      return { ...result, duplicate };
    },
  );

  app.get(
    "/v1/orders/:id",
    { preHandler: requirePermission(requestAuth, "orders:read") },
    async (request) => {
      const { id } = request.params as { id: string };
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      return service.getById(tenantId, id);
    },
  );

  app.get(
    "/v1/orders/:id/events",
    { preHandler: requirePermission(requestAuth, "orders:read") },
    async (request) => {
      const { id } = request.params as { id: string };
      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const query = request.query as {
        customerVisible?: string;
        customer_visible?: string;
        visible?: string;
      };
      const raw =
        query.customerVisible ?? query.customer_visible ?? query.visible;
      const filter: { customerVisible?: boolean } = {};
      if (raw === "true") {
        filter.customerVisible = true;
      } else if (raw === "false") {
        filter.customerVisible = false;
      }
      return { events: await service.listEvents(tenantId, id, filter) };
    },
  );

  const addNoteHandler = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const { id } = request.params as { id: string };
    const body = (
      typeof request.body === "object" && request.body !== null
        ? request.body
        : {}
    ) as Record<string, unknown>;
    const noteValue = body.note ?? body.text ?? body.message ?? body.body;
    if (typeof noteValue !== "string" || noteValue.trim() === "") {
      throw new OrderValidationError("note is required.");
    }
    const visibleRaw =
      body.customerVisible ?? body.customer_visible ?? body.visible;
    const customerVisible = visibleRaw === true || visibleRaw === "true";
    const { actor, tenantId } = actorAndTenant(requirePrincipal(request));
    const event = await service.addNote(
      tenantId,
      id,
      noteValue,
      customerVisible,
      {
        type: actor.kind === "user" ? "user" : "api_key",
        id: actor.id,
      },
    );
    await recordAudit(request, audit, {
      action: "order.note_added",
      objectType: "order",
      objectId: id,
      after: event,
    });
    reply.status(201);
    return event;
  };

  app.post(
    "/v1/orders/:id/events",
    { preHandler: requirePermission(requestAuth, "orders:write") },
    addNoteHandler,
  );

  app.post(
    "/v1/orders/:id/validate",
    { preHandler: requirePermission(requestAuth, "orders:write") },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = (
        typeof request.body === "object" && request.body !== null
          ? request.body
          : {}
      ) as { locationId?: unknown };
      if (typeof body.locationId !== "string" || body.locationId === "") {
        throw new OrderValidationError("locationId is required.");
      }

      const { actor, tenantId } = actorAndTenant(requirePrincipal(request));
      const result = await validation.validate(tenantId, id, body.locationId, {
        type: actor.kind === "user" ? "user" : "api_key",
        id: actor.id,
      });

      await recordAudit(request, audit, {
        action: "order.validated",
        objectType: "order",
        objectId: id,
        after: result,
      });

      return result;
    },
  );

  app.post(
    "/v1/order-exceptions/:id/duplicate-review",
    { preHandler: requirePermission(requestAuth, "orders:write") },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = (
        typeof request.body === "object" && request.body !== null
          ? request.body
          : {}
      ) as { action?: unknown };
      if (body.action !== "accept" && body.action !== "merge") {
        throw new OrderValidationError('action must be "accept" or "merge".');
      }

      const { tenantId } = actorAndTenant(requirePrincipal(request));
      const result = await duplicateDetection.review(tenantId, id, body.action);

      await recordAudit(request, audit, {
        action: "order.duplicate_reviewed",
        objectType: "exception",
        objectId: id,
        after: result,
      });

      return result;
    },
  );
}

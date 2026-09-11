import { strict as assert } from "node:assert";
import test from "node:test";
import type { Express } from "express";
import { registerImageRoutes } from "./routes";

type Handler = (req: any, res: any, next: () => Promise<void>) => unknown;

function responseRecorder() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
}

async function runHandlers(handlers: Handler[], req: any, res: ReturnType<typeof responseRecorder>) {
  let current = 0;
  const next = async (): Promise<void> => {
    const handler = handlers[current++];
    if (handler) await handler(req, res, next);
  };
  await next();
}

test("standalone image generation cannot call OpenAI anonymously or with invalid input", async () => {
  let handlers: Handler[] = [];
  let generateCalls = 0;
  const app = {
    post(_path: string, ...registered: Handler[]) {
      handlers = registered;
    },
  } as unknown as Express;

  registerImageRoutes(app, {
    authenticate: (_req, res: any, _next) => {
      res.status(401).json({ error: "Unauthorized" });
    },
    checkAiCredits: (_req, _res, next) => next(),
    settleAiCredit: async () => true,
    imageClient: {
      images: {
        generate: async () => {
          generateCalls++;
          return { data: [{ url: "https://example.test/image.png" }] };
        },
      },
    },
  });

  const anonymousResponse = responseRecorder();
  await runHandlers(handlers, { body: { prompt: "an image" } }, anonymousResponse);
  assert.equal(anonymousResponse.statusCode, 401);
  assert.equal(generateCalls, 0);

  const invalidResponse = responseRecorder();
  await runHandlers(
    [(_req, _res, next) => next(), ...handlers.slice(1)],
    { user: { claims: { sub: "user-1" } }, body: { prompt: "", size: "1024x1024" } },
    invalidResponse,
  );
  assert.equal(invalidResponse.statusCode, 400);
  assert.equal(generateCalls, 0);
});

test("standalone image generation settles exactly once only after a provider success", async () => {
  let handlers: Handler[] = [];
  let generateCalls = 0;
  const settlements: Array<{ userId: string; type: string }> = [];
  const app = {
    post(_path: string, ...registered: Handler[]) {
      handlers = registered;
    },
  } as unknown as Express;

  registerImageRoutes(app, {
    authenticate: (_req, _res, next) => next(),
    checkAiCredits: (_req, _res, next) => next(),
    settleAiCredit: async (_req, userId, type) => {
      settlements.push({ userId, type });
      return true;
    },
    imageClient: {
      images: {
        generate: async () => {
          generateCalls++;
          return { data: [{ b64_json: "aW1hZ2U=" }] };
        },
      },
    },
  });

  const response = responseRecorder();
  await runHandlers(
    handlers,
    { user: { claims: { sub: "user-2" } }, body: { prompt: "a valid image", size: "512x512" } },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { url: undefined, b64_json: "aW1hZ2U=" });
  assert.equal(generateCalls, 1);
  assert.deepEqual(settlements, [{ userId: "user-2", type: "image" }]);
});

test("standalone image generation does not settle a credit when its provider fails", async () => {
  let handlers: Handler[] = [];
  let settlements = 0;
  const app = {
    post(_path: string, ...registered: Handler[]) {
      handlers = registered;
    },
  } as unknown as Express;

  registerImageRoutes(app, {
    authenticate: (_req, _res, next) => next(),
    checkAiCredits: (_req, _res, next) => next(),
    settleAiCredit: async () => {
      settlements++;
      return true;
    },
    imageClient: {
      images: {
        generate: async () => {
          throw new Error("provider unavailable");
        },
      },
    },
  });

  const response = responseRecorder();
  await runHandlers(
    handlers,
    { user: { claims: { sub: "user-3" } }, body: { prompt: "a valid image" } },
    response,
  );

  assert.equal(response.statusCode, 500);
  assert.equal(settlements, 0);
});
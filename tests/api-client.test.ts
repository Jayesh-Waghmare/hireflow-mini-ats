import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError, requestJson } from "../src/api-client.ts";

test("a dropped read is retried without losing the returned records", async (context) => {
  let calls = 0;
  context.mock.method(globalThis, "fetch", async () => {
    if (++calls === 1) throw new TypeError("fetch failed");
    return Response.json([{ id: "saved" }]);
  });
  assert.deepEqual(await requestJson("/api/candidates"), [{ id: "saved" }]);
  assert.equal(calls, 2);
});

test("a dropped mutation response never causes an automatic second POST", async (context) => {
  let calls = 0;
  context.mock.method(globalThis, "fetch", async () => {
    calls++;
    throw new TypeError("fetch failed");
  });
  await assert.rejects(
    requestJson("/api/candidates", { method: "POST", body: "{}" }),
    /connection was interrupted/i,
  );
  assert.equal(calls, 1);
});

test("HTML service errors are readable and validation errors are not retried", async (context) => {
  context.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response("<html>Internal infrastructure details</html>", {
        status: 502,
      }),
  );
  await assert.rejects(
    requestJson("/api/candidates"),
    (error) =>
      error instanceof ApiError &&
      error.status === 502 &&
      !/html|infrastructure|unexpected token/i.test(error.message),
  );
  let calls = 0;
  context.mock.method(globalThis, "fetch", async () => {
    calls++;
    return Response.json(
      { error: "A candidate with this email already exists." },
      { status: 409 },
    );
  });
  await assert.rejects(
    requestJson("/api/candidates", { method: "POST" }),
    /already exists/,
  );
  assert.equal(calls, 1);
});

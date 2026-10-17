import { test } from "node:test";
import assert from "node:assert/strict";
import { createCandidateHandler } from "../server/candidate-service.ts";
import type { CandidateStore } from "../server/candidate-service.ts";
import type { Candidate } from "../lib/model.ts";

const base = "https://hireflow-mini-ats-kappa.vercel.app/api/candidates";
const input = {
  name: "Test Candidate",
  email: "TEST@EXAMPLE.COM",
  role: "Frontend Developer",
  stage: "Applied",
  location: "Pune",
  skills: "React",
  experience: 2,
  notes: "",
  source: "EarlyJobs",
};

function setup() {
  const records = new Map<string, Candidate[]>();
  const store: CandidateStore = {
    async read(workspace) {
      return structuredClone(records.get(workspace) ?? []);
    },
    async update(workspace, transform) {
      records.set(
        workspace,
        transform(structuredClone(records.get(workspace) ?? [])),
      );
    },
  };
  const handle = createCandidateHandler(store);
  async function initialize() {
    const result = await handle(new Request(base));
    return result.headers.get("set-cookie")!.split(";")[0];
  }
  const request = (
    method: string,
    cookie: string,
    body?: unknown,
    suffix = "",
    origin?: string,
  ) =>
    handle(
      new Request(base + suffix, {
        method,
        headers: { Cookie: cookie, ...(origin ? { Origin: origin } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    );
  return { handle, initialize, request, records };
}

test("Vercel backend owns candidate CRUD, normalized email and timestamped stage history", async () => {
  const { initialize, request } = setup();
  const cookie = await initialize();
  const created = await request("POST", cookie, input);
  assert.equal(created.status, 200);
  const saved = (await created.json()) as { candidate: Candidate };
  let list = (await (await request("GET", cookie)).json()) as Candidate[];
  assert.equal(list.length, 1);
  const candidate = list[0];
  assert.deepEqual(saved.candidate, candidate);
  assert.equal(candidate.email, "test@example.com");
  assert.match(candidate.id, /^[a-f0-9-]{36}$/);
  assert.equal("owner" in candidate, false);
  await request("POST", cookie, {
    ...candidate,
    stage: "Interview",
    notes: "Interview booked",
  });
  list = (await (await request("GET", cookie)).json()) as Candidate[];
  assert.equal(list[0].createdAt, candidate.createdAt);
  assert.equal(list[0].notes, "Interview booked");
  assert.equal(
    JSON.parse(list[0].history)[0].text,
    "Moved from Applied to Interview",
  );
  await request("POST", cookie, { ...list[0], notes: "Updated notes only" });
  list = (await (await request("GET", cookie)).json()) as Candidate[];
  assert.equal(JSON.parse(list[0].history).length, 2);
  assert.equal(
    (await request("DELETE", cookie, undefined, "?id=" + candidate.id)).status,
    200,
  );
  assert.deepEqual(await (await request("GET", cookie)).json(), []);
});

test("validation, duplicates, malformed JSON and request size have correct status codes", async () => {
  const { handle, initialize, request } = setup();
  const cookie = await initialize();
  await request("POST", cookie, input);
  assert.equal(
    (await request("POST", cookie, { ...input, email: "test@example.com" }))
      .status,
    409,
  );
  for (const change of [
    { email: "bad" },
    { experience: -1 },
    { stage: "Invalid" },
    { name: "" },
    { id: "../invalid" },
  ]) {
    assert.equal(
      (await request("POST", cookie, { ...input, ...change })).status,
      400,
    );
  }
  assert.equal(
    (
      await handle(
        new Request(base, {
          method: "POST",
          headers: { Cookie: cookie },
          body: "not-json",
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await handle(
        new Request(base, {
          method: "POST",
          headers: { Cookie: cookie },
          body: "x".repeat(32769),
        }),
      )
    ).status,
    413,
  );
  assert.equal((await request("DELETE", cookie)).status, 400);
});

test("workspace isolation prevents reading and updating another visitor records", async () => {
  const { initialize, request } = setup();
  const first = await initialize();
  const second = await initialize();
  await request("POST", first, input);
  const [candidate] = (await (
    await request("GET", first)
  ).json()) as Candidate[];
  assert.deepEqual(await (await request("GET", second)).json(), []);
  assert.equal((await request("POST", second, candidate)).status, 404);
  await request("DELETE", second, undefined, "?id=" + candidate.id);
  assert.equal(
    ((await (await request("GET", first)).json()) as Candidate[]).length,
    1,
  );
});

test("secure cookies, origin validation and unsupported methods are enforced", async () => {
  const { handle, initialize, request } = setup();
  const start = await handle(
    new Request(base, {
      headers: { Cookie: "hireflow_workspace=../../other" },
    }),
  );
  assert.match(
    start.headers.get("set-cookie")!,
    /HttpOnly; Secure; SameSite=Lax/,
  );
  assert.match(start.headers.get("cache-control")!, /no-store/);
  assert.equal((await request("POST", "", input)).status, 401);
  const cookie = await initialize();
  assert.equal(
    (await request("POST", cookie, input, "", "https://foreign.example"))
      .status,
    403,
  );
  const unsupported = await request("PUT", cookie, input);
  assert.equal(unsupported.status, 405);
  assert.equal(unsupported.headers.get("allow"), "GET, POST, DELETE");
});

test("storage errors are reported without leaking internal details", async () => {
  const handle = createCandidateHandler({
    async read() {
      throw new Error("private-secret-details");
    },
    async update() {},
  });
  const result = await handle(new Request(base));
  assert.equal(result.status, 503);
  assert.doesNotMatch(await result.text(), /private-secret-details/);
});

test("the workspace limit still allows editing and deleting existing candidates", async () => {
  const { initialize, request, records } = setup();
  const cookie = await initialize();
  await request("POST", cookie, input);
  const [workspace, first] = [...records.entries()][0];
  const candidate = first[0];
  records.set(
    workspace,
    Array.from({ length: 500 }, (_, index) => ({
      ...candidate,
      id: index === 0 ? candidate.id : crypto.randomUUID(),
      email: `candidate${index}@example.com`,
    })),
  );
  assert.equal(
    (await request("POST", cookie, { ...input, email: "new@example.com" }))
      .status,
    400,
  );
  assert.equal(
    (
      await request("POST", cookie, {
        ...candidate,
        email: "candidate0@example.com",
        notes: "Still editable",
      })
    ).status,
    200,
  );
  await request("DELETE", cookie, undefined, "?id=" + candidate.id);
  assert.equal(
    (await request("POST", cookie, { ...input, email: "new@example.com" }))
      .status,
    200,
  );
  assert.equal(records.get(workspace)!.length, 500);
});

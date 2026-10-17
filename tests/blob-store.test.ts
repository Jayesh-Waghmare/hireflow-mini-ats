import { test } from "node:test";
import assert from "node:assert/strict";
import { BlobError, BlobPreconditionFailedError } from "@vercel/blob";
import { createBlobCandidateStore } from "../server/blob-store.ts";
import { RequestError } from "../server/candidate-service.ts";
import type { Candidate } from "../lib/model.ts";

const owner = "11111111-1111-4111-8111-111111111111";
const sample = (id: string): Candidate => ({
  id,
  name: "Test",
  email: id + "@example.com",
  role: "Developer",
  stage: "Applied",
  location: "",
  skills: "",
  experience: 0,
  notes: "",
  source: "Other",
  createdAt: "2026-10-17",
  updatedAt: "2026-10-17",
  history: "[]",
});
type Client = NonNullable<Parameters<typeof createBlobCandidateStore>[0]>;

function fixture(conflictOnFirstWrite = false) {
  let document: { records: Candidate[]; etag: string } | null = null;
  let writes = 0;
  const requests: Array<{ path: string; options: Record<string, unknown> }> =
    [];
  const client = {
    async get(path: string, options: Record<string, unknown>) {
      requests.push({ path, options });
      if (!document) return null;
      return {
        statusCode: 200,
        stream: new Response(JSON.stringify(document.records)).body,
        blob: { etag: document.etag },
      };
    },
    async put(path: string, body: string, options: Record<string, unknown>) {
      requests.push({ path, options });
      writes++;
      if (conflictOnFirstWrite && writes === 1) {
        document = { records: [sample("concurrent")], etag: "other-writer" };
        throw new BlobError("This blob already exists");
      }
      if (document && options.ifMatch !== document.etag)
        throw new BlobPreconditionFailedError();
      document = { records: JSON.parse(body), etag: "version-" + writes };
      return { etag: document.etag };
    },
  } as unknown as Client;
  return {
    store: createBlobCandidateStore(client),
    requests,
    writes: () => writes,
  };
}

test("private Vercel storage reads current records and uses conditional writes", async () => {
  const { store, requests } = fixture();
  assert.deepEqual(await store.read(owner), []);
  await store.update(owner, (records) => [...records, sample("first")]);
  await store.update(owner, (records) => [...records, sample("second")]);
  assert.equal((await store.read(owner)).length, 2);
  assert.ok(
    requests.every((r) => r.path === `workspaces/${owner}/candidates.json`),
  );
  assert.ok(requests.every((r) => r.options.access === "private"));
  assert.ok(
    requests
      .filter((r) => "useCache" in r.options)
      .every((r) => r.options.useCache === false),
  );
  assert.ok(requests.some((r) => r.options.ifMatch === "version-1"));
});

test("a concurrent first write is retried without losing the other candidate", async () => {
  const { store, writes } = fixture(true);
  await store.update(owner, (records) => [...records, sample("ours")]);
  assert.deepEqual(
    (await store.read(owner)).map((c) => c.id),
    ["concurrent", "ours"],
  );
  assert.equal(writes(), 2);
});

test("repeated conflicts stop safely instead of silently overwriting data", async () => {
  let writes = 0;
  const store = createBlobCandidateStore({
    async get() {
      return {
        statusCode: 200,
        stream: new Response("[]").body,
        blob: { etag: "old" },
      };
    },
    async put() {
      writes++;
      throw new BlobPreconditionFailedError();
    },
  } as unknown as Client);
  await assert.rejects(
    store.update(owner, (records) => [...records, sample("ours")]),
    (error) => error instanceof RequestError && error.status === 409,
  );
  assert.equal(writes, 5);
});

test("workspace path traversal is rejected before any storage request", async () => {
  const { store, requests } = fixture();
  await assert.rejects(
    store.read("../../other-workspace"),
    /Invalid workspace/,
  );
  assert.equal(requests.length, 0);
});

test("unchanged records do not cause a storage write", async () => {
  const { store, writes } = fixture();
  await store.update(owner, (records) => records);
  assert.equal(writes(), 0);
});

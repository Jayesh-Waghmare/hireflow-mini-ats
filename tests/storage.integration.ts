import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { del, head } from "@vercel/blob";
import { createBlobCandidateStore } from "../server/blob-store.ts";
import type { Candidate } from "../lib/model.ts";

const workspace = randomUUID();
const pathname = `workspaces/${workspace}/candidates.json`;
const store = createBlobCandidateStore();
const record = (name: string): Candidate => ({
  id: randomUUID(),
  name,
  email: name.toLowerCase() + "@example.com",
  role: "Test role",
  stage: "Applied",
  location: "",
  skills: "",
  experience: 0,
  notes: "",
  source: "Other",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  history: "[]",
});

try {
  await store.update(workspace, (records) => [...records, record("First")]);
  assert.equal((await store.read(workspace)).length, 1);
  await Promise.all([
    store.update(workspace, (records) => [...records, record("Second")]),
    store.update(workspace, (records) => [...records, record("Third")]),
  ]);
  assert.deepEqual((await store.read(workspace)).map((c) => c.name).sort(), [
    "First",
    "Second",
    "Third",
  ]);
  const metadata = await head(pathname);
  const unauthenticated = await fetch(metadata.url);
  assert.equal(
    unauthenticated.ok,
    false,
    "Private candidate records must not be publicly readable",
  );
  console.log(
    "PASS: real Vercel storage persists fresh reads, preserves concurrent writes, and blocks unauthenticated reads.",
  );
} finally {
  // Remove only this test's randomly generated document.
  await del(pathname);
}

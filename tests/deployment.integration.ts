import assert from "node:assert/strict";
import { del, get, head } from "@vercel/blob";
import type { Candidate } from "../lib/model.ts";

const base = process.env.BASE_URL;
if (!base) throw new Error("Set BASE_URL to the deployed application");
const initial = await fetch(`${base}/api/candidates`);
assert.equal(initial.status, 200);
const cookie = initial.headers.getSetCookie().find((value) => value.startsWith("hireflow_workspace="))?.split(";")[0];
assert.ok(cookie, "Fresh visitors must receive a workspace cookie");
assert.deepEqual(await initial.json(), []);
const workspace = cookie.split("=")[1];
const pathname = `workspaces/${workspace}/candidates.json`;
const headers = { cookie, "content-type": "application/json", origin: new URL(base).origin };
const candidate = (name: string) => ({ name, email: `${name.toLowerCase()}@example.com`, role: "Frontend Developer", stage: "Applied", location: "Pune", skills: "React", experience: 2, notes: "Temporary deployment verification", source: "Other" });

try {
  const responses = await Promise.all(["First", "Second"].map((name) => fetch(`${base}/api/candidates`, { method: "POST", headers, body: JSON.stringify(candidate(name)) })));
  for (const response of responses) assert.equal(response.ok, true, await response.text());
  for (let index = 0; index < 9; index++) {
    const response: Response = await fetch(`${base}/api/candidates`, { method: "POST", headers, body: JSON.stringify(candidate(`Sequential${index}`)) });
    assert.equal(response.ok, true, await response.text());
  }
  const persisted = await get(pathname, { access: "private", useCache: false });
  assert.ok(persisted?.stream);
  const records = await new Response(persisted.stream).json() as Candidate[];
  assert.equal(records.length, 11);
  assert.ok(records.some((record) => record.name === "First"));
  assert.ok(records.some((record) => record.name === "Second"));
  const metadata = await head(pathname);
  assert.equal((await fetch(metadata.url)).ok, false);
  const other = await fetch(`${base}/api/candidates`);
  assert.deepEqual(await other.json(), []);
  for (const record of records) {
    const response: Response = await fetch(`${base}/api/candidates?id=${record.id}`, { method: "DELETE", headers });
    assert.equal(response.ok, true);
  }
  const final = await fetch(`${base}/api/candidates`, { headers });
  assert.deepEqual(await final.json(), []);
  console.log("PASS: deployed Vercel API writes directly to private Vercel Blob, preserves simultaneous additions, isolates visitors, and deletes records.");
} finally {
  await del(pathname);
}

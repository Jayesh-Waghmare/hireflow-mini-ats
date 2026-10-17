import { get, put, BlobError, BlobPreconditionFailedError } from "@vercel/blob";
import type { Candidate } from "../lib/model.ts";
import type { CandidateStore } from "./candidate-service.ts";
import { RequestError } from "./candidate-service.ts";

type BlobClient = { get: typeof get; put: typeof put };
const validWorkspace =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function pathname(workspace: string) {
  if (!validWorkspace.test(workspace))
    throw new Error("Invalid workspace identifier");
  return `workspaces/${workspace}/candidates.json`;
}

export function createBlobCandidateStore(
  client: BlobClient = { get, put },
): CandidateStore {
  async function snapshot(workspace: string) {
    const result = await client.get(pathname(workspace), {
      access: "private",
      useCache: false,
    });
    if (!result) return { records: [] as Candidate[], etag: undefined };
    if (result.statusCode !== 200 || !result.stream)
      throw new Error("Invalid candidate storage response");
    const records: unknown = await new Response(result.stream).json();
    if (!Array.isArray(records))
      throw new Error("Invalid candidate storage document");
    return { records: records as Candidate[], etag: result.blob.etag };
  }

  return {
    async read(workspace) {
      return (await snapshot(workspace)).records;
    },
    async update(workspace, transform) {
      // Conditional writes prevent one request from overwriting another request's changes.
      for (let attempt = 0; attempt < 5; attempt++) {
        const current = await snapshot(workspace);
        const next = transform(current.records);
        if (next === current.records) return;
        try {
          await client.put(pathname(workspace), JSON.stringify(next), {
            access: "private",
            addRandomSuffix: false,
            contentType: "application/json",
            allowOverwrite: Boolean(current.etag),
            ...(current.etag ? { ifMatch: current.etag } : {}),
          });
          return;
        } catch (error) {
          const conflict =
            error instanceof BlobPreconditionFailedError ||
            (error instanceof BlobError &&
              /already exists/i.test(error.message));
          if (!conflict) throw error;
        }
      }
      throw new RequestError(
        409,
        "Candidate records changed during saving. Please try again.",
      );
    },
  };
}

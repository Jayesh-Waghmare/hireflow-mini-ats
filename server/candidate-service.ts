import { randomUUID } from "node:crypto";
import { candidateInput } from "../lib/model.ts";
import type { Candidate } from "../lib/model.ts";

export interface CandidateStore {
  read(workspace: string): Promise<Candidate[]>;
  update(
    workspace: string,
    transform: (records: Candidate[]) => Candidate[],
  ): Promise<void>;
}

export class RequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const response = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });

function workspaceCookie(request: Request) {
  const value = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)hireflow_workspace=([^;]+)/)?.[1];
  return value && uuid.test(value) ? value : undefined;
}

export function createCandidateHandler(store: CandidateStore) {
  return async function handleCandidates(request: Request): Promise<Response> {
    if (!["GET", "POST", "DELETE"].includes(request.method)) {
      const result = response({ error: "Method not allowed." }, 405);
      result.headers.set("Allow", "GET, POST, DELETE");
      return result;
    }

    const url = new URL(request.url);
    const origin = request.headers.get("origin");
    if (request.method !== "GET" && origin && origin !== url.origin) {
      return response({ error: "Invalid origin." }, 403);
    }

    const existingWorkspace = workspaceCookie(request);
    try {
      if (request.method === "GET") {
        const workspace = existingWorkspace ?? randomUUID();
        const records = await store.read(workspace);
        const result = response(records);
        if (!existingWorkspace) {
          result.headers.set(
            "Set-Cookie",
            `hireflow_workspace=${workspace}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`,
          );
        }
        return result;
      }

      if (!existingWorkspace)
        return response({ error: "Reload to initialize your workspace." }, 401);

      if (request.method === "DELETE") {
        const id = url.searchParams.get("id");
        if (!id || !uuid.test(id))
          return response({ error: "A valid candidate ID is required." }, 400);
        await store.update(existingWorkspace, (records) =>
          records.some((c) => c.id === id)
            ? records.filter((c) => c.id !== id)
            : records,
        );
        return response({ ok: true });
      }

      const body = await request.text();
      if (Buffer.byteLength(body, "utf8") > 32768)
        return response({ error: "Candidate request is too large." }, 413);
      let raw: Record<string, unknown>;
      try {
        raw = JSON.parse(body);
      } catch {
        return response({ error: "Invalid JSON request." }, 400);
      }
      const parsed = candidateInput.safeParse(raw);
      if (!parsed.success)
        return response({ error: parsed.error.issues[0].message }, 400);
      if (
        raw.id !== undefined &&
        (typeof raw.id !== "string" || !uuid.test(raw.id))
      ) {
        return response({ error: "A valid candidate ID is required." }, 400);
      }

      const input = parsed.data;
      const id = typeof raw.id === "string" ? raw.id : randomUUID();
      const now = new Date().toISOString();
      await store.update(existingWorkspace, (records) => {
        if (records.some((c) => c.email === input.email && c.id !== raw.id)) {
          throw new RequestError(
            409,
            "A candidate with this email already exists.",
          );
        }
        if (raw.id) {
          const previous = records.find((c) => c.id === id);
          if (!previous) throw new RequestError(404, "Candidate not found.");
          const history = JSON.parse(previous.history);
          if (previous.stage !== input.stage)
            history.unshift({
              text: `Moved from ${previous.stage} to ${input.stage}`,
              at: now,
            });
          const updated = {
            ...previous,
            ...input,
            updatedAt: now,
            history: JSON.stringify(history),
          };
          return records.map((c) => (c.id === id ? updated : c));
        }
        if (records.length >= 500)
          throw new RequestError(
            400,
            "Demo limit: 500 candidates per workspace.",
          );
        return [
          ...records,
          {
            ...input,
            id,
            createdAt: now,
            updatedAt: now,
            history: JSON.stringify([
              { text: `Added to ${input.stage}`, at: now },
            ]),
          },
        ];
      });
      return response({ ok: true });
    } catch (error) {
      if (error instanceof RequestError)
        return response({ error: error.message }, error.status);
      console.error(
        "Candidate storage operation failed:",
        error instanceof Error ? error.name : "UnknownError",
      );
      return response(
        { error: "Could not access candidate records. Please retry." },
        503,
      );
    }
  };
}

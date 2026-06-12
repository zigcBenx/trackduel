// Thin HTTP client for the World Athletics proxy API.
//
// Deliberately NOT importing "server-only": the seed script consumes this
// layer from plain Node, where that package throws. The module still must
// never reach the browser — it lives under src/server and reads server env.
import type { z } from "zod";

import { env } from "~/env";

type ErrorKind = "http" | "parse" | "timeout" | "network";

export class WorldAthleticsError extends Error {
  readonly kind: ErrorKind;
  readonly status?: number;
  readonly endpoint: string;

  constructor(opts: {
    kind: ErrorKind;
    endpoint: string;
    message: string;
    status?: number;
    cause?: unknown;
  }) {
    super(`[world-athletics ${opts.endpoint}] ${opts.message}`, {
      cause: opts.cause,
    });
    this.name = "WorldAthleticsError";
    this.kind = opts.kind;
    this.status = opts.status;
    this.endpoint = opts.endpoint;
  }
}

export interface WaFetchOptions<T> {
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  searchParams?: Record<string, string | number | undefined>;
  /** Next.js data-cache revalidation in seconds. Required so every endpoint
   * makes a conscious caching decision; ignored when running outside Next
   * (e.g. the seed script). */
  revalidate: number;
  tags?: string[];
  timeoutMs?: number;
}

export async function waFetch<T>(
  path: string,
  {
    schema,
    searchParams,
    revalidate,
    tags,
    timeoutMs = 15_000,
  }: WaFetchOptions<T>,
): Promise<T> {
  const url = new URL(path, env.WORLD_ATHLETICS_API_URL);
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
      next: { revalidate, tags },
    });
  } catch (cause) {
    const isTimeout =
      cause instanceof DOMException &&
      (cause.name === "TimeoutError" || cause.name === "AbortError");
    throw new WorldAthleticsError({
      kind: isTimeout ? "timeout" : "network",
      endpoint: path,
      message: isTimeout
        ? `timed out after ${timeoutMs}ms`
        : "network request failed",
      cause,
    });
  }

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { message?: string };
      if (typeof body.message === "string") message = body.message;
    } catch {
      // non-JSON error body; keep statusText
    }
    throw new WorldAthleticsError({
      kind: "http",
      endpoint: path,
      status: res.status,
      message: `upstream responded ${res.status}: ${message}`,
    });
  }

  const json: unknown = await res.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new WorldAthleticsError({
      kind: "parse",
      endpoint: path,
      message: "response did not match expected schema (upstream drift?)",
      cause: parsed.error,
    });
  }
  return parsed.data;
}

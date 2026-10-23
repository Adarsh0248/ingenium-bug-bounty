import type { Audience } from "./types";
export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status = 0,
    readonly outcome = "UNKNOWN",
  ) {
    super(code);
  }
}
const messages: Record<string, string> = {
  STAFF_CONFIRMATION_REQUIRED:
    "Confirmation failed. Re-enter your own current staff code.",
  INVALID_CODE: "That access code is not available.",
  INVALID_SESSION:
    "Your session is no longer available. Organiser approval is required to restore access.",
  INVALID_FLOW: "This entry has expired. Enter your code again.",
  RATE_LIMITED: "Too many requests. Please wait a moment.",
  CSRF_DENIED:
    "Your request context changed. Restore the session before continuing.",
  CLOCK_UNTRUSTED:
    "Competition time is being checked. Actions are temporarily unavailable.",
  JUDGE_UNAVAILABLE: "Judging is temporarily unavailable.",
  RESTORE_QUARANTINED: "The event is offline for recovery checks. Actions remain unavailable.",
  PAYLOAD_EXPIRED: "This code or diagnostic payload is no longer retained. Results and history are still available.",
  DRAFT_TOO_LARGE:
    "The draft exceeds 128 KiB. Your text has not been truncated.",
  DIRTY_BUFFER_CAPACITY:
    "The tab's unsaved-code limit has been reached. Save or review another draft first.",
  NETWORK:
    "Connection interrupted. The previous action may have been received.",
  UNAVAILABLE: "The event service is unavailable.",
};
export const errorText = (error: unknown) =>
  error instanceof ApiError
    ? (messages[error.code] ??
      `Request unavailable: ${error.code.toLowerCase().replaceAll("_", " ")}.`)
    : error instanceof Error
      ? (messages[error.message] ??
        "The action could not be completed. Your current code is retained.")
      : "The action could not be completed.";
export function createApi(fetcher: typeof fetch = fetch) {
  const tokens = new Map<Audience, string>();
  let invalid: ((audience: Audience) => void) | undefined;
  async function request<T>(
    path: string,
    body?: unknown,
    audience: Audience = "PARTICIPANT",
  ): Promise<T> {
    if (
      !path.startsWith("/api/v1/") ||
      path.includes("\\") ||
      path.includes("#")
    )
      throw new ApiError("INVALID_PATH", 0, "NOT_PROCESSED");
    let response: Response;
    try {
      response = await fetcher(path, {
        method: body === undefined ? "GET" : "POST",
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        headers: {
          accept: "application/json",
          ...(body === undefined
            ? {}
            : {
                "content-type": "application/json",
                "x-csrf-token": tokens.get(audience) ?? "",
              }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      throw new ApiError("NETWORK");
    }
    let value: any;
    try {
      if (!response.headers.get("content-type")?.includes("application/json"))
        throw new Error();
      const reader = response.body!.getReader(),
        decoder = new TextDecoder("utf-8", { fatal: true });
      let text = "",
        bytes = 0;
      // Two valid 1 MiB case fields can expand to 12 MiB when JSON escapes NULs.
      const maxBytes =
        audience === "STAFF" &&
        body === undefined &&
        /^\/api\/v1\/staff\/content\/versions\/[0-9a-f-]{36}\/cases\/[0-9a-f-]{36}$/.test(
          path,
        )
          ? 16777216
          : 8388608;
      try {
        for (;;) {
          const part = await reader.read();
          if (part.done) break;
          bytes += part.value.length;
          if (bytes > maxBytes) throw new Error();
          text += decoder.decode(part.value, { stream: true });
        }
        text += decoder.decode();
      } finally {
        await reader.cancel().catch(() => {});
      }
      value = JSON.parse(text);
      if (value?.schema_version !== 1 || typeof value.trace_id !== "string")
        throw new Error();
    } catch {
      throw new ApiError("NETWORK");
    }
    if (value.error) {
      const failure = new ApiError(
        value.error.code,
        response.status,
        value.error.outcome,
      );
      if (response.status === 401) invalid?.(audience);
      throw failure;
    }
    if (
      !Object.hasOwn(value, "data") ||
      (!response.ok && response.status !== 409)
    )
      throw new ApiError("NETWORK");
    return value.data as T;
  }
  return {
    request,
    setToken(audience: Audience, token: string) {
      tokens.set(audience, token);
    },
    onInvalid(handler: (audience: Audience) => void) {
      invalid = handler;
    },
    clear() {
      tokens.clear();
    },
    async bootstrap(audience: Audience) {
      const result = await request<any>(
        `/api/v1/bootstrap?audience=${audience}`,
        undefined,
        audience,
      );
      tokens.set(audience, result.csrf_token);
      return result;
    },
  };
}
export type Api = ReturnType<typeof createApi>;

// Unknown commands retain their receipt identity. Reconnect never replays a write.
export class Command {
  private pending: {
    path: string;
    body: Record<string, unknown>;
    key: string;
    outcomePath: string;
  } | null = null;
  private busy = false;
  constructor(
    private api: Api,
    private round: string,
    private changed: () => void = () => {},
    private audience: "PARTICIPANT" | "STAFF" | "STAFF_RECOVERY" = "PARTICIPANT",
  ) {}
  get unresolved() {
    return this.pending !== null;
  }
  async send(
    path: string,
    body: Record<string, unknown>,
    outcomePrefix = `/api/v1/${this.audience !== "PARTICIPANT" ? "staff/" : ""}competition/rounds/${this.round}/outcomes`,
  ) {
    if (this.pending || this.busy)
      throw new ApiError("COMMAND_UNRESOLVED", 0, "NOT_PROCESSED");
    const key = crypto.randomUUID();
    this.pending = {
      path,
      body: { ...body, request_key: key },
      key,
      outcomePath: `${outcomePrefix}/${key}`,
    };
    this.changed();
    return this.dispatch();
  }
  private async dispatch() {
    if (!this.pending || this.busy)
      throw new ApiError("COMMAND_UNRESOLVED", 0, "NOT_PROCESSED");
    this.busy = true;
    const intent = this.pending;
    try {
      const result = await this.api.request<any>(
        intent.path,
        intent.body,
        this.audience,
      );
      this.pending = null;
      return result;
    } catch (error) {
      if (error instanceof ApiError && error.outcome === "NOT_PROCESSED")
        this.pending = null;
      throw error;
    } finally {
      // Staff confirmation codes are one-shot; GET-only receipt recovery never needs them.
      if (this.audience !== "PARTICIPANT" && this.pending) this.pending.body = {};
      this.busy = false;
      this.changed();
    }
  }
  async recover() {
    if (!this.pending || this.busy) return null;
    const result = await this.api.request<any>(
      this.pending.outcomePath,
      undefined,
      this.audience,
    );
    const receipt = result.outcome ?? result.receipt;
    if (result.status === "OBSERVED" && receipt) {
      this.pending = null;
      this.changed();
      return receipt;
    }
    return null;
  }
}

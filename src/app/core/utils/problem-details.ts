/**
 * Reads RFC 9457 problem details — the shape `GlobalExceptionHandler` returns
 * for every services-portal endpoint.
 *
 * The server is the only thing that knows *why* it refused. A client that
 * throws that away and toasts "Something went wrong" turns a fixable answer
 * ("An insurance certificate is required on your profile") into a dead end, so
 * every refusal a user can act on goes through here.
 *
 * `AuthController` is deliberately not covered: its own try/catch blocks return
 * bespoke `{ message }` / `{ errors: [] }` shapes that predate this handler.
 * That is backlog item B6, not this file's problem.
 */

/** The subset of RFC 9457 the API actually sends. */
interface ProblemBody {
  title?: string;
  detail?: string;
  status?: number;
  /** Present on 400s only, from `ValidationProblemDetails`. Keys are PascalCase property paths. */
  errors?: Record<string, string[]>;
}

function body(error: unknown): ProblemBody | null {
  const payload = (error as { error?: unknown })?.error;
  // A network failure puts a ProgressEvent here, and a non-JSON 500 puts a
  // string. Neither is problem details, and neither should be read as one.
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  return payload as ProblemBody;
}

/** The HTTP status, or undefined if this isn't an `HttpErrorResponse` at all. */
export function problemStatus(error: unknown): number | undefined {
  const status = (error as { status?: unknown })?.status;
  return typeof status === 'number' ? status : undefined;
}

/**
 * The control name an Angular form would use for a server property path.
 * `TotalPrice` → `totalPrice`; `PriceBreakdown[0].Description` → `priceBreakdown`,
 * because that is the name the `FormArray` is registered under — nothing is
 * bound to the indexed path.
 */
function controlName(propertyPath: string): string {
  const head = propertyPath.split(/[[.]/)[0];
  return head.charAt(0).toLowerCase() + head.slice(1);
}

/** Validation messages keyed by form-control name. Empty for anything that isn't a 400 with `errors`. */
export function problemFieldErrors(error: unknown): Record<string, string[]> {
  const errors = body(error)?.errors;
  if (!errors) return {};

  const byControl: Record<string, string[]> = {};
  for (const [path, messages] of Object.entries(errors)) {
    const name = controlName(path);
    byControl[name] = [...(byControl[name] ?? []), ...messages];
  }
  return byControl;
}

/** Every validation message, flattened, in the order the server listed them. */
export function problemMessages(error: unknown): string[] {
  const errors = body(error)?.errors;
  return errors ? Object.values(errors).flat() : [];
}

/**
 * The most specific human-readable sentence available.
 *
 * `detail` first (403/404/409 carry the real reason there), then the first
 * validation message (a 400's `title` is the generic "One or more validation
 * errors occurred." and says nothing), then `title`, then the caller's fallback.
 */
export function problemDetail(error: unknown, fallback: string): string {
  const problem = body(error);
  if (problem?.detail) return problem.detail;

  const [firstMessage] = problemMessages(error);
  if (firstMessage) return firstMessage;

  return problem?.title || fallback;
}

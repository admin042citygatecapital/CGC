type ErrorLike = {
  name?: unknown;
  code?: unknown;
  cause?: unknown;
};

const SAFE_IDENTIFIER = /^[A-Za-z0-9_.-]{1,80}$/;

function safeIdentifier(value: unknown): string | undefined {
  return typeof value === 'string' && SAFE_IDENTIFIER.test(value) ? value : undefined;
}

/**
 * Return diagnostic metadata that cannot include query text, bound parameters,
 * credentials, request bodies, stacks, or nested driver error messages.
 */
export function safeApiErrorDetails(error: unknown): { type: string; code?: string } {
  if (!error || typeof error !== 'object') return { type: 'NonErrorThrow' };

  const outer = error as ErrorLike;
  const cause = outer.cause && typeof outer.cause === 'object'
    ? outer.cause as ErrorLike
    : undefined;
  const type = safeIdentifier(outer.name) ?? 'Error';
  const code = safeIdentifier(outer.code) ?? safeIdentifier(cause?.code);
  return code ? { type, code } : { type };
}

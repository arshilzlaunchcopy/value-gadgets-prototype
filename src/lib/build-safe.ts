/**
 * Wraps generateStaticParams() so a database hiccup at build time degrades to
 * "render on demand" (dynamicParams) instead of failing the whole deploy.
 * A misconfigured environment is still caught earlier, in next.config.ts.
 */
export async function staticParamsSafe<T>(label: string, fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[build] ${label}: static params unavailable (${msg}); these pages will render on first request.`);
    return [];
  }
}

export const DEFAULT_API_TIMEOUT_MS = 12_000;

export async function fetchWithTimeout(input, init = {}, {
  timeoutMs = DEFAULT_API_TIMEOUT_MS,
  fetchImpl = fetch,
} = {}) {
  const controller = new AbortController();
  const callerSignal = init.signal;
  let timedOut = false;

  const relayAbort = () => controller.abort(callerSignal?.reason);
  if (callerSignal?.aborted) relayAbort();
  else callerSignal?.addEventListener("abort", relayAbort, { once: true });

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetchImpl(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (!timedOut) throw error;
    const timeoutError = new Error("The request took too long. Checking the latest session status.");
    timeoutError.code = "REQUEST_TIMEOUT";
    throw timeoutError;
  } finally {
    clearTimeout(timeout);
    callerSignal?.removeEventListener("abort", relayAbort);
  }
}

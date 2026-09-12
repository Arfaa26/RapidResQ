export class MLUnavailableError extends Error {}

export async function mlRequest<T>(endpoint: '/analyze' | '/health' | '/duplicates' | '/hotspots' | '/evaluation', body?: FormData | object): Promise<T> {
  const base = process.env.ML_SERVICE_URL?.replace(/\/$/, '');
  if (!base) throw new MLUnavailableError('ML service is not configured.');
  const timeout = Number(process.env.ML_TIMEOUT_MS || 8000);
  const headers: Record<string, string> = {};
  if (process.env.ML_SERVICE_KEY) headers['X-ML-Service-Key'] = process.env.ML_SERVICE_KEY;
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  try {
    const response = await fetch(`${base}${endpoint}`, {
      method: body ? 'POST' : 'GET', headers,
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(Number.isFinite(timeout) ? Math.min(15000, Math.max(100, timeout)) : 8000),
    });
    if (!response.ok) throw new MLUnavailableError(`ML service returned HTTP ${response.status}.`);
    return await response.json() as T;
  } catch (error) {
    if (error instanceof MLUnavailableError) throw error;
    throw new MLUnavailableError('ML service unavailable or timed out.');
  }
}

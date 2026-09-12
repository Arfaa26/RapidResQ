export class MLUnavailableError extends Error {}

export async function mlRequest<T>(endpoint: '/analyze' | '/health' | '/duplicates' | '/hotspots' | '/evaluation', body?: FormData | object): Promise<T> {
  const base = process.env.ML_SERVICE_URL?.replace(/\/$/, '');
  if (!base) throw new MLUnavailableError('ML service is not configured.');
  const gradio = process.env.ML_SERVICE_TRANSPORT === 'gradio';
  const timeout = Number(process.env.ML_TIMEOUT_MS || (gradio ? 45000 : 8000));
  const signal = AbortSignal.timeout(Number.isFinite(timeout) ? Math.min(gradio ? 45000 : 15000, Math.max(100, timeout)) : 8000);
  const headers: Record<string, string> = {};
  if (process.env.ML_SERVICE_KEY) headers['X-ML-Service-Key'] = process.env.ML_SERVICE_KEY;
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  try {
    if (gradio) return await gradioRequest<T>(base, endpoint, body, signal);
    const response = await fetch(`${base}${endpoint}`, {
      method: body ? 'POST' : 'GET', headers,
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
      signal,
    });
    if (!response.ok) throw new MLUnavailableError(`ML service returned HTTP ${response.status}.`);
    return await response.json() as T;
  } catch (error) {
    if (error instanceof HostedInferenceError) throw new MLUnavailableError(error.message);
    if (error instanceof MLUnavailableError) throw error;
    throw new MLUnavailableError('ML service unavailable or timed out.');
  }
}
import { gradioRequest, HostedInferenceError } from './gradioClient.js';

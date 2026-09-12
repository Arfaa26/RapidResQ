export class HostedInferenceError extends Error {}

/** Gradio's documented POST + SSE result protocol, using server-side secrets only. */
export async function gradioRequest<T>(base: string, endpoint: string, body: FormData | object | undefined, signal: AbortSignal): Promise<T> {
  let payload: object = body || {};
  if (body instanceof FormData) {
    const fields: Record<string, string> = {};
    for (const [name, value] of body.entries()) {
      if (typeof value === 'string') fields[name] = value;
      else {
        if (value.size > 4 * 1024 * 1024) throw new Error('Maximum upload is 4 MB');
        fields.media = Buffer.from(await value.arrayBuffer()).toString('base64');
        fields.mimeType = value.type;
      }
    }
    payload = fields;
  }
  const submitted = await fetch(`${base}/gradio_api/call/dispatch`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
    body: JSON.stringify({ data: [{ endpoint, body: payload }, process.env.ML_SERVICE_KEY || ''] }),
  });
  if (!submitted.ok) throw new Error('Hosted ML queue unavailable');
  const { event_id: eventId } = await submitted.json() as { event_id?: string };
  if (!eventId || !/^[a-zA-Z0-9_-]{1,100}$/.test(eventId)) throw new Error('Invalid ML queue response');
  const result = await fetch(`${base}/gradio_api/call/dispatch/${eventId}`, { signal });
  if (!result.ok || !result.body) throw new Error('Hosted ML result unavailable');
  const reader = result.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer = (buffer + decoder.decode(value, { stream: !done })).replace(/\r\n/g, '\n');
      if (buffer.length > 8 * 1024 * 1024) throw new Error('ML result exceeds limit');
      let boundary: number;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const event = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const lines = event.split('\n');
        const type = lines.find(line => line.startsWith('event:'))?.slice(6).trim();
        if (type === 'error') {
          const details = lines.filter(line => line.startsWith('data:')).join(' ').toLowerCase();
          if (details.includes('quota') || details.includes('daily limit')) {
            throw new HostedInferenceError('The free AI host has reached its GPU usage limit. Analysis can resume when the provider resets the quota. You can submit for authority review now.');
          }
          if (details.includes('sign in') || details.includes('log in') || details.includes('authenticated')) {
            throw new HostedInferenceError('The free AI host requires an authenticated GPU request. You can submit for authority review while the hosting connection is updated.');
          }
          throw new HostedInferenceError('The AI host could not complete this request. Retry shortly or submit for authority review.');
        }
        if (type === 'complete') {
          const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
          const outputs = JSON.parse(data) as unknown;
          if (!Array.isArray(outputs) || outputs.length !== 1 || !outputs[0] || typeof outputs[0] !== 'object') {
            throw new Error('Invalid hosted ML output');
          }
          return outputs[0] as T;
        }
      }
      if (done) throw new Error('Hosted ML stream ended before completion');
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

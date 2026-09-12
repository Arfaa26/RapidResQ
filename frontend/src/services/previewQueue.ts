/** Finish one request at a time and skip drafts replaced while it was running. */
export function createPreviewQueue<T>() {
  let tail = Promise.resolve();
  return {
    run(task: () => Promise<T>, signal: AbortSignal): Promise<T | undefined> {
      const result = tail.then(() => signal.aborted ? undefined : task());
      tail = result.then(() => undefined, () => undefined);
      return result;
    },
  };
}

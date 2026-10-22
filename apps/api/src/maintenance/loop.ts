export function maintenanceLoop(
  work: () => Promise<unknown>,
  intervalMs: number,
  failed: () => void,
) {
  let closing = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active: Promise<unknown>;
  const tick = () => {
    active = Promise.resolve()
      .then(work)
      .catch(failed)
      .finally(() => {
        if (!closing) {
          timer = setTimeout(tick, intervalMs);
          timer.unref();
        }
      });
  };
  tick();
  return async () => {
    closing = true;
    if (timer) clearTimeout(timer);
    await active;
  };
}

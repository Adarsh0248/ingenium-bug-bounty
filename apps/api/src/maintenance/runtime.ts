import type { Pool } from "pg";
import { performance } from "node:perf_hooks";
import type { ClockGuard } from "../access/transaction.js";
import { maintenanceLoop } from "./loop.js";
import { maintenanceTasks } from "./tasks.js";

export function startEventMaintenance(
  pool: Pool,
  clock: ClockGuard,
  report: (task: string) => void,
) {
  const tasks = maintenanceTasks(pool, clock);
  const intervals = {
    rounds: 1000,
    validation: 5000,
    deliveries: 10000,
    quotas: 60000,
  };
  const stop = (Object.keys(intervals) as (keyof typeof intervals)[]).map(
    (task) => {
      let reported = -Infinity;
      return maintenanceLoop(tasks[task], intervals[task], () => {
        if (performance.now() - reported >= 60000) {
          reported = performance.now();
          report(task);
        }
      });
    },
  );
  return {
    async close() {
      await Promise.all(stop.map((close) => close()));
    },
  };
}

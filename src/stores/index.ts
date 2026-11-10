import { useApp } from "./app";
import { useOps } from "./ops";
import { usePeople } from "./people";
import { useSupply } from "./supply";

/** Load saved demo data from the browser, seeding fresh data the first time. Call from useEffect only. */
export async function hydrateStores() {
  await Promise.all([
    useApp.persist.rehydrate(),
    useOps.persist.rehydrate(),
    usePeople.persist.rehydrate(),
    useSupply.persist.rehydrate(),
  ]);
  const now = Date.now();
  if (!useSupply.getState().seeded) useSupply.getState().seed(now);
  if (!useOps.getState().seeded) useOps.getState().seed(now);
  if (!usePeople.getState().seeded) usePeople.getState().seed(now);
  useApp.getState().setHydrated(true);
}

export function resetDemoData() {
  const now = Date.now();
  useSupply.getState().seed(now);
  useOps.getState().seed(now);
  usePeople.getState().seed(now);
}

export { useApp, useCurrentUser } from "./app";
export { useOps, useMyOpenShift } from "./ops";
export { usePeople } from "./people";
export { useSupply } from "./supply";

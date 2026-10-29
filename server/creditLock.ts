import { AsyncLocalStorage } from "node:async_hooks";
const current = new AsyncLocalStorage<{ owner: string; active: boolean }>();
const queues = new Map<string, Promise<void>>();
/** One writer per account in this application instance; nested balance reads are safe. */
export async function withCreditLock<T>(owner: string, action: () => Promise<T>): Promise<T> {
  const held = current.getStore();
  if (held?.owner === owner && held.active) return action();
  const previous = queues.get(owner) || Promise.resolve();
  let release!: () => void;
  const done = new Promise<void>(resolve => { release = resolve; });
  queues.set(owner, done);
  await previous;
  const scope = { owner, active: true };
  try { return await current.run(scope, action); }
  finally { scope.active = false; release(); if (queues.get(owner) === done) queues.delete(owner); }
}

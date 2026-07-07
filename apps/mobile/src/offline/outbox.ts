import AsyncStorage from "@react-native-async-storage/async-storage";

// Durable, ordered queue of pending writes. Every op is idempotent (given the
// server's set-log + create-by-id endpoints), so replaying after a crash is
// safe. Backed by AsyncStorage — adequate for a habit tracker's write volume;
// swap the persist()/load() pair for expo-sqlite if the queue ever grows large.
const KEY = "habitflow.outbox.v1";

export type HabitCreatePayload = {
    id: string;
    name: string;
    goal: number;
    icon?: string;
    tod?: string;
    verb?: string;
};

export type HabitPatch = {
    name?: string;
    goal?: number;
    icon?: string;
    tod?: string;
    verb?: string;
};

/** A queued op, with a stable `key` (for removal) and enqueue timestamp. */
export type Op = { key: string; ts: number } & (
    | { kind: "habit.create"; payload: HabitCreatePayload }
    | { kind: "habit.update"; id: string; patch: HabitPatch }
    | { kind: "habit.delete"; id: string }
    | {
          kind: "log.set";
          habitId: string;
          year: number;
          month: number;
          day: number;
          completed: boolean;
      }
);

/** The same op shapes, before a key/ts is assigned. */
export type NewOp =
    | { kind: "habit.create"; payload: HabitCreatePayload }
    | { kind: "habit.update"; id: string; patch: HabitPatch }
    | { kind: "habit.delete"; id: string }
    | {
          kind: "log.set";
          habitId: string;
          year: number;
          month: number;
          day: number;
          completed: boolean;
      };

type State = { ops: Op[]; counter: number };

let state: State = { ops: [], counter: 0 };
let loaded = false;
const listeners = new Set<() => void>();

function notify() {
    for (const l of listeners) l();
}

// Serialize read-modify-write so overlapping enqueue/remove calls can't clobber
// each other across the AsyncStorage round-trip.
let lock: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = lock.then(fn, fn);
    lock = run.then(
        () => {},
        () => {},
    );
    return run;
}

async function persist() {
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
}

/** Load the persisted queue once at startup. Safe to call repeatedly. */
export async function loadOutbox(): Promise<void> {
    if (loaded) return;
    try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) state = JSON.parse(raw) as State;
    } catch {
        /* corrupt payload — start clean rather than wedge the app */
    }
    loaded = true;
    notify();
}

export function subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => {
        listeners.delete(l);
    };
}

/** Current queue (stable reference until the next mutation). */
export function getOps(): Op[] {
    return state.ops;
}

export function pendingCount(): number {
    return state.ops.length;
}

function nextKey(): string {
    state.counter += 1;
    return String(state.counter);
}

function touchesHabit(o: Op, id: string): boolean {
    switch (o.kind) {
        case "habit.create":
            return o.payload.id === id;
        case "habit.update":
        case "habit.delete":
            return o.id === id;
        case "log.set":
            return o.habitId === id;
    }
}

/**
 * Append an op, coalescing against what's already queued so the queue stays
 * small and internally consistent:
 *  - log.set on the same (habit, date) → keep only the latest,
 *  - habit.update folds into a pending create, or merges with a pending update,
 *  - habit.delete drops all pending work for that habit; if the habit was
 *    created offline and never synced, the create is dropped too (net no-op).
 */
export function enqueue(input: NewOp): Promise<void> {
    return withLock(async () => {
        let ops = state.ops.slice();

        switch (input.kind) {
            case "log.set": {
                ops = ops.filter(
                    (o) =>
                        !(
                            o.kind === "log.set" &&
                            o.habitId === input.habitId &&
                            o.year === input.year &&
                            o.month === input.month &&
                            o.day === input.day
                        ),
                );
                ops.push({ ...input, key: nextKey(), ts: Date.now() });
                break;
            }
            case "habit.update": {
                const create = ops.find(
                    (o) =>
                        o.kind === "habit.create" && o.payload.id === input.id,
                );
                if (create && create.kind === "habit.create") {
                    create.payload = { ...create.payload, ...input.patch };
                    break;
                }
                const existing = ops.find(
                    (o) => o.kind === "habit.update" && o.id === input.id,
                );
                if (existing && existing.kind === "habit.update") {
                    existing.patch = { ...existing.patch, ...input.patch };
                    break;
                }
                ops.push({ ...input, key: nextKey(), ts: Date.now() });
                break;
            }
            case "habit.delete": {
                const bornOffline = ops.some(
                    (o) =>
                        o.kind === "habit.create" && o.payload.id === input.id,
                );
                ops = ops.filter((o) => !touchesHabit(o, input.id));
                // If it never reached the server, create+delete cancel out.
                if (!bornOffline) {
                    ops.push({ ...input, key: nextKey(), ts: Date.now() });
                }
                break;
            }
            case "habit.create": {
                ops.push({ ...input, key: nextKey(), ts: Date.now() });
                break;
            }
        }

        state.ops = ops;
        await persist();
        notify();
    });
}

/** Remove a synced (or permanently-failed) op by key. */
export function removeOp(key: string): Promise<void> {
    return withLock(async () => {
        state.ops = state.ops.filter((o) => o.key !== key);
        await persist();
        notify();
    });
}

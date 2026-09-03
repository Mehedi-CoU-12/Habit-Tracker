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
    target?: number | null;
    unit?: string | null;
    step?: number;
    fillFromFocus?: boolean;
    /** Weekdays the habit is due on, 0 = Sunday. Empty/absent = daily. */
    daysOfWeek?: number[];
};

export type HabitPatch = {
    name?: string;
    goal?: number;
    icon?: string;
    tod?: string;
    verb?: string;
    target?: number | null;
    unit?: string | null;
    step?: number;
    fillFromFocus?: boolean;
    daysOfWeek?: number[];
    /** Archive (true) or restore (false); the server stamps the date. */
    archived?: boolean;
};

/** One day's note. Absolute like log.set — empty text clears the day. */
export type DayNotePayload = {
    year: number;
    month: number;
    day: number;
    text: string;
};

export type FocusRecordPayload = {
    /** Client-generated — makes the server-side record idempotent on replay. */
    id: string;
    habitId: string | null;
    minutes: number;
    year: number;
    month: number;
    day: number;
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
    | {
          kind: "log.amount";
          habitId: string;
          year: number;
          month: number;
          day: number;
          amount: number;
      }
    | {
          kind: "skip.set";
          habitId: string;
          year: number;
          month: number;
          day: number;
          used: boolean;
      }
    | { kind: "note.set"; payload: DayNotePayload }
    | { kind: "focus.record"; payload: FocusRecordPayload }
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
      }
    | {
          kind: "log.amount";
          habitId: string;
          year: number;
          month: number;
          day: number;
          amount: number;
      }
    | {
          kind: "skip.set";
          habitId: string;
          year: number;
          month: number;
          day: number;
          used: boolean;
      }
    | { kind: "note.set"; payload: DayNotePayload }
    | { kind: "focus.record"; payload: FocusRecordPayload };

type State = { ops: Op[]; counter: number };

let state: State = { ops: [], counter: 0 };
let loaded = false;
// Key of the op the sync worker is currently dispatching. Its request body is
// already serialized and in flight, so coalescing must never mutate, fold into,
// or cancel it — doing so silently drops the folded write (see enqueue).
let inFlightKey: string | null = null;
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

/**
 * Load the persisted queue once. Safe to call repeatedly. Runs under the same
 * lock as enqueue/removeOp (with a double-check) so an early write on cold start
 * can't compute off the empty default and clobber the on-disk queue.
 */
export async function loadOutbox(): Promise<void> {
    if (loaded) return;
    await withLock(async () => {
        if (loaded) return;
        try {
            const raw = await AsyncStorage.getItem(KEY);
            const parsed = raw ? (JSON.parse(raw) as unknown) : null;
            // Adopt the stored value ONLY if it's a well-formed State. A valid-
            // JSON-but-wrong-shape payload would otherwise yield NaN keys (a
            // single removeOp would then drop every op) or throw in the drain.
            if (
                parsed !== null &&
                typeof parsed === "object" &&
                Array.isArray((parsed as State).ops) &&
                typeof (parsed as State).counter === "number"
            ) {
                state = parsed as State;
            }
        } catch {
            /* corrupt payload — start clean rather than wedge the app */
        }
        loaded = true;
    });
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
        case "log.amount":
        case "skip.set":
            return o.habitId === id;
        // Dedication history outlives the habit: deleting a habit must not
        // drop its queued sessions — the server records them unlinked.
        case "focus.record":
        // A day note belongs to the day, not to any habit.
        case "note.set":
            return false;
    }
}

/**
 * Append an op, coalescing against what's already queued so the queue stays
 * small and internally consistent:
 *  - log.set / log.amount on the same (habit, date) → keep only the latest,
 *  - habit.update folds into a pending create, or merges with a pending update,
 *  - habit.delete drops all pending work for that habit; if the habit was
 *    created offline and never synced, the create is dropped too (net no-op).
 */
export async function enqueue(input: NewOp): Promise<void> {
    // Ensure the persisted queue is loaded before we compute off it, or the
    // first write on cold start would overwrite it with just this one op.
    await loadOutbox();
    return withLock(async () => {
        let ops = state.ops.slice();

        switch (input.kind) {
            case "skip.set": {
                // One skip state per (habit, date), so an earlier queued write
                // for the same cell is superseded — except an in-flight one,
                // whose body is already sent; the idempotent PUT converges on
                // the next drain. Deliberately NOT coalesced against log.set:
                // a skip and a completion are different facts about the day.
                ops = ops.filter(
                    (o) =>
                        o.key === inFlightKey ||
                        !(
                            o.kind === "skip.set" &&
                            o.habitId === input.habitId &&
                            o.year === input.year &&
                            o.month === input.month &&
                            o.day === input.day
                        ),
                );
                ops.push({ ...input, key: nextKey(), ts: Date.now() });
                break;
            }
            case "log.set":
            case "log.amount": {
                // Supersede any earlier queued write for this cell, but keep an
                // in-flight one (its request is already sent); the new op wins
                // on the next drain and the idempotent write converges. Both
                // kinds address the same cell, so each supersedes the other —
                // a tick followed by a step must leave only the step.
                ops = ops.filter(
                    (o) =>
                        o.key === inFlightKey ||
                        !(
                            (o.kind === "log.set" || o.kind === "log.amount") &&
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
                // Fold into a pending create/update ONLY if it isn't in flight —
                // folding into an in-flight op mutates it after its body was
                // serialized, so the edit would never reach the server.
                const create = ops.find(
                    (o) =>
                        o.kind === "habit.create" &&
                        o.payload.id === input.id &&
                        o.key !== inFlightKey,
                );
                if (create && create.kind === "habit.create") {
                    create.payload = { ...create.payload, ...input.patch };
                    break;
                }
                const existing = ops.find(
                    (o) =>
                        o.kind === "habit.update" &&
                        o.id === input.id &&
                        o.key !== inFlightKey,
                );
                if (existing && existing.kind === "habit.update") {
                    existing.patch = { ...existing.patch, ...input.patch };
                    break;
                }
                ops.push({ ...input, key: nextKey(), ts: Date.now() });
                break;
            }
            case "habit.delete": {
                // create+delete cancel out only if the create is still queued
                // AND not already dispatching. If its create is in flight the
                // server will have the habit, so a real delete must be sent.
                const bornOffline = ops.some(
                    (o) =>
                        o.kind === "habit.create" &&
                        o.payload.id === input.id &&
                        o.key !== inFlightKey,
                );
                // Drop this habit's other pending work, but never the op that is
                // mid-dispatch (removing it can't recall the in-flight request).
                ops = ops.filter(
                    (o) => o.key === inFlightKey || !touchesHabit(o, input.id),
                );
                if (!bornOffline) {
                    ops.push({ ...input, key: nextKey(), ts: Date.now() });
                }
                break;
            }
            case "note.set": {
                // One note per day, so an earlier queued edit for the same day
                // is superseded — except an in-flight one, whose body is
                // already sent; the idempotent PUT converges on the next drain.
                ops = ops.filter(
                    (o) =>
                        o.key === inFlightKey ||
                        !(
                            o.kind === "note.set" &&
                            o.payload.year === input.payload.year &&
                            o.payload.month === input.payload.month &&
                            o.payload.day === input.payload.day
                        ),
                );
                ops.push({ ...input, key: nextKey(), ts: Date.now() });
                break;
            }
            case "habit.create":
            case "focus.record": {
                // Never coalesced — every op is a distinct fact.
                ops.push({ ...input, key: nextKey(), ts: Date.now() });
                break;
            }
        }

        const prev = state.ops;
        state.ops = ops;
        try {
            await persist();
        } catch (err) {
            // Persist failed (e.g. storage full) — roll back so memory matches
            // disk, then surface the error instead of silently losing the write.
            state.ops = prev;
            throw err;
        } finally {
            notify();
        }
    });
}

/** Remove a synced (or permanently-failed) op by key. */
export async function removeOp(key: string): Promise<void> {
    await loadOutbox();
    return withLock(async () => {
        state.ops = state.ops.filter((o) => o.key !== key);
        await persist();
        notify();
    });
}

/**
 * Mark which op is currently mid-dispatch (or null when none). Coalescing in
 * enqueue treats the in-flight op as immutable, since its request body is
 * already serialized and on the wire.
 */
export function markInFlight(key: string | null): void {
    inFlightKey = key;
}

/**
 * Wipe the queue — called on sign-out so one user's pending writes can never
 * replay under the next account signed in on this device.
 */
export async function clearOutbox(): Promise<void> {
    return withLock(async () => {
        state = { ops: [], counter: 0 };
        inFlightKey = null;
        loaded = true;
        try {
            await AsyncStorage.removeItem(KEY);
        } catch {
            /* best-effort — the in-memory queue is already empty */
        }
        notify();
    });
}

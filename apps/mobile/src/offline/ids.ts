import { nanoid } from "nanoid/non-secure";

/**
 * Client-generated id for entities created offline. The server adopts it as the
 * primary key (see CreateHabitDto.id / createHabit), so an offline-created habit
 * keeps one stable id from birth — its queued logs can reference it immediately
 * and a retried create is idempotent. `non-secure` avoids the native crypto
 * dependency; these ids need uniqueness, not unpredictability.
 */
export function newId(): string {
    return nanoid();
}

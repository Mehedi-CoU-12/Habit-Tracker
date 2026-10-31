import { test } from "node:test";
import assert from "node:assert/strict";
import {
    addToast,
    dismissToast,
    getToasts,
    subscribeToasts,
    toast,
} from "./toast";

test("toast management", async (t) => {
    // Clear out any existing state
    for (const item of getToasts()) {
        dismissToast(item.id);
    }

    await t.test("adds a toast and notifies subscribers", () => {
        let notifiedCount = 0;
        const unsubscribe = subscribeToasts(() => {
            notifiedCount++;
        });

        const id = toast.error("Error occurred");
        assert.ok(id > 0);
        assert.strictEqual(notifiedCount, 1);

        const current = getToasts();
        assert.strictEqual(current.length, 1);
        assert.strictEqual(current[0].message, "Error occurred");
        assert.strictEqual(current[0].type, "error");

        unsubscribe();
    });

    await t.test("deduplicates identical active toasts", () => {
        const id1 = toast.error("Duplicate message");
        const id2 = toast.error("Duplicate message");
        assert.strictEqual(id1, id2);
    });

    await t.test("dismisses a toast by id", () => {
        const id = toast.success("All good");
        assert.ok(getToasts().some((item) => item.id === id));

        dismissToast(id);
        assert.ok(!getToasts().some((item) => item.id === id));
    });

    await t.test("supports info toast", () => {
        const id = toast.info("FYI");
        const found = getToasts().find((item) => item.id === id);
        assert.ok(found);
        assert.strictEqual(found?.type, "info");
        dismissToast(id);
    });
});

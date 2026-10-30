import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

class MockBroadcastChannel {
    static instances = [];
    constructor(name) {
        this.name = name;
        this.listeners = new Set();
        this.closed = false;
        MockBroadcastChannel.instances.push(this);
    }
    postMessage(data) {
        const event = { data };
        for (const inst of MockBroadcastChannel.instances) {
            if (inst === this || inst.closed || inst.name !== this.name) continue;
            for (const fn of inst.listeners) fn(event);
        }
    }
    addEventListener(_type, fn) {
        this.listeners.add(fn);
    }
    removeEventListener(_type, fn) {
        this.listeners.delete(fn);
    }
    close() {
        this.closed = true;
    }
}

beforeEach(() => {
    MockBroadcastChannel.instances = [];
    globalThis.BroadcastChannel = MockBroadcastChannel;
    localStorage.clear();
});

afterEach(() => {
    delete globalThis.BroadcastChannel;
    vi.restoreAllMocks();
});

describe("broadcastGroupChanged", () => {
    it("notifies subscribers in the same context via BroadcastChannel", async () => {
        const { broadcastGroupChanged, subscribeGroupChanged } = await import("./groupSyncChannel.js");
        const handler = vi.fn();
        const unsubscribe = subscribeGroupChanged(handler);

        broadcastGroupChanged("group-y");

        expect(handler).toHaveBeenCalledWith(expect.objectContaining({ type: "group-changed", groupId: "group-y" }));
        unsubscribe();
    });

    it("writes a sync entry to localStorage as fallback", async () => {
        const { broadcastGroupChanged, GROUP_SYNC_STORAGE_KEY } = await import("./groupSyncChannel.js");
        broadcastGroupChanged("group-y");
        const raw = localStorage.getItem(GROUP_SYNC_STORAGE_KEY);
        expect(raw).toBeTruthy();
        expect(JSON.parse(raw)).toMatchObject({ type: "group-changed", groupId: "group-y" });
    });

    it("supports null groupId (group cleared)", async () => {
        const { broadcastGroupChanged, subscribeGroupChanged } = await import("./groupSyncChannel.js");
        const handler = vi.fn();
        const unsubscribe = subscribeGroupChanged(handler);

        broadcastGroupChanged(null);

        expect(handler).toHaveBeenCalledWith(expect.objectContaining({ groupId: null }));
        unsubscribe();
    });
});

describe("subscribeGroupChanged storage event fallback", () => {
    it("invokes handler when userGroupId changes in another tab", async () => {
        const { subscribeGroupChanged, USER_GROUP_ID_KEY } = await import("./groupSyncChannel.js");
        const handler = vi.fn();
        const unsubscribe = subscribeGroupChanged(handler);

        window.dispatchEvent(
            new StorageEvent("storage", { key: USER_GROUP_ID_KEY, newValue: "group-y", oldValue: "group-x" }),
        );

        expect(handler).toHaveBeenCalledWith(expect.objectContaining({ type: "group-changed", groupId: "group-y" }));
        unsubscribe();
    });

    it("ignores storage events for unrelated keys", async () => {
        const { subscribeGroupChanged } = await import("./groupSyncChannel.js");
        const handler = vi.fn();
        const unsubscribe = subscribeGroupChanged(handler);

        window.dispatchEvent(new StorageEvent("storage", { key: "unrelated", newValue: "x" }));

        expect(handler).not.toHaveBeenCalled();
        unsubscribe();
    });

    it("decodes payload from sync storage key", async () => {
        const { subscribeGroupChanged, GROUP_SYNC_STORAGE_KEY } = await import("./groupSyncChannel.js");
        const handler = vi.fn();
        const unsubscribe = subscribeGroupChanged(handler);

        const payload = { type: "group-changed", groupId: "group-z", ts: 1 };
        window.dispatchEvent(
            new StorageEvent("storage", { key: GROUP_SYNC_STORAGE_KEY, newValue: JSON.stringify(payload) }),
        );

        expect(handler).toHaveBeenCalledWith(payload);
        unsubscribe();
    });

    it("unsubscribe stops further notifications", async () => {
        const { broadcastGroupChanged, subscribeGroupChanged, USER_GROUP_ID_KEY } =
            await import("./groupSyncChannel.js");
        const handler = vi.fn();
        const unsubscribe = subscribeGroupChanged(handler);
        unsubscribe();

        broadcastGroupChanged("group-y");
        window.dispatchEvent(new StorageEvent("storage", { key: USER_GROUP_ID_KEY, newValue: "group-y" }));

        expect(handler).not.toHaveBeenCalled();
    });
});

describe("shouldReloadForGroupSync", () => {
    it("returns false when incoming group is cleared", async () => {
        const { shouldReloadForGroupSync } = await import("./groupSyncChannel.js");
        expect(shouldReloadForGroupSync("group-a", null)).toBe(false);
    });

    it("returns false when incoming group matches the active group", async () => {
        const { shouldReloadForGroupSync } = await import("./groupSyncChannel.js");
        expect(shouldReloadForGroupSync("group-a", "group-a")).toBe(false);
    });

    it("returns true when incoming group differs from the active group", async () => {
        const { shouldReloadForGroupSync } = await import("./groupSyncChannel.js");
        expect(shouldReloadForGroupSync("group-a", "group-b")).toBe(true);
    });
});

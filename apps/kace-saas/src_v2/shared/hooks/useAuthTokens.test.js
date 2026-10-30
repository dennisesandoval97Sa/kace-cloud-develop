import { act, renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TOKEN_SYNC_CHANNEL_NAME } from "@/utils/cognitoTokenRefreshCoordinator.js";
import { useAuthTokens } from "./useAuthTokens.js";

class MockBroadcastChannel {
    static instances = [];

    constructor(name) {
        this.name = name;
        this._onmessage = null;
        this.closed = false;
        MockBroadcastChannel.instances.push(this);
    }

    set onmessage(fn) {
        this._onmessage = fn;
    }

    postMessage(data) {
        const event = { data };
        for (const inst of MockBroadcastChannel.instances) {
            if (inst === this || inst.closed || inst.name !== this.name) continue;
            inst._onmessage?.(event);
        }
    }

    close() {
        this.closed = true;
    }
}

beforeEach(() => {
    localStorage.clear();
    MockBroadcastChannel.instances = [];
    globalThis.BroadcastChannel = MockBroadcastChannel;
});

afterEach(() => {
    delete globalThis.BroadcastChannel;
});

describe("useAuthTokens", () => {
    it("returns parsed tokens on mount", () => {
        const tokens = { id_token: "id-1", access_token: "acc-1", refresh_token: "rt-1" };
        localStorage.setItem("tokens", JSON.stringify(tokens));

        const { result } = renderHook(() => useAuthTokens());

        expect(result.current).toEqual(tokens);
    });

    it('updates on storage event for key "tokens"', () => {
        localStorage.setItem("tokens", JSON.stringify({ id_token: "old" }));

        const { result } = renderHook(() => useAuthTokens());

        const updated = { id_token: "new", access_token: "acc-new" };
        act(() => {
            localStorage.setItem("tokens", JSON.stringify(updated));
            window.dispatchEvent(new StorageEvent("storage", { key: "tokens" }));
        });

        expect(result.current).toEqual(updated);
    });

    it("updates on BroadcastChannel TOKEN_SYNC_CHANNEL_NAME message tokens-updated", () => {
        localStorage.setItem("tokens", JSON.stringify({ id_token: "initial" }));

        const { result } = renderHook(() => useAuthTokens());

        const updated = { id_token: "synced", refresh_token: "rt-synced" };
        act(() => {
            localStorage.setItem("tokens", JSON.stringify(updated));
            const publisher = new MockBroadcastChannel(TOKEN_SYNC_CHANNEL_NAME);
            publisher.postMessage({ type: "tokens-updated" });
        });

        expect(result.current).toEqual(updated);
    });
});

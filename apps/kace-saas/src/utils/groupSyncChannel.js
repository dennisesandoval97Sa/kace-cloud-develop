export const GROUP_SYNC_CHANNEL_NAME = "kace-group-sync";
export const GROUP_SYNC_STORAGE_KEY = "kace_group_sync";
export const USER_GROUP_ID_KEY = "userGroupId";

const hasBroadcastChannel = typeof BroadcastChannel !== "undefined";

const getChannel = () => {
    if (!hasBroadcastChannel) return null;
    return new BroadcastChannel(GROUP_SYNC_CHANNEL_NAME);
};

export function shouldReloadForGroupSync(initialGroupId, incomingGroupId) {
    if (!incomingGroupId) {
        return false;
    }
    if (incomingGroupId === initialGroupId) {
        return false;
    }
    return true;
}

export function broadcastGroupChanged(groupId = null) {
    const payload = { type: "group-changed", groupId, ts: Date.now() };
    const channel = getChannel();
    if (channel) {
        try {
            channel.postMessage(payload);
        } finally {
            channel.close();
        }
    }
    try {
        localStorage.setItem(GROUP_SYNC_STORAGE_KEY, JSON.stringify(payload));
    } catch {
        // ignore quota or serialization failures
    }
}

export function subscribeGroupChanged(handler) {
    const channel = getChannel();

    const onMessage = (event) => {
        if (event?.data?.type === "group-changed") handler(event.data);
    };

    const onStorage = (event) => {
        if (event.key !== GROUP_SYNC_STORAGE_KEY && event.key !== USER_GROUP_ID_KEY) return;
        if (event.key === GROUP_SYNC_STORAGE_KEY && event.newValue) {
            try {
                const payload = JSON.parse(event.newValue);
                if (payload?.type === "group-changed") handler(payload);
                return;
            } catch {
                // fall through to generic handler
            }
        }
        handler({ type: "group-changed", groupId: event.newValue ?? null, ts: Date.now() });
    };

    channel?.addEventListener("message", onMessage);
    window.addEventListener("storage", onStorage);

    return () => {
        channel?.removeEventListener("message", onMessage);
        channel?.close();
        window.removeEventListener("storage", onStorage);
    };
}

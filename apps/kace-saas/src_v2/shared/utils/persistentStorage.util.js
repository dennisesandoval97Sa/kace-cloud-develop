export const PERSIST_SCHEMA_VERSION = 1;
export const PERSIST_KEY_PREFIX = "kace:ui";
export const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000;

const STORAGE_KINDS = {
    session: "sessionStorage",
    local: "localStorage",
};

/**
 * Devuelve el storage solicitado o null cuando no esta disponible (SSR, Safari en
 * modo privado, storage deshabilitado por politica). Nunca lanza: un fallo de
 * storage no puede romper una tabla.
 */
export const getStorage = (kind = "session") => {
    const storageName = STORAGE_KINDS[kind] ?? STORAGE_KINDS.session;
    try {
        if (typeof window === "undefined") return null;
        const storage = window[storageName];
        if (!storage) return null;
        const probe = `${PERSIST_KEY_PREFIX}:probe`;
        storage.setItem(probe, "1");
        storage.removeItem(probe);
        return storage;
    } catch {
        return null;
    }
};

const normalizeScope = (value) => {
    if (value === null || value === undefined || value === "") return null;
    return String(value);
};

/**
 * kace:ui:v<schema>.<version>:<userId|anon>:<groupId|nogroup>:<namespace>
 */
export const buildPersistKey = (namespace, { userId, groupId, version = 1 } = {}) => {
    const user = normalizeScope(userId) ?? "anon";
    const group = normalizeScope(groupId) ?? "nogroup";
    return `${PERSIST_KEY_PREFIX}:v${PERSIST_SCHEMA_VERSION}.${version}:${user}:${group}:${namespace}`;
};

const evictOldestEntries = (storage, evictRatio = 0.5) => {
    try {
        const entries = [];
        for (let i = 0; i < storage.length; i += 1) {
            const key = storage.key(i);
            if (!key?.startsWith(PERSIST_KEY_PREFIX)) continue;
            let savedAt = 0;
            try {
                savedAt = JSON.parse(storage.getItem(key))?.t ?? 0;
            } catch {
                savedAt = 0;
            }
            entries.push({ key, savedAt });
        }
        entries.sort((a, b) => a.savedAt - b.savedAt);
        const toRemove = Math.max(1, Math.ceil(entries.length * evictRatio));
        entries.slice(0, toRemove).forEach(({ key }) => storage.removeItem(key));
    } catch {
        // sin recuperacion posible: se continua en silencio
    }
};

/**
 * Lee un snapshot persistido. Devuelve undefined ante clave ausente, JSON
 * corrupto, version distinta, TTL vencido o usuario/grupo que no coinciden.
 */
export const readPersisted = (namespace, options = {}) => {
    const { userId, groupId, version = 1, ttlMs = DEFAULT_TTL_MS, storage: kind = "session" } = options;
    const storage = getStorage(kind);
    if (!storage) return undefined;

    const key = buildPersistKey(namespace, { userId, groupId, version });
    try {
        const raw = storage.getItem(key);
        if (raw === null) return undefined;

        const envelope = JSON.parse(raw);
        if (!envelope || typeof envelope !== "object") return undefined;
        if (envelope.v !== PERSIST_SCHEMA_VERSION * 1000 + version) return undefined;
        if (normalizeScope(envelope.u) !== normalizeScope(userId)) return undefined;
        if (normalizeScope(envelope.g) !== normalizeScope(groupId)) return undefined;
        if (ttlMs > 0 && Number(envelope.t) + ttlMs < Date.now()) {
            storage.removeItem(key);
            return undefined;
        }
        return envelope.d;
    } catch {
        try {
            storage.removeItem(key);
        } catch {
            // ignorado
        }
        return undefined;
    }
};

export const writePersisted = (namespace, data, options = {}) => {
    const { userId, groupId, version = 1, storage: kind = "session" } = options;
    const storage = getStorage(kind);
    if (!storage) return false;

    const key = buildPersistKey(namespace, { userId, groupId, version });
    const envelope = {
        v: PERSIST_SCHEMA_VERSION * 1000 + version,
        u: normalizeScope(userId),
        g: normalizeScope(groupId),
        t: Date.now(),
        d: data,
    };

    let serialized;
    try {
        serialized = JSON.stringify(envelope);
    } catch {
        return false;
    }

    try {
        storage.setItem(key, serialized);
        return true;
    } catch {
        evictOldestEntries(storage);
        try {
            storage.setItem(key, serialized);
            return true;
        } catch {
            return false;
        }
    }
};

export const removePersisted = (namespace, options = {}) => {
    const { userId, groupId, version = 1, storage: kind = "session" } = options;
    const storage = getStorage(kind);
    if (!storage) return;
    try {
        storage.removeItem(buildPersistKey(namespace, { userId, groupId, version }));
    } catch {
        // ignorado
    }
};

/**
 * Barre las claves de estado de UI en ambos storages. Con `predicate` se puede
 * limitar el barrido (recibe la clave completa).
 */
export const clearPersistedState = (predicate = null) => {
    ["session", "local"].forEach((kind) => {
        const storage = getStorage(kind);
        if (!storage) return;
        try {
            const keys = [];
            for (let i = 0; i < storage.length; i += 1) {
                const key = storage.key(i);
                if (!key?.startsWith(PERSIST_KEY_PREFIX)) continue;
                if (predicate && !predicate(key)) continue;
                keys.push(key);
            }
            keys.forEach((key) => storage.removeItem(key));
        } catch {
            // ignorado
        }
    });
};

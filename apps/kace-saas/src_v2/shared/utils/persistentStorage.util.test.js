import { afterEach, describe, expect, it, vi } from "vitest";
import {
    buildPersistKey,
    clearPersistedState,
    getStorage,
    PERSIST_KEY_PREFIX,
    readPersisted,
    removePersisted,
    writePersisted,
} from "./persistentStorage.util";

const SCOPE = { userId: "u1", groupId: "g1" };

afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe("buildPersistKey", () => {
    it("compone la clave con prefijo, version, usuario y grupo", () => {
        expect(buildPersistKey("boards:agent:b1", { ...SCOPE, version: 2 })).toBe(
            `${PERSIST_KEY_PREFIX}:v1.2:u1:g1:boards:agent:b1`,
        );
    });

    it("usa marcadores cuando no hay usuario ni grupo", () => {
        expect(buildPersistKey("ns")).toBe(`${PERSIST_KEY_PREFIX}:v1.1:anon:nogroup:ns`);
    });
});

describe("getStorage", () => {
    it("devuelve null cuando el storage lanza al escribir", () => {
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("denied");
        });
        expect(getStorage("session")).toBeNull();
    });
});

describe("read/write/remove", () => {
    it("hace round-trip de un valor", () => {
        writePersisted("ns", { filter: [1, 2] }, SCOPE);
        expect(readPersisted("ns", SCOPE)).toEqual({ filter: [1, 2] });
    });

    it("devuelve undefined si la clave no existe", () => {
        expect(readPersisted("no-existe", SCOPE)).toBeUndefined();
    });

    it("devuelve undefined si la version no coincide", () => {
        writePersisted("ns", { a: 1 }, { ...SCOPE, version: 1 });
        expect(readPersisted("ns", { ...SCOPE, version: 2 })).toBeUndefined();
    });

    it("devuelve undefined con otro usuario o grupo", () => {
        writePersisted("ns", { a: 1 }, SCOPE);
        expect(readPersisted("ns", { userId: "u2", groupId: "g1" })).toBeUndefined();
        expect(readPersisted("ns", { userId: "u1", groupId: "g2" })).toBeUndefined();
    });

    it("descarta y limpia el snapshot cuando vence el TTL", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
        writePersisted("ns", { a: 1 }, SCOPE);

        vi.setSystemTime(new Date("2026-01-01T02:00:01Z"));
        expect(readPersisted("ns", { ...SCOPE, ttlMs: 2 * 60 * 60 * 1000 })).toBeUndefined();
        expect(window.sessionStorage.getItem(buildPersistKey("ns", { ...SCOPE, version: 1 }))).toBeNull();
    });

    it("devuelve undefined y limpia ante JSON corrupto", () => {
        const key = buildPersistKey("ns", { ...SCOPE, version: 1 });
        window.sessionStorage.setItem(key, "{no-json");
        expect(readPersisted("ns", SCOPE)).toBeUndefined();
        expect(window.sessionStorage.getItem(key)).toBeNull();
    });

    it("no propaga QuotaExceededError", () => {
        vi.spyOn(Storage.prototype, "setItem").mockImplementation((key) => {
            if (key.startsWith(`${PERSIST_KEY_PREFIX}:probe`)) return;
            throw new DOMException("full", "QuotaExceededError");
        });
        expect(() => writePersisted("ns", { a: 1 }, SCOPE)).not.toThrow();
        expect(writePersisted("ns", { a: 1 }, SCOPE)).toBe(false);
    });

    it("removePersisted borra la clave", () => {
        writePersisted("ns", { a: 1 }, SCOPE);
        removePersisted("ns", SCOPE);
        expect(readPersisted("ns", SCOPE)).toBeUndefined();
    });

    it("soporta localStorage como backend", () => {
        writePersisted("ns", { a: 1 }, { ...SCOPE, storage: "local" });
        expect(readPersisted("ns", { ...SCOPE, storage: "local" })).toEqual({ a: 1 });
        expect(readPersisted("ns", SCOPE)).toBeUndefined();
    });
});

describe("clearPersistedState", () => {
    it("borra solo las claves de UI en ambos storages", () => {
        writePersisted("a", { a: 1 }, SCOPE);
        writePersisted("b", { b: 1 }, { ...SCOPE, storage: "local" });
        window.sessionStorage.setItem("tokens", "x");

        clearPersistedState();

        expect(readPersisted("a", SCOPE)).toBeUndefined();
        expect(readPersisted("b", { ...SCOPE, storage: "local" })).toBeUndefined();
        expect(window.sessionStorage.getItem("tokens")).toBe("x");
    });

    it("respeta el predicado", () => {
        writePersisted("boards:agent:b1", { a: 1 }, SCOPE);
        writePersisted("datatable:users", { b: 1 }, SCOPE);

        clearPersistedState((key) => key.includes(":boards:"));

        expect(readPersisted("boards:agent:b1", SCOPE)).toBeUndefined();
        expect(readPersisted("datatable:users", SCOPE)).toEqual({ b: 1 });
    });
});

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useUserInformation from "@kace/hooks/useUserInformation";
import {
    DEFAULT_TTL_MS,
    readPersisted,
    removePersisted,
    writePersisted,
} from "@kace_v2/shared/utils/persistentStorage.util";

const WRITE_DEBOUNCE_MS = 150;

const resolveDefault = (defaultValue) => (typeof defaultValue === "function" ? defaultValue() : defaultValue);

const applySanitize = (value, sanitize) => {
    if (value === undefined) return undefined;
    if (!sanitize) return value;
    try {
        return sanitize(value);
    } catch {
        return undefined;
    }
};

/**
 * useState con persistencia en sessionStorage (o localStorage), aislada por
 * usuario y grupo activo.
 *
 * La restauracion ocurre en el inicializador perezoso de useState, es decir
 * antes del primer render: no hay parpadeo de datos sin filtrar ni render extra.
 *
 * @returns {[any, Function, Function]} [value, setValue, resetValue]
 */
const usePersistentState = (namespace, defaultValue, options = {}) => {
    const { storage = "session", version = 1, ttlMs = DEFAULT_TTL_MS, enabled = true, sanitize = null } = options;

    const { user, active_group_id: activeGroupId } = useUserInformation();
    const userId = user?.id ?? null;

    const sanitizeRef = useRef(sanitize);
    sanitizeRef.current = sanitize;

    const persistOptions = useMemo(
        () => ({ userId, groupId: activeGroupId, version, ttlMs, storage }),
        [userId, activeGroupId, version, ttlMs, storage],
    );
    const persistOptionsRef = useRef(persistOptions);
    persistOptionsRef.current = persistOptions;

    const readSnapshot = useCallback(
        (opts) => applySanitize(readPersisted(namespace, opts), sanitizeRef.current),
        [namespace],
    );

    const restoredOnInitRef = useRef(false);

    const [value, setValue] = useState(() => {
        if (!enabled) return resolveDefault(defaultValue);
        const restored = readSnapshot(persistOptions);
        if (restored === undefined) return resolveDefault(defaultValue);
        restoredOnInitRef.current = true;
        return restored;
    });

    /*
     * El scope real (userId/groupId) puede no estar disponible en el primer
     * render si la cache de userInformation aun no esta caliente. En cuanto
     * aparece, se vuelve a leer bajo la clave definitiva.
     */
    const scopeRef = useRef(`${userId}|${activeGroupId}`);
    useEffect(() => {
        const scope = `${userId}|${activeGroupId}`;
        if (scopeRef.current === scope) return;
        scopeRef.current = scope;
        if (!enabled) return;
        const restored = readSnapshot({ userId, groupId: activeGroupId, version, ttlMs, storage });
        restoredOnInitRef.current = true;
        /*
         * Sin snapshot bajo la clave nueva hay que volver al valor por defecto:
         * conservar el del scope anterior lo acabaria escribiendo bajo la clave
         * del nuevo, filtrando estado entre usuarios o grupos.
         */
        setValue(restored !== undefined ? restored : resolveDefault(defaultValue));
    }, [userId, activeGroupId, enabled, readSnapshot, version, ttlMs, storage, defaultValue]);

    const pendingRef = useRef(null);
    const timerRef = useRef(null);

    const flush = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        if (pendingRef.current === null) return;
        const { data, options: opts } = pendingRef.current;
        pendingRef.current = null;
        writePersisted(namespace, data, opts);
    }, [namespace]);

    const isFirstWriteRef = useRef(true);
    useEffect(() => {
        if (!enabled) return undefined;
        // Sin usuario resuelto todavia: no escribir para no dejar entradas "anon".
        if (userId === null || userId === undefined) return undefined;
        // El primer efecto tras restaurar reescribiria el mismo valor sin aportar nada.
        if (isFirstWriteRef.current && restoredOnInitRef.current) {
            isFirstWriteRef.current = false;
            return undefined;
        }
        isFirstWriteRef.current = false;

        pendingRef.current = { data: value, options: persistOptionsRef.current };
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(flush, WRITE_DEBOUNCE_MS);

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [value, enabled, userId, flush]);

    // Flush en desmontaje y al ocultar/cerrar la pestana.
    useEffect(() => {
        if (!enabled) return undefined;
        const handlePageHide = () => flush();
        window.addEventListener("pagehide", handlePageHide);
        return () => {
            window.removeEventListener("pagehide", handlePageHide);
            flush();
        };
    }, [enabled, flush]);

    const resetValue = useCallback(() => {
        pendingRef.current = null;
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        removePersisted(namespace, persistOptionsRef.current);
        isFirstWriteRef.current = true;
        restoredOnInitRef.current = true;
        setValue(resolveDefault(defaultValue));
    }, [namespace, defaultValue]);

    return [value, setValue, resetValue];
};

export default usePersistentState;

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useUserInformation from "@kace/hooks/useUserInformation";
import {
    DEFAULT_TTL_MS,
    readPersisted,
    removePersisted,
    writePersisted,
} from "@kace_v2/shared/utils/persistentStorage.util";

const WRITE_DEBOUNCE_MS = 150;
const EMPTY_SNAPSHOT = {};

/**
 * Variante de usePersistentState para cuando varios useState comparten un unico
 * snapshot: una sola lectura para sembrarlos todos y un unico escritor con
 * debounce, en lugar de N claves y N efectos.
 *
 * `lateRestored` cubre el arranque en frio y el cambio de namespace: ver los
 * efectos de relectura mas abajo. Es `undefined` mientras no haya nada que
 * reaplicar, y el consumidor puede ignorarlo. `dismissLateRestored` lo cancela
 * cuando el usuario actua antes de que llegue.
 *
 * @returns {{ initial: object, hasRestored: boolean, lateRestored: object|undefined,
 *   save: Function, reset: Function, dismissLateRestored: Function }}
 */
const usePersistentSnapshot = (namespace, options = {}) => {
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

    const readSanitized = useCallback((key, persistOpts) => {
        const restored = readPersisted(key, persistOpts);
        if (restored === undefined) return undefined;
        if (!sanitizeRef.current) return restored;
        try {
            return sanitizeRef.current(restored);
        } catch {
            return undefined;
        }
    }, []);

    const snapshotRef = useRef(null);
    if (snapshotRef.current === null) {
        const restored = enabled ? readSanitized(namespace, persistOptions) : undefined;
        snapshotRef.current = {
            initial: restored && typeof restored === "object" ? restored : {},
            hasRestored: restored !== undefined,
        };
    }

    const pendingRef = useRef(null);
    const timerRef = useRef(null);

    const [lateRestored, setLateRestored] = useState(undefined);

    const discardPending = useCallback(() => {
        pendingRef.current = null;
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    /*
     * El scope real (userId/groupId) puede no estar resuelto en el primer
     * render: AccessMiddleware renderiza el Outlet sin esperar a la cache de
     * userInformation, asi que una recarga dura sobre una ruta de tabla monta el
     * hook con `user = {}`. La lectura inicial cae entonces sobre la clave `anon`
     * y no devuelve nada. En cuanto el usuario aparece se relee una unica vez
     * bajo la clave definitiva y se emite para que el consumidor la aplique.
     */
    const hasResolvedScopeRef = useRef(userId !== null && userId !== undefined);
    useEffect(() => {
        if (!enabled) return;
        if (hasResolvedScopeRef.current) return;
        if (userId === null || userId === undefined) return;
        hasResolvedScopeRef.current = true;

        const restored = readSanitized(namespace, persistOptionsRef.current);
        if (restored && typeof restored === "object") setLateRestored(restored);
    }, [enabled, namespace, userId, activeGroupId, readSanitized]);

    /*
     * Leer y escribir tienen que seguir siempre la misma clave. `flush` depende
     * de `namespace`, asi que un cambio de namespace ya reabre el ciclo de
     * escritura con la clave nueva; sin esto, el snapshot inicial seguiria
     * sellado con el anterior y el estado de la tabla vieja acabaria escrito
     * bajo la clave de la nueva.
     */
    const namespaceRef = useRef(namespace);
    useEffect(() => {
        if (namespaceRef.current === namespace) return;
        namespaceRef.current = namespace;
        if (!enabled) return;

        discardPending();
        const restored = readSanitized(namespace, persistOptionsRef.current);
        setLateRestored(restored && typeof restored === "object" ? restored : EMPTY_SNAPSHOT);
    }, [namespace, enabled, discardPending, readSanitized]);

    /*
     * Cualquier accion explicita del usuario cancela la restauracion pendiente:
     * lo que acaba de hacer manda sobre lo que hubiera guardado.
     */
    const dismissLateRestored = useCallback(() => {
        hasResolvedScopeRef.current = true;
        setLateRestored(undefined);
    }, []);

    const flush = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        /*
         * El pendiente va envuelto para que un `save(null)` legitimo no se
         * confunda con "no hay nada pendiente".
         */
        if (pendingRef.current === null) return;
        const { data } = pendingRef.current;
        pendingRef.current = null;
        writePersisted(namespace, data, persistOptionsRef.current);
    }, [namespace]);

    const save = useCallback(
        (data) => {
            if (!enabled) return;
            if (persistOptionsRef.current.userId === null || persistOptionsRef.current.userId === undefined) return;
            pendingRef.current = { data };
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(flush, WRITE_DEBOUNCE_MS);
        },
        [enabled, flush],
    );

    const reset = useCallback(() => {
        discardPending();
        /*
         * Un reset es una decision explicita de olvidar lo guardado, asi que
         * tambien cancela la relectura tardia: si el scope aun no estaba
         * resuelto, esa relectura resucitaria justo lo que se acaba de purgar.
         */
        dismissLateRestored();
        removePersisted(namespace, persistOptionsRef.current);
    }, [namespace, discardPending, dismissLateRestored]);

    useEffect(() => {
        if (!enabled) return undefined;
        const handlePageHide = () => flush();
        window.addEventListener("pagehide", handlePageHide);
        return () => {
            window.removeEventListener("pagehide", handlePageHide);
            flush();
        };
    }, [enabled, flush]);

    return {
        initial: snapshotRef.current.initial,
        hasRestored: snapshotRef.current.hasRestored,
        lateRestored,
        dismissLateRestored,
        save,
        reset,
    };
};

export default usePersistentSnapshot;

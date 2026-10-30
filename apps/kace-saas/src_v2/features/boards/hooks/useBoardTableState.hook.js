import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useUserInformation from "@kace/hooks/useUserInformation";
import useSortableQuery from "@kace_v2/shared/hooks/useSortableQuery.hook";
import { readPersisted, removePersisted, writePersisted } from "@kace_v2/shared/utils/persistentStorage.util";
import { BOARD_TABLE_SCOPE } from "@kace_v2/features/boards/constants/boardTableScope.constants";

const STATE_VERSION = 1;
const EMPTY_CRITERIA = {};
const EMPTY_FORM_VALUES = {};

export const buildBoardStateNamespace = (scope, boardId) => `boards:${scope}:${boardId}`;

/**
 * Estado de tabla de un tablero (filtros, orden, paginacion) con persistencia
 * por sesion, aislada por tablero, usuario y grupo activo.
 *
 * Comparte implementacion entre la vista de agente (useBoardById) y la de
 * administrador (useBoard), que tenian este bloque duplicado.
 *
 * Solo se persiste el filtro aplicado (`criteria`) y los valores crudos del
 * formulario que lo produjo. La pagina, el orden y el estado del modal son
 * deliberadamente volatiles.
 */
const useBoardTableState = (boardId, { scope = BOARD_TABLE_SCOPE.AGENT, enabled = true } = {}) => {
    const { user, active_group_id: activeGroupId } = useUserInformation();
    const userId = user?.id ?? null;

    const persistOptions = useMemo(
        () => ({ userId, groupId: activeGroupId, version: STATE_VERSION }),
        [userId, activeGroupId],
    );
    const persistOptionsRef = useRef(persistOptions);
    persistOptionsRef.current = persistOptions;

    const namespaceFor = useCallback((id) => buildBoardStateNamespace(scope, id), [scope]);

    const readSnapshot = useCallback(
        (id) => {
            if (!enabled || !id) return undefined;
            const snapshot = readPersisted(namespaceFor(id), persistOptionsRef.current);
            return snapshot && typeof snapshot === "object" ? snapshot : undefined;
        },
        [enabled, namespaceFor],
    );

    /*
     * Restauracion en el inicializador perezoso: el filtro correcto existe antes
     * del primer render, sin parpadeo de datos sin filtrar.
     */
    const initialSnapshotRef = useRef(null);
    if (initialSnapshotRef.current === null) {
        initialSnapshotRef.current = readSnapshot(boardId) ?? {};
    }

    const [page, setPage] = useState(1);
    const [openFilterModal, setOpenFilterModal] = useState(false);
    const [criteria, setCriteria] = useState(() => initialSnapshotRef.current.criteria ?? EMPTY_CRITERIA);
    const [filterFormValues, setFilterFormValues] = useState(
        () => initialSnapshotRef.current.filterFormValues ?? EMPTY_FORM_VALUES,
    );
    const { sortConfig, criteriaWithSort, handleSort: sortBy, resetSort } = useSortableQuery(criteria);

    /*
     * La escritura ocurre en los mutadores y no en un efecto sobre `criteria`:
     * al cambiar de tablero, un efecto escribiria el criterio del tablero
     * anterior bajo la clave del nuevo antes de que la rehidratacion se aplique.
     */
    const persistSnapshot = useCallback(
        (id, snapshot) => {
            if (!enabled || !id) return;
            if (persistOptionsRef.current.userId === null || persistOptionsRef.current.userId === undefined) return;
            const hasFilter = Array.isArray(snapshot.criteria?.filter) && snapshot.criteria.filter.length > 0;
            if (!hasFilter) {
                removePersisted(namespaceFor(id), persistOptionsRef.current);
                return;
            }
            writePersisted(namespaceFor(id), snapshot, persistOptionsRef.current);
        },
        [enabled, namespaceFor],
    );

    /*
     * Rehidratar al cambiar de tablero. La ruta admin /boards/:id cambia el id
     * sin desmontar, por lo que este efecto sigue siendo necesario; se omite su
     * ejecucion de montaje porque el inicializador perezoso ya cargo el snapshot.
     */
    const previousBoardIdRef = useRef(boardId);
    useEffect(() => {
        if (previousBoardIdRef.current === boardId) return;
        previousBoardIdRef.current = boardId;

        const snapshot = readSnapshot(boardId) ?? {};
        setCriteria(snapshot.criteria ?? EMPTY_CRITERIA);
        setFilterFormValues(snapshot.filterFormValues ?? EMPTY_FORM_VALUES);
        setPage(1);
        resetSort();
        setOpenFilterModal(false);
    }, [boardId, readSnapshot, resetSort]);

    /*
     * Arranque en frio: AccessMiddleware renderiza el Outlet sin esperar a la
     * cache de userInformation, asi que una recarga dura sobre una ruta de
     * tablero ejecuta el inicializador perezoso con `user = {}` y lee la clave
     * `anon`, que nunca tiene nada. Se relee una unica vez en cuanto el usuario
     * aparece; solo se restaura el filtro, que es lo unico que se persiste.
     */
    const hasResolvedScopeRef = useRef(userId !== null && userId !== undefined);
    useEffect(() => {
        if (!enabled) return;
        if (hasResolvedScopeRef.current) return;
        if (userId === null || userId === undefined) return;
        hasResolvedScopeRef.current = true;

        const snapshot = readSnapshot(boardId);
        if (!snapshot) return;
        setCriteria(snapshot.criteria ?? EMPTY_CRITERIA);
        setFilterFormValues(snapshot.filterFormValues ?? EMPTY_FORM_VALUES);
    }, [enabled, userId, boardId, readSnapshot]);

    /*
     * Cualquier accion explicita sobre el filtro cancela la relectura tardia:
     * lo que el usuario acaba de decidir manda sobre lo que hubiera guardado.
     */
    const handleFilter = useCallback(
        (filter, formValues) => {
            hasResolvedScopeRef.current = true;
            const nextCriteria = { filter, limit: 0, offset: 0 };
            const nextFormValues = formValues ?? EMPTY_FORM_VALUES;
            setCriteria(nextCriteria);
            setFilterFormValues(nextFormValues);
            setPage(1);
            setOpenFilterModal(false);
            persistSnapshot(boardId, { criteria: nextCriteria, filterFormValues: nextFormValues });
        },
        [boardId, persistSnapshot],
    );

    const clearFilters = useCallback(() => {
        hasResolvedScopeRef.current = true;
        setCriteria(EMPTY_CRITERIA);
        setFilterFormValues(EMPTY_FORM_VALUES);
        persistSnapshot(boardId, { criteria: EMPTY_CRITERIA, filterFormValues: EMPTY_FORM_VALUES });
    }, [boardId, persistSnapshot]);

    const handleSort = useCallback(
        (field) => {
            sortBy(field);
            setPage(1);
        },
        [sortBy],
    );

    return {
        page,
        setPage,
        criteria,
        criteriaWithSort,
        filterFormValues,
        sortConfig,
        openFilterModal,
        setOpenFilterModal,
        handleFilter,
        handleSort,
        clearFilters,
        resetSort,
    };
};

export default useBoardTableState;

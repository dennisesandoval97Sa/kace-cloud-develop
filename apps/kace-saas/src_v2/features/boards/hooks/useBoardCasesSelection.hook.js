import { useCallback, useEffect, useMemo, useState } from "react";

const useBoardCasesSelection = (boardResources, boardId, criteria) => {
    const [selection, setSelection] = useState({ selectedIds: [], rowsById: {} });
    const criteriaKey = useMemo(() => JSON.stringify(criteria ?? {}), [criteria]);
    const boardRowsById = useMemo(() => {
        const rows = {};
        for (const row of boardResources ?? []) {
            if (row?.id) rows[row.id] = row;
        }
        return rows;
    }, [boardResources]);

    useEffect(() => {
        setSelection({ selectedIds: [], rowsById: {} });
    }, [boardId, criteriaKey]);

    useEffect(() => {
        setSelection((prev) => {
            if (!prev.selectedIds.length) return prev;
            let changed = false;
            const nextRowsById = { ...prev.rowsById };
            for (const id of prev.selectedIds) {
                const row = boardRowsById[id];
                if (row && nextRowsById[id] !== row) {
                    nextRowsById[id] = row;
                    changed = true;
                }
            }
            if (!changed) return prev;
            return { ...prev, rowsById: nextRowsById };
        });
    }, [boardRowsById]);

    const toggleRow = useCallback(
        (id) => {
            setSelection((prev) => {
                const alreadySelected = prev.selectedIds.includes(id);
                if (alreadySelected) {
                    const nextRowsById = { ...prev.rowsById };
                    delete nextRowsById[id];
                    return {
                        selectedIds: prev.selectedIds.filter((currentId) => currentId !== id),
                        rowsById: nextRowsById,
                    };
                }
                const row = boardRowsById[id];
                if (!row) return prev;
                return {
                    selectedIds: [...prev.selectedIds, id],
                    rowsById: { ...prev.rowsById, [id]: row },
                };
            });
        },
        [boardRowsById],
    );

    const togglePage = useCallback(
        (pageIds) => {
            setSelection((prev) => {
                const allIn = pageIds.length > 0 && pageIds.every((pid) => prev.selectedIds.includes(pid));
                if (allIn) {
                    const nextRowsById = { ...prev.rowsById };
                    for (const id of pageIds) {
                        delete nextRowsById[id];
                    }
                    return {
                        selectedIds: prev.selectedIds.filter((id) => !pageIds.includes(id)),
                        rowsById: nextRowsById,
                    };
                }
                const nextIds = [...prev.selectedIds];
                const nextRowsById = { ...prev.rowsById };
                for (const id of pageIds) {
                    if (!nextIds.includes(id) && boardRowsById[id]) {
                        nextIds.push(id);
                        nextRowsById[id] = boardRowsById[id];
                    }
                }
                return { selectedIds: nextIds, rowsById: nextRowsById };
            });
        },
        [boardRowsById],
    );

    const clearSelection = useCallback(() => setSelection({ selectedIds: [], rowsById: {} }), []);

    const selectedRows = useMemo(
        () => selection.selectedIds.map((id) => selection.rowsById[id]).filter(Boolean),
        [selection],
    );

    return {
        selectedIds: selection.selectedIds,
        selectedRows,
        toggleRow,
        togglePage,
        clearSelection,
    };
};

export default useBoardCasesSelection;

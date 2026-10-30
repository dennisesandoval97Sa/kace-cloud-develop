import { useCallback, useMemo, useState } from "react";

const INITIAL_SORT_CONFIG = { field: null, direction: "asc" };

const useSortableQuery = (criteria) => {
    const [sortConfig, setSortConfig] = useState(INITIAL_SORT_CONFIG);

    const criteriaWithSort = useMemo(() => {
        if (!Object.entries(criteria).length && !sortConfig.field) return null;
        const base = Object.entries(criteria).length ? criteria : { filter: [], limit: 0, offset: 0 };
        if (!sortConfig.field) return base;
        return { ...base, order: { field: sortConfig.field, direction: sortConfig.direction } };
    }, [criteria, sortConfig]);

    const handleSort = useCallback((field) => {
        setSortConfig((prev) => ({
            field,
            direction: prev.field === field && prev.direction === "asc" ? "desc" : "asc",
        }));
    }, []);

    const resetSort = useCallback(() => {
        setSortConfig(INITIAL_SORT_CONFIG);
    }, []);

    return { sortConfig, criteriaWithSort, handleSort, resetSort };
};

export default useSortableQuery;

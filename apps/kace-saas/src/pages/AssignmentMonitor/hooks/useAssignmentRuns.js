import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { genericSearchService } from "../../../services/genericSearchService";

const TABLE = "automated_assignment_runs";
const DEFAULT_PAGE_SIZE = 10;

const useAssignmentRuns = () => {
    const [dateFrom, setDateFromState] = useState("");
    const [dateTo, setDateToState] = useState("");
    const [status, setStatusState] = useState("");
    const [page, setPage] = useState(0);
    const [pageSize, setPageSizeState] = useState(DEFAULT_PAGE_SIZE);

    const setDateFrom = useCallback((value) => {
        setPage(0);
        setDateFromState(value);
    }, []);

    const setDateTo = useCallback((value) => {
        setPage(0);
        setDateToState(value);
    }, []);

    const setStatus = useCallback((value) => {
        setPage(0);
        setStatusState(value);
    }, []);

    const setPageSize = useCallback((value) => {
        setPage(0);
        setPageSizeState(value);
    }, []);

    const filters = [];
    // Los valores datetime-local ("YYYY-MM-DDTHH:mm") se interpretan en la zona horaria local del usuario —
    // consistente con el render local (toLocaleString) de la tabla. "Desde" es el inicio del minuto elegido;
    // "Hasta" es inclusivo hasta el final de ese minuto (:59.999), preservando el espíritu del filtro de día previo.
    if (dateFrom) {
        filters.push({
            field: `${TABLE}.started_at`,
            operator: "gte",
            value: new Date(dateFrom).toISOString(),
            type: "AND",
        });
    }
    if (dateTo) {
        filters.push({
            field: `${TABLE}.started_at`,
            operator: "lte",
            value: new Date(`${dateTo}:59.999`).toISOString(),
            type: "AND",
        });
    }
    if (status) {
        filters.push({
            field: `${TABLE}.status`,
            operator: "eq",
            value: status,
            type: "AND",
        });
    }

    const { data, isLoading, isFetching, refetch, isError } = useQuery({
        queryKey: ["assignmentRuns", dateFrom, dateTo, status, page, pageSize],
        queryFn: () =>
            genericSearchService(
                "/assignment-runs/search",
                filters,
                { limit: pageSize, offset: page * pageSize },
                TABLE,
            ),
        refetchOnWindowFocus: false,
        retry: 2,
    });

    return {
        runs: data?.data ?? [],
        count: data?.total ?? 0,
        isLoading,
        isFetching,
        isError,
        refetch,
        page,
        setPage,
        pageSize,
        setPageSize,
        dateFrom,
        setDateFrom,
        dateTo,
        setDateTo,
        status,
        setStatus,
    };
};

export default useAssignmentRuns;

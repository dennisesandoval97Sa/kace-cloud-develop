import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchBoardsEntities } from "@kace_v2/features/boards/services/boards.service";
import { QUERY_KEYS } from "@kace_v2/shared/constants/query-keys.constants";
import useSchemaFields from "@/hooks/useSchemaFields";

const useBoardsEntities = () => {
    const entitiesQuery = useQuery({
        queryKey: QUERY_KEYS.BOARDS.ENTITIES,
        queryFn: fetchBoardsEntities,
        staleTime: 0,
        gcTime: 0,
    });

    const { schemaFields } = useSchemaFields();

    const data = useMemo(() => {
        if (!entitiesQuery.data) return entitiesQuery.data;

        const boardsViews = schemaFields
            ? Object.keys(schemaFields)
                  .filter((key) => key.startsWith("boards_"))
                  .map((key) => ({ label: key, value: key }))
                  .sort((a, b) => a.label.localeCompare(b.label))
            : [];

        return [...entitiesQuery.data, ...boardsViews];
    }, [entitiesQuery.data, schemaFields]);

    return { ...entitiesQuery, data };
};

export default useBoardsEntities;

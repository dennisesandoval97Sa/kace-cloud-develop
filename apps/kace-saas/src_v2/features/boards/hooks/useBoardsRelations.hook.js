import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@kace_v2/shared/constants/query-keys.constants";
import { fetchBoardsEntityRelations } from "@kace_v2/features/boards/services/boards.service";
import { useMemo, useState } from "react";
import { RELATIONSHIPS_TYPES } from "@kace_v2/shared/constants/relationship-types.constants";

const useBoardsRelations = (entity) => {
    const [fieldOptions, setFieldOptions] = useState([]);

    const data = useQuery({
        queryKey: QUERY_KEYS.BOARDS.ENTITY(entity),
        queryFn: () => fetchBoardsEntityRelations(entity),
        enabled: Boolean(entity),
        staleTime: 0,
        gcTime: 0,
    });

    const relationshipsOptions = useMemo(
        () =>
            Object.entries(RELATIONSHIPS_TYPES).map(([_, value]) => ({
                label: value.toUpperCase(),
                value,
            })),
        [RELATIONSHIPS_TYPES],
    );
    return { ...data, relationshipsOptions, fieldOptions, setFieldOptions };
};

export default useBoardsRelations;

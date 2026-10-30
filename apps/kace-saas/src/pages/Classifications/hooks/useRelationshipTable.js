import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { genericSearch } from "../../../services/genericSearch";
import { INITIAL_HEADERS_RELATIONSHIPS } from "../data/constants";
import { CLASSIFICATION_GROUP_RELATIONSHIPS_SERVICE } from "@kace/utils";

const useRelationshipTable = (id) => {
    const [headers] = useState(INITIAL_HEADERS_RELATIONSHIPS);
    const {
        data: dataTable,
        isLoading: isLoadingTable,
        refetch,
        isFetching,
        isError: tableError,
    } = useQuery({
        queryKey: ["classificationAssignData"],
        queryFn: async () => {
            return genericSearch(
                `${CLASSIFICATION_GROUP_RELATIONSHIPS_SERVICE}/search`,
                [
                    {
                        field: "classification_id",
                        operator: "eq",
                        value: id,
                        type: "AND",
                    },
                ],
            );
        },
        retry: 2,
        refetchOnWindowFocus: false,
    });

    return {
        headers,
        dataTable,
        isLoadingTable,
        refetch,
        isFetching,
        tableError,
    };
};

export default useRelationshipTable;

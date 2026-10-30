import useSearch from "@kace_v2/shared/hooks/useSearch.hook";
import { QUERY_KEYS } from "@kace_v2/shared/constants/query-keys.constants";
import { apiService } from "@kace/utils";
import { API } from "@kace_v2/shared/constants/api.constants";
import { parseResponseApi } from "@kace_v2/shared/utils/parse-response-api.util";

const fetchSchemas = async (criteria) => {
    const data = await apiService.post("/schemas/search", criteria);
    const response = parseResponseApi(data);
    return response.data;
};

const useSchemasOptions = () => {
    return useSearch({
        queryKey: ["schemas"],
        queryFn: fetchSchemas,
        criteria: {
            filter: [
                {
                    field: "deleted_at",
                    operator: "null",
                    type: "AND",
                    value: "null",
                },
            ],
            limit: 500,
            offset: 0,
            order: {
                field: "created_at",
                direction: "desc",
            },
        },
        select: (data) =>
            data.map((item) => ({
                label: item.name,
                value: item.id,
            })),
    });
};

export default useSchemasOptions;

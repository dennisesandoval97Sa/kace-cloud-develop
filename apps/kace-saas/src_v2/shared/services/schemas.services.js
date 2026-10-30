import { apiService } from "@kace/utils";
import { API } from "@kace_v2/shared/constants/api.constants";
import { parseResponseApi } from "@kace_v2/shared/utils/parse-response-api.util";

export const fetchSchemas = async (
    criteria = {
        filter: [
            {
                field: "deleted_at",
                operator: "null",
                type: "AND",
                value: "null",
            },
        ],
        limit: 0,
        offset: 0,
    },
) => {
    const data = await apiService.post(API.ENDPOINTS.SCHEMAS.SEARCH, criteria);
    return parseResponseApi(data);
};

export const fetchSchemaRules = async (schema) => {
    const data = await apiService.get(API.ENDPOINTS.SCHEMAS.RULES(schema));
    const response = data.data;
    return response.data;
};

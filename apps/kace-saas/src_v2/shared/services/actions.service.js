import { apiService } from "@kace/utils";
import { API } from "@kace_v2/shared/constants/api.constants";
import { parseResponseApi } from "@kace_v2/shared/utils/parse-response-api.util";

export const fetchActions = async (criteria = { limit: 0, offset: 0 }) => {
    const data = await apiService.post(API.ENDPOINTS.ACTIONS.SEARCH, criteria);
    return parseResponseApi(data);
};

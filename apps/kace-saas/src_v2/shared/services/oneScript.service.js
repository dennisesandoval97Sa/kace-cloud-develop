import { apiService } from "@kace/utils";
import { API } from "@kace_v2/shared/constants/api.constants";
import { parseResponseApi } from "@kace_v2/shared/utils/parse-response-api.util";

export const fetchOneScripts = async (criteria = { limit: 0, offset: 0 }) => {
    const data = await apiService.post(API.ENDPOINTS.ONE_SCRIPT.SEARCH, criteria);
    return parseResponseApi(data);
};

export const fetchOneScript = async (one_script_id) => {
    const data = await apiService.get(API.ENDPOINTS.ONE_SCRIPT.DETAILS(one_script_id));
    const response = data.data;
    return response.data;
};

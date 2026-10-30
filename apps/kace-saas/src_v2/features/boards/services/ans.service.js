import { apiService } from "@kace/utils";
import { API } from "@kace_v2/shared/constants/api.constants";

export const fetchAns = async () => {
    const { data } = await apiService.get(API.ENDPOINTS.ANS.ROOT);
    return data?.data?.items ?? [];
};

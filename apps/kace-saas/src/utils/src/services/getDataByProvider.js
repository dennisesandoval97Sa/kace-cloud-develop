import { apiService } from "./apiService";

export const getDataByProvider = async (url) => {
    const response = await apiService.get(url);
    return response.data;
};

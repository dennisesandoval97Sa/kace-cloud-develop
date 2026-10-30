import { apiService } from "@kace/utils";

export const genericView = async (url) => {
    const response = await apiService.get(url);
    if (response.status !== 200) {
        throw new Error("Lo sentimos, no es posible obtener los datos");
    }
    if (response.data.data.items) {
        return response.data.data.items;
    } else if (response.data.data) {
        return response.data.data;
    } else {
        return null;
    }
};

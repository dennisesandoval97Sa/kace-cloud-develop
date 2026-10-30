import { apiService } from "@/utils/main";

export async function fetchDelete(id, serviceUrl) {
    const response = await apiService.get(`${serviceUrl}/${id}/delete`);
    const isSuccess = (response.status >= 200 && response.status < 300) || response.data?.message === "Success";

    if (!isSuccess) throw new Error(response.data?.message ?? "delete_failed");

    return true;
}

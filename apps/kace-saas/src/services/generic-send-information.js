import { apiService, apiServiceAWS } from "../utils/main";

export async function sendInformation (data) {
    const response = await apiService.post(data.url, data.dataPost);
    if (response.status !== 200 && response.status !== 201) {
        throw new Error(response.data.message);
    }
    return response;
}

export async function deleteInformation (url) {
    const response = await apiService.get(url);
    if (response.status !== 200 && response.status !== 201) {
        throw new Error(response.data.message);
    }
    return response;
}

export async function requestPut (data) {
    const response = await apiServiceAWS.put(data.url, data.dataPost, {
        headers: {
            "Content-Type": data.fileType,
        },
    });
    if (response.status !== 200 && response.status !== 201) {
        throw new Error(response.data.message);
    }
    return response;
}

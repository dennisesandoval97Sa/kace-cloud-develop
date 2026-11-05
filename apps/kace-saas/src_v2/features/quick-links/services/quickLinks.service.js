import { apiService } from "@kace/utils";

const ENDPOINT = "/quick-links";

// KACE devuelve distintas envolturas según la acción. Solo normalizamos listados.
export const normalizeQuickLinks = (response) => {
    const body = response?.data?.data ?? response?.data;
    const rows = Array.isArray(body) ? body : (body?.items ?? body?.data ?? []);
    return Array.isArray(rows) ? rows : [];
};

export const fetchQuickLinks = async () => normalizeQuickLinks(await apiService.get(ENDPOINT));
export const createQuickLink = (payload) => apiService.post(ENDPOINT, payload);
export const deleteQuickLink = (id) => apiService.get(`${ENDPOINT}/${encodeURIComponent(id)}/delete`);

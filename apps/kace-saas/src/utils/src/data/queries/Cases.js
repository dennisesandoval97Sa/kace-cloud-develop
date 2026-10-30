import { apiService } from "../../services/apiService";
import { CASES_SERVICE, REOPEN_CASE } from "../constants/urls";

export const searchCases = async (filter) => {
    const url = `${CASES_SERVICE}/search`;
    const response = await apiService.post(url, filter);
    if (response.status === 200) {
        return response.data.data;
    }
    return { items: [], count: 0 };
};

export const searchTransitions = async (caseId) => {
    const url = `${CASES_SERVICE}/${caseId}/transitions`;
    const data = await apiService.post(url);
    return data;
};

export const searchCaseById = async (caseId) => {
    const url = `${CASES_SERVICE}/${caseId}`;
    const data = await apiService.get(url);
    return data;
};

export const reopenCase = async (data) => {
    const { caso_id } = data.comment;
    const url = `${REOPEN_CASE}/${caso_id}/re-open`;
    const response = await apiService.post(url, data, {
        headers: {
            "Content-Type": "application/json",
        },
    });
    return response;
};

export const cloneCase = async (id) => {
    const url = `${REOPEN_CASE}/${id}/clone`;
    const response = await apiService.get(url);
    return response;
};

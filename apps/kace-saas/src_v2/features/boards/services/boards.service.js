import { apiService } from "@kace/utils";
import { parseResponseApi } from "@kace_v2/shared/utils/parse-response-api.util";
import { API } from "@kace_v2/shared/constants/api.constants";
import { sanitizeCriteria } from "../utils/sanitizeCriteria.util";

export const fetchBoard = async (board_id) => {
    const data = await apiService.get(API.ENDPOINTS.BOARDS.DETAILS(board_id));
    const response = data.data;
    return response.data;
};

export const fetchBoardResources = async (board_id, page = 1, criteria = {}, activeClientId = null) => {
    const clean = sanitizeCriteria(criteria);
    const { data } = await apiService.post(
        API.ENDPOINTS.BOARDS.RESOURCES(board_id, page, { activeClientId }),
        Object.entries(clean).length ? clean : { filter: [], limit: 0, offset: 0 },
    );
    return data;
};

export const fetchBoardsEntities = async () => {
    const data = await apiService.get(API.ENDPOINTS.BOARDS.ENTITIES);
    const response = parseResponseApi(data);
    return response.data.map((item) => ({ label: item, value: item }));
};

export const fetchBoardsEntityRelations = async (entity) => {
    if (!entity) return [];
    const data = await apiService.get(`${API.ENDPOINTS.BOARDS.ENTITIES}/${entity}`);
    const response = parseResponseApi(data);
    return response.data;
};

export const fetchUsersByIds = async (userIds = []) => {
    if (!userIds.length) return [];

    const response = await apiService.post(API.ENDPOINTS.USERS.SEARCH, {
        filter: [
            {
                field: "id",
                operator: "in",
                value: userIds.join(", "),
                type: "AND",
            },
        ],
        limit: 100,
        offset: 0,
        order: {
            direction: "desc",
            field: "created_at",
        },
    });

    return response;
};

export const fetchAvailableBoards = async () => {
    const response = await apiService.get(API.ENDPOINTS.BOARDS.AVAILABLE);
    return response.data;
};

export const deleteAuxiliaryRecord = async (primaryEntity, recordId) => {
    const entity = primaryEntity.startsWith("aux_") ? primaryEntity.slice(4) : primaryEntity;
    const urlEntity = entity.replace(/_/g, "-");
    const { data } = await apiService.get(`/auxiliaries/${urlEntity}/${recordId}/delete`);
    return data;
};

export const exportBoardResources = async (board_id, criteria = {}, activeClientId = null) => {
    const url = API.ENDPOINTS.BOARDS.RESOURCES(board_id, 1, { export: true, activeClientId });
    const clean = sanitizeCriteria(criteria);
    const dataPost = Object.entries(clean).length ? clean : { filter: [], limit: 0, offset: 0 };
    const response = await apiService.post(url, dataPost);
    return response.data;
};

export const postAuxCasesBulkDelete = ({ entity, payload }) =>
    apiService.post(API.ENDPOINTS.AUX_BULK.DELETE(entity), payload);

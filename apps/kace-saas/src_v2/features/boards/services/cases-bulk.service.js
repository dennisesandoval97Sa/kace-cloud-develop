import { apiService } from "@kace/utils";
import { API } from "@kace_v2/shared/constants/api.constants";

export const postCasesBulkAssign = (payload) => apiService.post(API.ENDPOINTS.CASES_BULK.ASSIGN, payload);

export const postCasesBulkTransition = (payload) => apiService.post(API.ENDPOINTS.CASES_BULK.TRANSITION, payload);

export const postCasesBulkClose = (payload) => apiService.post(API.ENDPOINTS.CASES_BULK.CLOSE, payload);

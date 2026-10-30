import Joi from "joi";
import { PUBLIC_ERROR_CODES } from "@kace/error-codes";
import { apiService } from "@/utils/main";

const ACTIVE_OPERATION_STATUSES = ["pending", "in_progress"];

const conflictReceiptSchema = Joi.object({
    code: Joi.string().valid(PUBLIC_ERROR_CODES.CONFLICT_ERROR).required(),
    activeOperation: Joi.object({
        operationId: Joi.string().min(1).required(),
        status: Joi.string()
            .valid(...ACTIVE_OPERATION_STATUSES)
            .required(),
    })
        .unknown(true)
        .required(),
}).unknown(true);

export const unwrapWorkspacePriorities = (response) => response?.data?.data ?? response?.data ?? response;

export const parseWorkspacePrioritiesConflict = (requestError) => {
    if (requestError?.response?.status !== 409) return null;

    const { value, error } = conflictReceiptSchema.validate(unwrapWorkspacePriorities(requestError.response));
    return error ? null : value.activeOperation;
};

export const createWorkspacePrioritiesClient = (httpClient) => ({
    read: async (accountId) =>
        unwrapWorkspacePriorities(await httpClient.get(`/channel-hub/${accountId}/workspace-priorities`)),
    update: async (accountId, payload) => {
        const response = await httpClient.post(`/channel-hub/${accountId}/workspace-priorities/reorder`, payload);
        return { status: response?.status ?? 200, data: unwrapWorkspacePriorities(response) };
    },
    readOperation: async (accountId, operationId, signal) =>
        unwrapWorkspacePriorities(
            await httpClient.get(`/channel-hub/${accountId}/workspace-priorities/reorders/${operationId}`, { signal }),
        ),
    activeOperationFromConflict: parseWorkspacePrioritiesConflict,
});

export const workspacePrioritiesClient = createWorkspacePrioritiesClient(apiService);
export { ACTIVE_OPERATION_STATUSES };

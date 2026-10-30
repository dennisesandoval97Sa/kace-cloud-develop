import { v4 as uuidV4 } from 'uuid';
import { ActionJob } from '../../../src/action-jobs';

export default class ActionJobMother {
    /**
     * Generates a Data Transfer Object (DTO) for the `ActionJob` entity.
     *
     * @param {Object} params - Optional parameters to override default values.
     * @returns {Object} The DTO containing properties for the `ActionJob` entity.
     */
    static dto({
        id,
        type,
        is_pending,
        is_in_progress,
        is_completed,
        action_id,
        search_filter,
        s3_file_key,
        total_records,
        processed_records,
        failed_records,
        details,
        notifications_sent,
        start_at,
        end_at,
        created_by,
        created_at,
        restflow_id,
        restflow_context,
    } = {}) {
        return {
            id: id ?? uuidV4(),
            type: type ?? 'file',
            is_pending: is_pending ?? true,
            is_in_progress: is_in_progress ?? false,
            is_completed: is_completed ?? false,
            action_id: action_id ?? uuidV4(),
            search_filter: search_filter ?? null,
            s3_file_key: s3_file_key ?? 'bucket/url/id/file_name',
            start_at: start_at ?? new Date().toISOString(),
            end_at: end_at ?? null,
            total_records: total_records ?? 100,
            processed_records: processed_records ?? 0,
            failed_records: failed_records ?? 0,
            details: details ?? null,
            notifications_sent: notifications_sent ?? false,
            created_by: created_by ?? uuidV4(),
            created_at: created_at ?? new Date().toISOString(),
            restflow_id: restflow_id ?? null,
            restflow_context: restflow_context ?? { example_restflow_context: 'example_restflow_context' },
        };
    }

    /**
     * Creates an instance of `ActionJob` and saves it to the repository.
     *
     * @param {Object} repository - The repository to save the `ActionJob` instance.
     * @param {Object} data - Optional data to override default values.
     * @returns {Promise<ActionJob>} The created `ActionJob` instance.
     */
    static async create(repository, data = {}) {
        const dto = ActionJobMother.dto(data);
        const actionJob = ActionJob.create(dto);
        await repository.save(actionJob);
        return actionJob;
    }

    static dtoWithoutIdsData({
        id,
        type,
        is_pending,
        is_in_progress,
        is_completed,
        action_id,
        search_filter,
        s3_file_key,
        total_records,
        processed_records,
        failed_records,
        details,
        notifications_sent,
        start_at,
        end_at,
        created_by,
        created_at,
        restflow_id,
        restflow_context,
    } = {}) {
        return {
            id: id ?? uuidV4(),
            type: type ?? 'file',
            is_pending: is_pending ?? true,
            is_in_progress: is_in_progress ?? false,
            is_completed: is_completed ?? false,
            action_id: action_id ?? null,
            search_filter: search_filter ?? null,
            s3_file_key: s3_file_key ?? 'bucket/url/id/file_name',
            start_at: start_at ?? new Date().toISOString(),
            end_at: end_at ?? null,
            total_records: total_records ?? 100,
            processed_records: processed_records ?? 0,
            failed_records: failed_records ?? 0,
            details: details ?? null,
            notifications_sent: notifications_sent ?? false,
            created_by: created_by ?? uuidV4(),
            created_at: created_at ?? new Date().toISOString(),
            restflow_id: restflow_id ?? null,
            restflow_context: restflow_context ?? { example_restflow_context: 'example_restflow_context' },
        };
    }
}

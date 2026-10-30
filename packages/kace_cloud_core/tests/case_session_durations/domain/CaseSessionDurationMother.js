import { v4 as uuidv4 } from 'uuid';
import { CaseSessionDuration } from '../../../src/case_session_durations/domain/CaseSessionDuration.js';

export default class CaseSessionDurationMother {
    /**
     * Generates a Data Transfer Object (DTO) for the `CaseSessionDuration` entity.
     *
     * @returns {Object} The DTO containing the properties for a `CaseSessionDuration` entity.
     */
    static dto({
        id,
        case_id,
        user_id,
        started_at,
        finished_at,
        elapsed_time,
        event_type,
        justification,
        created_at,
        created_by,
    } = {}) {
        return {
            id: id ?? uuidv4(),
            // case_id and user_id should be UUIDs to satisfy ValueObjectUuid
            case_id: case_id ?? uuidv4(),
            user_id: user_id ?? uuidv4(),
            started_at: started_at ?? new Date().toISOString(),
            finished_at: finished_at ?? null,
            elapsed_time: elapsed_time ?? null,
            // ValueObjectEventType is not nullable: every session must carry an event type.
            // 'VIEW' is the state a freshly opened session starts in.
            event_type: event_type ?? 'VIEW',
            justification: justification ?? null,
            // AggregateRoot builds created_by/created_at with non-nullable value objects, so both
            // are mandatory in the DTO even though the columns themselves accept null.
            created_by: created_by ?? uuidv4(),
            created_at: created_at ?? new Date().toISOString(),
        };
    }

    /**
     * Creates a `CaseSessionDuration` instance and saves it to the repository.
     *
     * @param {KnexCaseSessionDurationRepository} repository - The repository to save the `CaseSessionDuration` instance.
     * @returns {CaseSessionDuration} The created `CaseSessionDuration` instance.
     */
    static async create(repository, data = {}) {
        const session = CaseSessionDuration.create(CaseSessionDurationMother.dto(data));
        await repository.save(session);
        return session;
    }
}

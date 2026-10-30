import { v4 as uuidv4 } from 'uuid';
import { EventLog } from '../../../src/event-log';

export default class EventLogMother {
    /**
     * Genera un DTO válido para la entidad EventLog.
     *
     * @param {Object} overrides - Propiedades opcionales para sobreescribir los valores por defecto.
     * @returns {Object} DTO para crear una instancia de EventLog.
     */
    static dto({
        id,
        event_name,
        occurred_at,
        initiated_by_user,
        aggregate_id,
        body,
        old_data,
        case_id,
        client_id,
    } = {}) {
        return {
            id: id ?? uuidv4(),
            event_name: event_name ?? 'user.created',
            occurred_at: occurred_at ?? new Date().toISOString(),
            initiated_by_user: initiated_by_user ?? uuidv4(),
            aggregate_id: aggregate_id ?? uuidv4(),
            body: body ?? { userId: uuidv4(), name: 'John Doe' },
            old_data: old_data ?? { userId: uuidv4(), name: 'John Doe' },
            case_id: case_id ?? null,
            client_id: client_id ?? null,
        };
    }

    /**
     * Crea y guarda una instancia de EventLog en el repositorio.
     *
     * @param {KnexEventLogRepository} repository - Repositorio para guardar la entidad.
     * @param {Object} data - Datos opcionales para personalizar el DTO.
     * @returns {EventLog} Instancia creada y guardada.
     */
    static async createEventLog(repository, data = {}) {
        const eventLog = EventLog.create(EventLogMother.dto(data));
        await repository.save(eventLog);
        return eventLog;
    }
}

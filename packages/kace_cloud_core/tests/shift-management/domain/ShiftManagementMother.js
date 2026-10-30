import { v4 as uuidv4 } from 'uuid';
import { ShiftManagement } from '../../../src/shift-management';

export default class ShiftManagementMother {
    /**
     * Generates a Data Transfer Object (DTO) for the `ShiftManagement` entity.
     *
     * @returns {Object} The DTO containing the properties for an `ShiftManagement` entity.
     */
    static dto(override = {}) {
        return {
            id: uuidv4(),
            holiday_dates: ['2024-01-01', '2024-12-25'],
            work_days: {
                monday: { start: '09:00', end: '17:00' },
                tuesday: { start: '09:00', end: '17:00' },
                wednesday: { start: '09:00', end: '17:00' },
                thursday: { start: '09:00', end: '17:00' },
                friday: { start: '09:00', end: '17:00' },
            },
            description: 'Horario estándar de trabajo',
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
            ...override,
        };
    }

    /**
     * Creates an `ShiftManagement` instance and saves it to the repository.
     *
     * @param {KnexShiftManagementRepository} repository - The repository to save the `ShiftManagement` instance.
     * @returns {ShiftManagement} The created `ShiftManagement` instance.
     */
    static async createShiftManagement(repository, data = {}) {
        const shiftManagement = ShiftManagement.create(ShiftManagementMother.dto(data));
        await repository.save(shiftManagement);
        return shiftManagement;
    }

    /**
     * Garantiza una fila de `shift_management` con sus columnas de negocio, y no
     * solo con el id. Hace falta porque `grupos.horario_id` apunta aqui y
     * `KnexCaseRepository.#buildBaseQueryAns` recorre esa cadena con leftJoin: un
     * horario sin `work_days` deja el calculo de ANS sin datos y el caso acaba con
     * "no tiene horario (shift_management) configurado".
     *
     * `holiday_dates` es `json` y `work_days` es `jsonb`: el driver `pg` serializa
     * un array de JavaScript como literal de array de postgres (`{...}`), que no es
     * JSON valido, asi que los dos van con `JSON.stringify`, igual que en
     * `KnexShiftManagementRepository.save`.
     *
     * @param {import('knex').Knex} connection - `repository.connection`.
     * @param {string} [id] - Id a garantizar; si no se pasa, se inventa uno.
     * @returns {Promise<string>} El id de la fila garantizada.
     */
    static async ensureRow(connection, id = uuidv4()) {
        const dto = ShiftManagementMother.dto({ id });

        await connection('shift_management')
            .insert({
                ...dto,
                holiday_dates: JSON.stringify(dto.holiday_dates),
                work_days: JSON.stringify(dto.work_days),
            })
            .onConflict('id')
            .ignore();

        return id;
    }

    static diasLaborablesLunesViernes() {
        return {
            id: uuidv4(),
            holiday_dates: [],
            work_days: {
                monday: { start: '09:00', end: '17:00' },
                tuesday: { start: '09:00', end: '17:00' },
                wednesday: { start: '09:00', end: '17:00' },
                thursday: { start: '09:00', end: '17:00' },
                friday: { start: '09:00', end: '17:00' },
            },
            description: 'Horario de lunes a viernes',
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        };
    }

    static diasLaborablesConFestivos() {
        return {
            id: uuidv4(),
            holiday_dates: ['2024-01-01', '2024-12-25'],
            work_days: {
                monday: { start: '09:00', end: '17:00' },
                tuesday: { start: '09:00', end: '17:00' },
                wednesday: { start: '09:00', end: '17:00' },
                thursday: { start: '09:00', end: '17:00' },
                friday: { start: '09:00', end: '17:00' },
            },
            description: 'Horario de lunes a viernes',
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        };
    }

    static diasLaborablesLunesDomingo24Horas() {
        return {
            id: uuidv4(),
            holiday_dates: [],
            work_days: {
                monday: { start: '00:00', end: '23:59' },
                tuesday: { start: '00:00', end: '23:59' },
                wednesday: { start: '00:00', end: '23:59' },
                thursday: { start: '00:00', end: '23:59' },
                friday: { start: '00:00', end: '23:59' },
                saturday: { start: '00:00', end: '23:59' },
                sunday: { start: '00:00', end: '23:59' },
            },
            description: 'Horario de lunes a viernes',
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        };
    }

    static diasLaborablesLunesDomingo24Horas() {
        return {
            id: uuidv4(),
            holiday_dates: [],
            work_days: {
                monday: { start: '00:00', end: '23:59' },
                tuesday: { start: '00:00', end: '23:59' },
                wednesday: { start: '00:00', end: '23:59' },
                thursday: { start: '00:00', end: '23:59' },
                friday: { start: '00:00', end: '23:59' },
                saturday: { start: '00:00', end: '23:59' },
                sunday: { start: '00:00', end: '23:59' },
            },
            description: 'Horario de lunes a viernes',
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        };
    }

    static diasLaborablesLunesSabado() {
        return {
            id: uuidv4(),
            holiday_dates: [],
            work_days: {
                monday: { end: '18:00', start: '08:00' },
                tuesday: { end: '18:00', start: '08:00' },
                wednesday: { end: '18:00', start: '08:00' },
                thursday: { end: '18:00', start: '08:00' },
                friday: { end: '18:00', start: '08:00' },
                saturday: { end: '15:00', start: '08:00' },
            },
            description: 'Horario de lunes a viernes',
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        };
    }
}

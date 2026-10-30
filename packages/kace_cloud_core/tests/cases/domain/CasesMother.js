import { v4 as uuidv4 } from 'uuid';
import { Case } from '../../../src/cases';
import dayjs from 'dayjs';
import { CaseAns } from '../../../src/cases/domain/CaseAns';
import ShiftManagementMother from '../../shift-management/domain/ShiftManagementMother';
import AnsMother from '../../ans/domain/AnsMother.js';
import { ensureParentRow, ensureParentRows } from '../../support/ensureParentRow.js';

export default class CasesMother {
    /**
     * Generates a Data Transfer Object (DTO) for a `Case`.
     *
     * @param {Object} params - Optional parameters to customize the DTO.
     * @returns {Object} The DTO for the `Case`.
     */
    static dto(override = {}) {
        return {
            id: uuidv4(),
            cliente_id: uuidv4(),
            transicion_id: uuidv4(),
            responsable_id: uuidv4(),
            clasificacion_id: uuidv4(),
            descripcion_caso_id: uuidv4(),
            grupo_id: uuidv4(),
            motivo_baja: 'motivo baja',
            alto_impacto: 1,
            vista: 'vista',
            fecha_resolucion: null,
            created_at: dayjs().subtract(6, 'day').toISOString(),
            created_by: uuidv4(),
            ans_posicion: null,
            antiguedad_dias: null,
            antiguedad_horas: null,
            antiguedad_minutos: null,
            state_change_at: dayjs().subtract(6, 'day').toISOString(),
            state_elapsed_days: null,
            state_elapsed_hours: null,
            state_elapsed_minutes: null,
            state_elapsed_time: null,
            external_code: null,
            sla_id: uuidv4(),
            sla_state_id: uuidv4(),
            updated_at: null,
            updated_by: null,
            parent_id: null,
            deleted_at: null,
            ...override,
        };
    }

    /**
     * Garantiza que las filas padre referenciadas por las claves foraneas de
     * `casos` existan antes de guardar (postgres las exige; sqlite nunca lo
     * hizo).
     *
     * Se garantizan SIEMPRE, tambien cuando el llamador fijo el id: respaldar una
     * fila que ya existe no cuesta nada porque `ensureParentRow` es idempotente,
     * mientras que saltarsela deja el insert al borde de una violacion.
     *
     * @param {import('knex').Knex} connection - `repository.connection`.
     * @param {Object} dto - DTO ya resuelto (con los valores por defecto aplicados).
     * @param {Object} [overrides] - Se acepta por compatibilidad con los llamadores; no se usa.
     * @returns {Promise<void>}
     */
    static async ensureRelations(connection, dto, overrides) {
        // `KnexCaseRepository.#buildBaseQueryAns` recorre dos cadenas con leftJoin:
        //   cases.clasificacion_id -> clasificaciones.ans_id -> ans.id
        //   cases.grupo_id -> grupos.horario_id -> shift_management.id
        // Un eslabon vacio no rompe la consulta, devuelve NULL, y `#prepareEntities`
        // lanza "no tiene ANS de clasificacion configurada" (422). Por eso estas dos
        // filas de catalogo NO pueden llevar solo el id.
        const ansId = dto.ans_id ?? uuidv4();
        const shiftManagementId = dto.horario_id ?? uuidv4();

        // Dos fases, y no un solo `ensureParentRows`: `clasificaciones.ans_id` y
        // `grupos.horario_id` son claves foraneas, asi que sus destinos tienen que
        // existir antes, y `ensureParentRows` lanza todo en paralelo sin garantizar
        // orden.
        await Promise.all([
            ensureParentRow(connection, 'ans', ansId, AnsMother.dto({ id: ansId })),
            ShiftManagementMother.ensureRow(connection, shiftManagementId),
        ]);

        await ensureParentRows(connection, [
            { table: 'clients', id: dto.cliente_id },
            { table: 'usuarios', id: dto.responsable_id },
            { table: 'clasificaciones', id: dto.clasificacion_id, extra: { ans_id: ansId } },
            { table: 'descripciones_casos', id: dto.descripcion_caso_id },
            { table: 'grupos', id: dto.grupo_id, extra: { horario_id: shiftManagementId } },
            { table: 'transiciones', id: dto.transicion_id },
            // Septima y ultima FK de `cases` segun pg_constraint
            // (`casos_caso_clonado_id_foreign`). Es autorreferencial, y `cases`
            // no tiene mas columnas obligatorias sin default que `id`, asi que
            // la fila minima basta.
            { table: 'cases', id: dto.caso_clonado_id },
        ]);
    }

    /**
     * Creates a `Case` instance with random properties and saves it to the repository.
     *
     * @param {KnexCaseRepository} repository - The repository to save the `Case` instance.
     * @param {Object} [overrides={}] - Properties that can override the values in the DTO.
     * @returns {Promise<Case>} The created `Case` instance.
     */
    static async createCase(repository, overrides = {}) {
        const dto = await CasesMother.dto(overrides);
        await CasesMother.ensureRelations(repository.connection, dto, overrides);
        const kase = Case.create(dto);
        const kaseSaved = await repository.save(kase);
        await repository.saveHistory(kaseSaved);
        return kaseSaved;
    }

    /**
     * Crea `total` casos identicos salvo por los overrides. Vive aqui y no en
     * cada test porque es literalmente una factoria de casos, igual que el
     * resto de la clase, y varios tests de dashboard necesitan sembrar N filas
     * reales para fijar los contadores de las vistas materializadas.
     *
     * Los casos se crean en serie a proposito: `createCase` hace
     * `ensureRelations` (upsert idempotente sobre seis tablas padre) y en
     * paralelo esos upserts compiten por las mismas filas.
     *
     * @param {KnexCaseRepository} repository - The repository to save the `Case` instances.
     * @param {number} total - Cuantos casos crear.
     * @param {Object} [overrides={}] - Properties that can override the values in the DTO.
     * @returns {Promise<void>}
     */
    static async createCases(repository, total, overrides = {}) {
        for (let i = 0; i < total; i += 1) {
            await CasesMother.createCase(repository, overrides);
        }
    }

    static async createCaseWithDescription(repository, overrides = {}) {
        const dto = await CasesMother.dto(overrides);
        await CasesMother.ensureRelations(repository.connection, dto, {
            ...overrides,
            descripcion_caso_id: dto.descripcion_caso_id,
        });
        // `ensureRelations` ya creo la fila de `descripciones_casos` con este
        // mismo id. El insert pelado que habia aqui la insertaba por segunda vez
        // y reventaba con `descripciones_casos_pkey`.
        const kase = Case.create(dto);
        await repository.save(kase);
        return kase;
    }

    static caseAnsDto({
        id,
        created_at,
        medicion_ans_id,
        intermedio,
        vencido,
        work_days,
        holiday_dates,
        fecha_resolucion,
        state_change_at,
        state_elapsed_days,
        state_elapsed_hours,
        state_elapsed_minutes,
        state_elapsed_time,
        sla_state_elapsed_time,
        sla_state_elapsed_days,
        sla_state_elapsed_hours,
        sla_state_elapsed_minutes,
        sla_elapsed_time,
        sla_elapsed_days,
        sla_elapsed_hours,
        sla_elapsed_minutes,
        transitions_ans_medicion,
        transitions_ans_intermedio,
        transitions_ans_vencido,
        sla_remaining_days,
        sla_remaining_hours,
        sla_remaining_minutes,
        sla_state_remaining_days,
        sla_state_remaining_hours,
        sla_state_remaining_minutes,
        parent_id,
    }) {
        const shifts = ShiftManagementMother.dto();

        const caseAns = new CaseAns({
            id: id ?? uuidv4(),
            created_at: created_at ?? dayjs().subtract(6, 'day').toISOString(),
            medicion_ans_id: medicion_ans_id ?? 'Days',
            intermedio: intermedio ?? 2,
            vencido: vencido ?? 5,
            work_days: work_days ?? shifts.work_days,
            holiday_dates: holiday_dates ?? shifts.holiday_dates,
            fecha_resolucion: fecha_resolucion ?? null,
            state_change_at: state_change_at ?? null,
            state_elapsed_days: state_elapsed_days ?? null,
            state_elapsed_hours: state_elapsed_hours ?? null,
            state_elapsed_minutes: state_elapsed_minutes ?? null,
            state_elapsed_time: state_elapsed_time ?? null,
            sla_state_elapsed_time: sla_state_elapsed_time ?? null,
            sla_state_elapsed_days: sla_state_elapsed_days ?? null,
            sla_state_elapsed_hours: sla_state_elapsed_hours ?? null,
            sla_state_elapsed_minutes: sla_state_elapsed_minutes ?? null,
            sla_elapsed_time: sla_elapsed_time ?? null,
            sla_elapsed_days: sla_elapsed_days ?? null,
            sla_elapsed_hours: sla_elapsed_hours ?? null,
            sla_elapsed_minutes: sla_elapsed_minutes ?? null,
            transitions_ans_medicion: transitions_ans_medicion ?? 'Hours',
            transitions_ans_intermedio: transitions_ans_intermedio ?? 4,
            transitions_ans_vencido: transitions_ans_vencido ?? 8,
            sla_remaining_days: sla_remaining_days ?? null,
            sla_remaining_hours: sla_remaining_hours ?? null,
            sla_remaining_minutes: sla_remaining_minutes ?? null,
            sla_state_remaining_days: sla_state_remaining_days ?? null,
            sla_state_remaining_hours: sla_state_remaining_hours ?? null,
            sla_state_remaining_minutes: sla_state_remaining_minutes ?? null,
            parent_id: parent_id ?? null,
        });
        return caseAns;
    }

    static caseAnsDtoWithoutStateFields({
        id,
        created_at,
        medicion_ans_id,
        intermedio,
        vencido,
        work_days,
        holiday_dates,
        fecha_resolucion,
        sla_elapsed_time,
        sla_elapsed_days,
        sla_elapsed_hours,
        sla_elapsed_minutes,
        sla_remaining_days,
        sla_remaining_hours,
        sla_remaining_minutes,
        parent_id,
    }) {
        const shifts = ShiftManagementMother.dto();

        const caseAns = new CaseAns({
            id: id ?? uuidv4(),
            created_at: created_at ?? dayjs().subtract(6, 'day').toISOString(),
            medicion_ans_id: medicion_ans_id ?? 'Days',
            intermedio: intermedio ?? 2,
            vencido: vencido ?? 5,
            work_days: work_days ?? shifts.work_days,
            holiday_dates: holiday_dates ?? shifts.holiday_dates,
            fecha_resolucion: fecha_resolucion ?? null,
            sla_elapsed_time: sla_elapsed_time ?? null,
            sla_elapsed_days: sla_elapsed_days ?? null,
            sla_elapsed_hours: sla_elapsed_hours ?? null,
            sla_elapsed_minutes: sla_elapsed_minutes ?? null,
            sla_remaining_days: sla_remaining_days ?? null,
            sla_remaining_hours: sla_remaining_hours ?? null,
            sla_remaining_minutes: sla_remaining_minutes ?? null,
            parent_id: parent_id ?? null,
        });
        return caseAns;
    }

    static async createCaseWithRelations(repository, data = {}, references = null) {
        const caseDto = CasesMother.dto(data);
        const estado_id = uuidv4();
        const rol_id = references?.rol_id ?? uuidv4();

        const actualizador_id = uuidv4();
        caseDto.updated_by = actualizador_id;

        // El rol se respalda SIEMPRE, tambien cuando el llamante fijo
        // `references.rol_id`. Unas lineas mas abajo se inserta un `usuarios`
        // con ese `rol_id`, asi que saltarse la fila padre dejaba la FK
        // `usuarios.rol_id -> roles` sin respaldo: el llamante casi siempre pasa
        // un uuid inventado. `ensureParentRow` es idempotente, asi que respaldar
        // un rol que ya existe no cuesta nada ni pisa sus columnas.
        await ensureParentRow(repository.connection, 'roles', rol_id, {
            descripcion: 'clients_managments',
            created_by: caseDto.responsable_id,
        });
        await repository.connection('clients').insert({
            id: caseDto.cliente_id,
            documento: '12345678',
            created_by: caseDto.created_by,
        });
        await repository.connection('usuarios').insert({
            id: caseDto.responsable_id,
            nombres: 'responsable',
        });
        await repository
            .connection('usuarios')
            .insert({
                id: caseDto.created_by,
                nombres: 'creador',
                rol_id: rol_id,
            })
            .onConflict('id')
            .ignore();
        await repository.connection('usuarios').insert({
            id: caseDto.updated_by,
            nombres: 'actualizador',
        });
        await repository.connection('clasificaciones').insert({
            id: caseDto.clasificacion_id,
            created_by: caseDto.updated_by,
        });
        await repository.connection('descripciones_casos').insert({
            id: caseDto.descripcion_caso_id,
        });
        await repository.connection('grupos').insert({
            id: caseDto.grupo_id,
        });
        await repository.connection('estados').insert({
            id: estado_id,
            nombre: 'estado',
            color: '#66CC33',
        });
        await repository.connection('transiciones').insert({
            id: caseDto.transicion_id,
            siguiente_estado_id: estado_id,
        });
        await repository.connection('aux_cases').insert({
            id: uuidv4(),
            data: data.aux_data ?? {
                pruebas_qa: {
                    fecha_peticion: dayjs().subtract(6, 'day').toISOString(),
                },
            },
            caso_id: caseDto.id,
        });

        const kase = await CasesMother.createCase(repository, caseDto);

        return kase;
    }

    static async createCaseWithFullRelations(repository, data = null) {
        const dto = await CasesMother.dto(data);
        await CasesMother.ensureRelations(repository.connection, dto, {});
        const kase = Case.create(dto);
        await repository.save(kase);
        return kase;
    }
}

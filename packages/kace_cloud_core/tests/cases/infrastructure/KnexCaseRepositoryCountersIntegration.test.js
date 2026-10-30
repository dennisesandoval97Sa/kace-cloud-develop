import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../../knexfile.js';
import { KnexCaseRepository } from '../../../src/cases/infrastructure/persistence/KnexCaseRepository.js';
import { Case } from '../../../src/cases/index.js';
import { CaseFactory } from '../../../src/factories/CaseFactory.js';
import { GroupFactory } from '../../../src/factories/GroupFactory.js';
import { TransitionFactory } from '../../../src/factories/TransitionFactory.js';
import { StateFactory } from '../../../src/factories/StateFactory.js';
import { ClassificationFactory } from '../../../src/factories/ClassificationFactory.js';
import { AnsFactory } from '../../../src/factories/AnsFactory.js';
import { ensureParentRow } from '../../support/ensureParentRow.js';
import { QueryDBError } from '../../../src/shared/errors/QueryDBError.js';
import { CustomError } from '../../../src/shared/errors/CustomError.js';
import { Criteria } from '../../../src/shared/criteria/Criteria.js';

/**
 * Covers the "cheap branch" counters/search methods of KnexCaseRepository: filters-empty vs.
 * filters-with-values, and empty-list vs. populated-list. Reuses the seeding pattern from
 * `KnexCaseRepositoryOrderedIdsIntegration.test.js` (CaseFactory for the parent rows that need
 * `caso_id`, a hand-built `usuarios` row for `responsable_id` to dodge the apostrophe flake).
 */
describe('KnexCaseRepository counters and searches (integration)', () => {
    const repository = new KnexCaseRepository(knexConfig);

    let responsableId;
    let otherResponsableId;
    let groupId;
    let otherGroupId;
    let transitionId;
    let stateId;
    let stateName;
    let casosSembrados;

    const createCase = (overrides = {}) =>
        new CaseFactory(knexConfig).create({
            responsable_id: responsableId,
            transicion_id: transitionId,
            ...overrides,
        });

    beforeEach(async () => {
        responsableId = uuidv4();
        otherResponsableId = uuidv4();
        await ensureParentRow(repository.connection, 'usuarios', responsableId);
        await ensureParentRow(repository.connection, 'usuarios', otherResponsableId);

        const group = await new GroupFactory(knexConfig).create({});
        groupId = group.id.value;
        const otherGroup = await new GroupFactory(knexConfig).create({});
        otherGroupId = otherGroup.id.value;

        // One shared transition (with a real `estados` row behind `siguiente_estado_id`) so every
        // seeded case lands in the SAME, known estado. Deterministic without asserting on the
        // whole `estados` catalog.
        const transition = await new TransitionFactory(knexConfig).create({});
        transitionId = transition.id.value;
        stateId = transition.siguiente_estado_id.value;
        const state = await repository.connection('estados').where({ id: stateId }).first();
        stateName = state.nombre;

        const casoA = await createCase({ grupo_id: groupId, ans_posicion: 1 });
        const casoB = await createCase({ grupo_id: groupId, ans_posicion: 3, fecha_resolucion: new Date() });
        const casoC = await createCase({
            responsable_id: otherResponsableId,
            grupo_id: otherGroupId,
            ans_posicion: 2,
        });

        casosSembrados = [casoA, casoB, casoC];
    });

    describe('countCreatedToday', () => {
        it('counts every case created today when no pattern is given', async () => {
            const total = await repository.countCreatedToday();

            expect(total).toBe(casosSembrados.length);
        });

        it('counts only the cases whose external_code matches the given LIKE pattern', async () => {
            const uniquePrefix = `CTD-${uuidv4().slice(0, 8)}`;
            await createCase({ grupo_id: groupId, external_code: `${uniquePrefix}-001` });
            await createCase({ grupo_id: groupId, external_code: `${uniquePrefix}-002` });
            await createCase({ grupo_id: groupId, external_code: 'OTHER-999' });

            const total = await repository.countCreatedToday(`${uniquePrefix}%`);

            expect(total).toBe(2);
        });
    });

    describe('casesCounter', () => {
        // `casesCounter` delegates to `this.getAggregatedStats(...)`, a method that does not
        // exist anywhere in this class or its base `KnexRepository` (confirmed by grepping the
        // whole package). Every call throws a TypeError inside the try block, which the method
        // wraps into `QueryDBError('count')`. This is the CURRENT, real behavior — not the
        // behavior the task brief assumed — so the test locks that behavior instead of the
        // never-reachable "returns totals" path.
        it('always rejects because getAggregatedStats does not exist on the repository', async () => {
            await expect(repository.casesCounter({})).rejects.toThrow(QueryDBError);
            await expect(repository.casesCounter()).rejects.toThrow('Transaction failed: error counting records.');
        });
    });

    describe('casesCounterByGroup', () => {
        it('defaults filters to {} and groups counts by grupo_id, keyed by group, with per-estado counters', async () => {
            const result = await repository.casesCounterByGroup();

            const groupEntry = result[0][groupId];
            expect(groupEntry.estados).toEqual([{ id: stateId, estado: stateName, count: 2 }]);
        });

        it('applies the given filters to the underlying cases join', async () => {
            const result = await repository.casesCounterByGroup({ ans_posicion: 1 });

            const groupEntry = result[0][groupId];
            expect(groupEntry.estados).toEqual([{ id: stateId, estado: stateName, count: 1 }]);
        });
    });

    describe('casesCounterByResponsible', () => {
        it('defaults filters to {} and groups counts by responsable_id', async () => {
            const result = await repository.casesCounterByResponsible();

            const responsableEntry = result[0][responsableId];
            expect(responsableEntry.estados).toEqual([{ id: stateId, estado: stateName, count: 2 }]);
        });

        it('applies the given filters to the underlying cases join', async () => {
            const result = await repository.casesCounterByResponsible({ ans_posicion: 3 });

            const responsableEntry = result[0][responsableId];
            expect(responsableEntry.estados).toEqual([{ id: stateId, estado: stateName, count: 1 }]);
        });
    });

    describe('getCountsByStatus', () => {
        it('rejects when filters is not a plain object', async () => {
            await expect(
                repository.getCountsByStatus('grupos', { name: 'nombre' }, 'grupo_id', 'not-an-object')
            ).rejects.toThrow('El parámetro filters debe ser un objeto válido');
        });

        it('rejects when filters is null', async () => {
            await expect(repository.getCountsByStatus('grupos', { name: 'nombre' }, 'grupo_id', null)).rejects.toThrow(
                'El parámetro filters debe ser un objeto válido'
            );
        });

        it('defaults filters to {} when omitted', async () => {
            const result = await repository.getCountsByStatus('grupos', { name: 'nombre' }, 'grupo_id');

            const groupEntry = result[0][groupId];
            expect(groupEntry.estados).toEqual([{ id: stateId, estado: stateName, count: 2 }]);
        });

        it('re-uses an existing group entry across multiple distinct estados, and falls back to "Desconocido" when the estado is unknown or missing', async () => {
            const multiGroup = await new GroupFactory(knexConfig).create({});
            const multiGroupId = multiGroup.id.value;

            // A second real transition/estado, distinct from the shared one.
            const transition2 = await new TransitionFactory(knexConfig).create({});
            const state2 = await repository
                .connection('estados')
                .where({ id: transition2.siguiente_estado_id.value })
                .first();

            // A transition whose estado was later soft-deleted: estado_id is present but absent
            // from the (whereNull('deleted_by')) estadosMap lookup.
            const transition3 = await new TransitionFactory(knexConfig).create({});
            await repository.connection('estados').where({ id: transition3.siguiente_estado_id.value }).update({
                deleted_by: uuidv4(),
            });

            // A transition with no estado at all (both estado_actual_id and siguiente_estado_id
            // null). `Transitions` forbids constructing one with a null siguiente_estado_id, so —
            // like the "no shift_management" group above — this row is built with a direct insert.
            const transition4Id = uuidv4();
            await repository.connection('transiciones').insert({
                id: transition4Id,
                estado_actual_id: null,
                siguiente_estado_id: null,
                flujo_id: null,
                status: 1,
                created_by: uuidv4(),
                created_at: new Date(),
            });

            await createCase({ grupo_id: multiGroupId, transicion_id: transitionId });
            await createCase({ grupo_id: multiGroupId, transicion_id: transition2.id.value });
            await createCase({ grupo_id: multiGroupId, transicion_id: transition3.id.value });
            await createCase({ grupo_id: multiGroupId, transicion_id: transition4Id });

            const result = await repository.getCountsByStatus('grupos', { name: 'nombre' }, 'grupo_id', {});
            const entry = result[0][multiGroupId];

            expect(entry.estados).toEqual(
                expect.arrayContaining([
                    { id: stateId, estado: stateName, count: 1 },
                    { id: state2.id, estado: state2.nombre, count: 1 },
                    { id: transition3.siguiente_estado_id.value, estado: 'Desconocido', count: 1 },
                    { id: null, estado: 'Desconocido', count: 1 },
                ])
            );
            expect(entry.estados).toHaveLength(4);
        });
    });

    describe('getCountsWithReferences', () => {
        // Filters on `cases.fecha_resolucion IS NULL`: casoB (ans_posicion 3) is resolved and
        // excluded, leaving casoA and casoC — both routed through the same shared transition/estado.
        it('defaults filters to {} and counts unresolved cases by estado when no filters are given', async () => {
            const result = await repository.getCountsWithReferences();

            const row = result.find((r) => r.id === stateId);
            expect(Number(row.count)).toBe(2);
        });

        it('restricts the count to cases matching field/value filters', async () => {
            const result = await repository.getCountsWithReferences({ field: 'ans_posicion', value: 1 });

            const row = result.find((r) => r.id === stateId);
            expect(Number(row.count)).toBe(1);
        });
    });

    describe('findByIds', () => {
        it('returns an empty array for an empty id list', async () => {
            const encontrados = await repository.findByIds([]);

            expect(encontrados).toEqual([]);
        });

        it('returns plain rows (not Case entities) only for the ids that exist', async () => {
            const existente = casosSembrados[0].id.value;
            const encontrados = await repository.findByIds([existente, '00000000-0000-0000-0000-000000000000']);

            expect(encontrados).toHaveLength(1);
            expect(encontrados[0].id).toBe(existente);
            expect(typeof encontrados[0].id).toBe('string');
        });

        // The real consumer is `findAndValidateCases` (src/cases/domain/BulkCaseValidator.js),
        // which always passes both { trx, forUpdate }. No test in this package previously
        // exercised either option against KnexCaseRepository directly.
        it('runs on the caller-provided transaction when trx is given', async () => {
            const existente = casosSembrados[0].id.value;

            const encontrados = await repository.connection.transaction((trx) =>
                repository.findByIds([existente], { trx })
            );

            expect(encontrados).toHaveLength(1);
            expect(encontrados[0].id).toBe(existente);
        });

        // Verified deterministically (no sleeps/races) via a competing SELECT ... FOR UPDATE on
        // the SAME row from a second, independent transaction, with a short `lock_timeout`: if the
        // first call really took the row lock, the competing statement fails FAST with Postgres
        // error 55P03 instead of racing a wall-clock guess.
        const attemptCompetingRowLock = (id) =>
            repository.connection.transaction(async (trx2) => {
                await trx2.raw("SET LOCAL lock_timeout = '300ms'");
                return trx2.raw('SELECT id FROM cases WHERE id = ? FOR UPDATE', [id]);
            });

        it('acquires a row-level lock when forUpdate is true, blocking a concurrent FOR UPDATE on the same row', async () => {
            const existente = casosSembrados[0].id.value;
            const trx = await repository.connection.transaction();

            try {
                await repository.findByIds([existente], { trx, forUpdate: true });

                await expect(attemptCompetingRowLock(existente)).rejects.toThrow(/lock/i);
            } finally {
                await trx.rollback();
            }
        });

        it('does not block a concurrent FOR UPDATE on the same row when forUpdate is omitted', async () => {
            const existente = casosSembrados[0].id.value;
            const trx = await repository.connection.transaction();

            try {
                await repository.findByIds([existente], { trx });

                await expect(attemptCompetingRowLock(existente)).resolves.toBeDefined();
            } finally {
                await trx.rollback();
            }
        });
    });

    describe('searchWithAllRelations', () => {
        const criteriaFor = (value) =>
            new Criteria(
                [{ field: 'ans_posicion', operator: 'eq', value, type: 'AND' }],
                null,
                null,
                null,
                null,
                repository.tableName
            );

        it('returns [] without enriching anything when no case matches the criteria', async () => {
            const result = await repository.searchWithAllRelations(criteriaFor(999));

            expect(result).toEqual([]);
        });

        it('enriches each matching row with the full case-information relations', async () => {
            // Ground truth read straight from `clients` with the SAME projection the repository
            // uses, so `cliente` has to be THAT client's real payload — not merely "defined".
            const expectedCliente = await repository
                .connection('clients')
                .select(
                    'tipo_cliente',
                    'tipo_documento',
                    'documento',
                    'nombres',
                    'apellido1',
                    'apellido2',
                    'nombre_empresa',
                    'sexo',
                    'estado_civil',
                    'fecha_nacimiento',
                    'email',
                    'email_alterno',
                    'telefono',
                    'telefono_alterno'
                )
                .where({ id: casosSembrados[0].cliente_id.value })
                .first();
            // Sanity: the fixture client has real data, so the comparison is not two empty shapes.
            expect(expectedCliente.documento).toBeTruthy();

            const result = await repository.searchWithAllRelations(criteriaFor(1));

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe(casosSembrados[0].id.value);
            expect(result[0].cliente).toEqual(expectedCliente);
        });
    });

    describe('getCaseInformationWithAllRelations', () => {
        it('returns null when the case does not exist', async () => {
            const result = await repository.getCaseInformationWithAllRelations({ value: uuidv4() });

            expect(result).toBeNull();
        });

        it('leaves parent unset when parent_id points at a row that no longer exists', async () => {
            const kase = await createCase({ grupo_id: groupId, parent_id: uuidv4() });

            const result = await repository.getCaseInformationWithAllRelations(kase.id);

            expect(result.parent).toBeUndefined();
        });

        it('includes aux_client data when the client has an aux_clients row', async () => {
            // Decoy row FIRST: a second client with its own aux_clients payload. Without the
            // `cliente_id` scoping in the repository the unqualified `.first()` picks this one up,
            // which is exactly the cross-client data leak this test has to catch.
            const otroKase = await createCase({ grupo_id: groupId });
            await repository.connection('aux_clients').insert({
                id: uuidv4(),
                cliente_id: otroKase.cliente_id.value,
                data: JSON.stringify({ nota: 'otro-cliente-no-debe-filtrarse' }),
            });

            const kase = await createCase({ grupo_id: groupId });
            await repository.connection('aux_clients').insert({
                id: uuidv4(),
                cliente_id: kase.cliente_id.value,
                data: JSON.stringify({ nota: 'vip' }),
            });

            const result = await repository.getCaseInformationWithAllRelations(kase.id);

            expect(result.aux_client).toBeDefined();
            expect(result.aux_client.cliente_id).toBe(kase.cliente_id.value);
            expect(result.aux_client.data).toEqual({ nota: 'vip' });
        });

        it('resolves estado_actual (not just siguiente_estado) when the transition has one', async () => {
            const transition2 = await new TransitionFactory(knexConfig).create({});
            // A DIFFERENT `estados` row for estado_actual_id: pointing both FKs at the same row (as
            // this fixture used to) makes the test blind to reading the wrong column.
            const estadoActual = await new StateFactory(knexConfig).create({});
            await repository.connection('transiciones').where({ id: transition2.id.value }).update({
                estado_actual_id: estadoActual.id.value,
            });
            const expectedEstadoActual = await repository
                .connection('estados')
                .select('nombre', 'tipo_id', 'descripcion', 'icon_class', 'status', 'color', 'require_observation')
                .where({ id: estadoActual.id.value })
                .first();
            const siguienteEstadoRow = await repository
                .connection('estados')
                .where({ id: transition2.siguiente_estado_id.value })
                .first();
            // Sanity: the two states really are distinguishable by name.
            expect(expectedEstadoActual.nombre).not.toBe(siguienteEstadoRow.nombre);

            const kase = await createCase({ grupo_id: groupId, transicion_id: transition2.id.value });

            const result = await repository.getCaseInformationWithAllRelations(kase.id);

            expect(result.transicion.estado_actual).toEqual(expectedEstadoActual);
            expect(result.transicion.estado_actual.nombre).toBe(expectedEstadoActual.nombre);
            expect(result.transicion.estado_actual.nombre).not.toBe(siguienteEstadoRow.nombre);
        });

        it('leaves siguiente_estado/transitions_available unset when the transition has no siguiente_estado_id', async () => {
            // `Transitions` forbids a null siguiente_estado_id, so — like the "no shift_management"
            // group and the "no estado" transition elsewhere in this suite — this row needs a
            // direct insert.
            const noNextStateTransitionId = uuidv4();
            await repository.connection('transiciones').insert({
                id: noNextStateTransitionId,
                estado_actual_id: null,
                siguiente_estado_id: null,
                flujo_id: null,
                status: 1,
                created_by: uuidv4(),
                created_at: new Date(),
            });
            const kase = await createCase({ grupo_id: groupId, transicion_id: noNextStateTransitionId });

            const result = await repository.getCaseInformationWithAllRelations(kase.id);

            expect(result.transicion.siguiente_estado).toBeUndefined();
        });

        it('resolves caso_clonado and a full parent context when they are present', async () => {
            // NOTE (production bug, not fixed here — out of scope, see task report): the `grupo`
            // lookup above only `.select('nombre', 'descripcion')`, never `id`, so `grupo?.id` is
            // always undefined and the `onescript` block (clasificacion?.id && grupo?.id) can
            // never run. Confirmed by inserting a real classification_group_relationships +
            // one-script row here: `result.one_script` stays null regardless. Not asserted on.
            const cloneSource = casosSembrados[0];

            // Dedicated responsable with real (non-null) fields, so `result.parent.responsable`
            // can be checked against a concrete value instead of an all-null shell — the shared
            // `responsableId` row from beforeEach only has `id` set.
            const parentResponsableId = uuidv4();
            await ensureParentRow(repository.connection, 'usuarios', parentResponsableId, {
                nombres: 'Ana',
                apellido1: 'Gomez',
                is_active: 1,
            });

            const parentCase = await createCase({
                grupo_id: groupId,
                clasificacion_id: cloneSource.clasificacion_id.value,
                caso_clonado_id: cloneSource.id.value,
                responsable_id: parentResponsableId,
            });
            const childCase = await createCase({
                grupo_id: groupId,
                clasificacion_id: cloneSource.clasificacion_id.value,
                parent_id: parentCase.id.value,
                caso_clonado_id: cloneSource.id.value,
            });

            // Ground truth: the exact rows the parent-context sub-queries select from, fetched
            // independently so the assertions below are falsifiable — `toBeDefined()`/`not.toBeNull()`
            // would not catch `p_cliente` (etc.) being left at their unconditional `null`
            // initializer when the surrounding `if (parentRow.X_id)` never runs.
            const expectedCliente = await repository
                .connection('clients')
                .select(
                    'tipo_cliente',
                    'tipo_documento',
                    'documento',
                    'nombres',
                    'apellido1',
                    'apellido2',
                    'nombre_empresa',
                    'sexo',
                    'estado_civil',
                    'fecha_nacimiento',
                    'email',
                    'email_alterno',
                    'telefono',
                    'telefono_alterno'
                )
                .where({ id: parentCase.cliente_id.value })
                .first();
            const expectedTransicion = await repository
                .connection('transiciones')
                .select('estado_actual_id', 'siguiente_estado_id', 'flujo_id', 'status')
                .where({ id: parentCase.transicion_id.value })
                .first();
            const expectedResponsable = await repository
                .connection('usuarios')
                .select('nombres', 'apellido1', 'apellido2', 'email', 'telefono', 'movil', 'is_active')
                .where({ id: parentResponsableId })
                .first();
            const expectedClasificacion = await repository
                .connection('clasificaciones')
                .select('description')
                .where({ id: parentCase.clasificacion_id.value })
                .first();
            const expectedGrupo = await repository
                .connection('grupos')
                .select('nombre', 'descripcion')
                .where({ id: parentCase.grupo_id.value })
                .first();

            // Sanity: the responsable's own real field made it into the ground truth, so the
            // comparison below is not accidentally comparing two all-null shapes.
            expect(expectedResponsable.nombres).toBe('Ana');

            const result = await repository.getCaseInformationWithAllRelations(childCase.id);

            expect(result.caso_clonado.id).toBe(cloneSource.id.value);
            expect(result.parent).toBeDefined();
            expect(result.parent.id).toBe(parentCase.id.value);
            expect(result.parent.cliente).toEqual(expectedCliente);
            expect(result.parent.transicion).toEqual(expectedTransicion);
            expect(result.parent.responsable).toEqual(expectedResponsable);
            expect(result.parent.clasificacion).toEqual(expectedClasificacion);
            expect(result.parent.grupo).toEqual(expectedGrupo);
            // The parent is ITSELF a clone, exercising the parent-side caso_clonado branch too.
            expect(result.parent.caso_clonado.id).toBe(cloneSource.id.value);
        });
    });

    describe('findOrderedIdsMatchingCondition', () => {
        it('defaults options to {} — no restriction, no limit, base id ordering', async () => {
            const ids = await repository.findOrderedIdsMatchingCondition({ 'cases.fecha_resolucion': null });

            // Only casoA and casoC are unresolved; casoB has fecha_resolucion set.
            const expected = [casosSembrados[0].id.value, casosSembrados[2].id.value].sort();
            expect(ids).toEqual(expected);
        });

        it('silently skips a work_queue_sorting_rule with an unsafe aux_cases json path instead of building it into SQL', async () => {
            const ids = await repository.findOrderedIdsMatchingCondition(
                { 'cases.fecha_resolucion': null },
                {
                    restrictToIds: [casosSembrados[0].id.value, casosSembrados[2].id.value],
                    work_queue_sorting_rules: [{ assign_strategy: 'aux_cases.bad;segment', order_type: 'ASC' }],
                    limit: 10,
                }
            );

            expect(ids.sort()).toEqual([casosSembrados[0].id.value, casosSembrados[2].id.value].sort());
        });

        it('silently skips a work_queue_sorting_rule with an unsafe plain column name instead of building it into SQL', async () => {
            const ids = await repository.findOrderedIdsMatchingCondition(
                { 'cases.fecha_resolucion': null },
                {
                    restrictToIds: [casosSembrados[0].id.value, casosSembrados[2].id.value],
                    work_queue_sorting_rules: [
                        { assign_strategy: 'created_at; DROP TABLE cases;--', order_type: 'ASC' },
                    ],
                    limit: 10,
                }
            );

            expect(ids.sort()).toEqual([casosSembrados[0].id.value, casosSembrados[2].id.value].sort());
        });
    });

    describe('findUnresolvedByMeasurementType / findUnresolvedByMeasurementTypePaginated — malformed data', () => {
        // Both methods build their row set from #buildBaseQueryAns() and hand it to the private
        // #prepareEntities(), which throws a CustomError (NOT wrapped in QueryDBError) when a
        // matched case's group has no shift_management configured. `grupos.horario_id` is
        // nullable at the DB level even though the domain entity (Groups) forbids constructing
        // one with a null horario_id — so the only way to produce this row is a direct insert,
        // bypassing GroupFactory/Groups. That is exactly the anomaly this precondition guards
        // against (see the comment above `#prepareEntities`), so it is a faithful reproduction,
        // not a workaround.
        let orphanCaseId;

        beforeEach(async () => {
            const ans = await new AnsFactory(knexConfig).create({ medicion_ans_id: 'Days' });
            const classification = await new ClassificationFactory(knexConfig).create({ ans_id: ans.id.value });

            const noShiftGroupId = uuidv4();
            await repository.connection('grupos').insert({
                id: noShiftGroupId,
                nombre: 'sin-horario',
                status: 1,
                horario_id: null,
                rol_id: null,
                configuration_id: null,
                created_by: uuidv4(),
                created_at: new Date(),
            });

            const orphanCase = await createCase({
                grupo_id: noShiftGroupId,
                clasificacion_id: classification.id.value,
                fecha_resolucion: null,
            });
            orphanCaseId = orphanCase.id.value;
        });

        it('findUnresolvedByMeasurementTypePaginated lets the CustomError surface instead of wrapping it in QueryDBError', async () => {
            await expect(
                repository.findUnresolvedByMeasurementTypePaginated({
                    measurementType: 'Days',
                    afterId: null,
                    limit: 10,
                })
            ).rejects.toThrow(CustomError);
            await expect(
                repository.findUnresolvedByMeasurementTypePaginated({
                    measurementType: 'Days',
                    afterId: null,
                    limit: 10,
                })
            ).rejects.toThrow(/horario/);
        });

        it('findUnresolvedByMeasurementType lets the CustomError surface instead of wrapping it in QueryDBError', async () => {
            await expect(repository.findUnresolvedByMeasurementType('Days')).rejects.toThrow(CustomError);
            await expect(repository.findUnresolvedByMeasurementType('Days')).rejects.toThrow(/horario/);
            // sanity: the orphan case is real and would otherwise have matched
            expect(orphanCaseId).toBeDefined();
        });
    });

    describe('findByIdForAvailableStates', () => {
        it('returns null when the case does not exist', async () => {
            const result = await repository.findByIdForAvailableStates({ value: uuidv4() });

            expect(result).toBeNull();
        });
    });

    describe('getOneScriptUrl', () => {
        it('returns undefined when there is no classification/group relationship', async () => {
            const result = await repository.getOneScriptUrl(uuidv4(), uuidv4());

            expect(result).toBeUndefined();
        });

        it('returns the one-script url when the relationship exists', async () => {
            const classification = await new ClassificationFactory(knexConfig).create({});
            const scriptId = uuidv4();
            await repository.connection('one-script').insert({
                id: scriptId,
                name: 'script',
                url: 'https://example.test/script',
            });
            await repository.connection('classification_group_relationships').insert({
                classification_id: classification.id.value,
                group_id: groupId,
                form: scriptId,
            });

            const result = await repository.getOneScriptUrl(classification.id.value, groupId);

            expect(result).toBe('https://example.test/script');
        });
    });

    describe('findByIdForAns', () => {
        it('returns [] when the case does not exist', async () => {
            const result = await repository.findByIdForAns({ value: uuidv4() });

            expect(result).toEqual([]);
        });

        it('returns the prepared entity when the case has ans and shift_management configured', async () => {
            const result = await repository.findByIdForAns({ value: casosSembrados[0].id.value });

            expect(result).toHaveLength(1);
            expect(result[0].kase.id.value).toBe(casosSembrados[0].id.value);
        });
    });

    describe('findByExternalCode', () => {
        it('returns null when no case has the given external_code', async () => {
            const result = await repository.findByExternalCode(`missing-${uuidv4()}`);

            expect(result).toBeNull();
        });

        it('returns a Case instance when a case has the given external_code', async () => {
            const code = `FEC-${uuidv4()}`;
            await createCase({ grupo_id: groupId, external_code: code });

            const result = await repository.findByExternalCode(code);

            expect(result).toBeInstanceOf(Case);
            expect(result.external_code.value).toBe(code);
        });
    });

    describe('updateByCriteria', () => {
        it('returns [] without updating anything when no case matches the criteria', async () => {
            const criteria = new Criteria(
                [{ field: 'ans_posicion', operator: 'eq', value: 999, type: 'AND' }],
                null,
                null,
                null,
                null,
                repository.tableName
            );

            const result = await repository.updateByCriteria(criteria, { is_visible: false });

            expect(result).toEqual([]);
        });
    });

    describe('findSummaryByIds', () => {
        it('returns [] when ids is not an array', async () => {
            const result = await repository.findSummaryByIds('not-an-array');

            expect(result).toEqual([]);
        });

        it('returns [] for an empty id list', async () => {
            const result = await repository.findSummaryByIds([]);

            expect(result).toEqual([]);
        });
    });

    describe('findTransitionsByCaseId', () => {
        it('returns null when the case has no history_cases rows', async () => {
            const result = await repository.findTransitionsByCaseId({ value: casosSembrados[0].id.value });

            expect(result).toBeNull();
        });
    });

    describe('findByReference', () => {
        it('returns null when no case has the given reference', async () => {
            const result = await repository.findByReference({ value: 999999999 });

            expect(result).toBeNull();
        });

        it('returns a Case instance when a case has the given reference', async () => {
            // `reference` is a DB-generated SERIAL, not part of the INSERT payload built by
            // CaseFactory/Case — read it back from the row itself rather than trusting the
            // in-memory entity to have it populated.
            const row = await repository.connection('cases').where({ id: casosSembrados[0].id.value }).first();

            const result = await repository.findByReference({ value: row.reference });

            expect(result).toBeInstanceOf(Case);
            expect(result.id.value).toBe(casosSembrados[0].id.value);
        });
    });

    describe('findByDescriptionId', () => {
        it('returns null when no case has the given descripcion_caso_id', async () => {
            const result = await repository.findByDescriptionId({ value: uuidv4() });

            expect(result).toBeNull();
        });

        it('returns a Case instance when a case has the given descripcion_caso_id', async () => {
            const descriptionId = casosSembrados[0].descripcion_caso_id.value;

            const result = await repository.findByDescriptionId({ value: descriptionId });

            expect(result).toBeInstanceOf(Case);
            expect(result.id.value).toBe(casosSembrados[0].id.value);
        });
    });

    describe('save', () => {
        it('inserts atomically on the caller-provided transaction', async () => {
            const kase = await new CaseFactory(knexConfig).make({
                responsable_id: responsableId,
                grupo_id: groupId,
                transicion_id: transitionId,
            });

            const saved = await repository.connection.transaction((trx) => repository.save(kase, trx));

            expect(saved.id.value).toBe(kase.id.value);
            const persisted = await repository.connection('cases').where({ id: kase.id.value }).first();
            expect(persisted).toBeDefined();
        });

        it('is rolled back with the caller transaction — the INSERT never runs on its own connection', async () => {
            // Atomicity, for real: if `save` ignored the caller's trx and wrote on the pooled
            // connection instead, the row would survive the ROLLBACK below.
            const kase = await new CaseFactory(knexConfig).make({
                responsable_id: responsableId,
                grupo_id: groupId,
                transicion_id: transitionId,
            });

            const trx = await repository.connection.transaction();
            try {
                await repository.save(kase, trx);

                // Visible INSIDE the transaction...
                const dentroDeLaTrx = await trx('cases').where({ id: kase.id.value }).first();
                expect(dentroDeLaTrx).toBeDefined();
            } finally {
                await trx.rollback();
            }

            // ...and gone once the caller's transaction is undone.
            const persisted = await repository.connection('cases').where({ id: kase.id.value }).first();
            expect(persisted).toBeUndefined();
        });
    });
});

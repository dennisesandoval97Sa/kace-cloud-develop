import { v4 as uuidv4 } from 'uuid';
import { AuxCasesUpdater, KnexAuxCasesRepository } from '../../src/aux_casos/index.js';
import { KnexCaseRepository } from '../../src/cases/index.js';
import { ModelValueSaver } from '../../src/actions/domain/ModelValueSaver.js';
import { KnexClientRepository } from '../../src/clients/index.js';
import { KnexGroupsRepository } from '../../src/grupos/index.js';
import { KnexGlobalConfigurationRepository } from '../../src/global-config/index.js';
import { CaseFactory } from '../../src/factories/CaseFactory.js';
import { knexConfig } from '../knexfile.js';
import TestHelper from '../TestHelper.js';
import { AuxCasesMother } from './domain/AuxCasesMother.js';
import UsersMother from '../users/domain/UsersMother.js';
import { User } from '../../src/users/index.js';
import { InvalidArgumentError } from '../../src/shared/errors/InvalidArgumentError.js';
import { EntityCache } from '../../src/shared/index.js';
import { ensureParentRow } from '../support/ensureParentRow.js';

const currentUser = new User({
    permissions: { administrador: [{ module_id: 'cases', name: 'CaseUpdateNotOwner', granted: true }] },
    ...UsersMother.dto(),
});

describe('AuxCases PostgreSQL Integration — updateDataFields (jsonb_set)', () => {
    const auxCaseRepository = new KnexAuxCasesRepository(knexConfig);
    const db = auxCaseRepository.connection;

    let trx;
    let createCase;
    let caseRepository;
    let clientRepository;
    let groupsRepository;
    let globalConfigurationRepository;
    let auxCaseRepositoryTrx;

    /**
     * `CaseFactory` resuelve `responsable_id` con `UserFactory` cuando el llamante no lo pasa, y
     * `UserFactory` genera los apellidos con `chance.last()`, que emite `O'connor` o `D'Angelo`
     * en torno al 0.45% de las veces. `ValueObjectUserName` rechaza el apostrofe ASCII, asi que
     * cada uno de los doce casos que siembra este archivo era una tirada de dados que lo tumbaba
     * con un `Error creating factory instance` imputado a un `it` al azar. Con un responsable
     * propio -una fila minima en `usuarios`, sin nombres- la relacion no se resuelve.
     */
    beforeEach(async () => {
        trx = await db.transaction();

        const responsableId = uuidv4();
        await ensureParentRow(trx, 'usuarios', responsableId);
        const caseFactory = new CaseFactory(trx);
        createCase = (overrides = {}) => caseFactory.create({ responsable_id: responsableId, ...overrides });

        auxCaseRepositoryTrx = new KnexAuxCasesRepository(trx);
        caseRepository = new KnexCaseRepository(trx);
        clientRepository = new KnexClientRepository(trx);
        groupsRepository = new KnexGroupsRepository(trx);
        globalConfigurationRepository = new KnexGlobalConfigurationRepository(trx);
        EntityCache.clear();
    });

    afterEach(async () => {
        await trx.rollback();
    });

    afterAll(async () => {
        await auxCaseRepository.destroyConnection();
    });

    describe('KnexAuxCasesRepository.updateDataFields()', () => {
        it('updates a single flat field without touching the rest', async () => {
            const kase = await createCase();
            const auxCase = await AuxCasesMother.createAuxCase(auxCaseRepositoryTrx, {
                caso_id: kase.id.value,
                data: { field_a: 'original', field_b: 'untouched' },
            });

            await auxCaseRepositoryTrx.updateDataFields(auxCase.id, kase.id.value, [
                { path: 'field_a', value: 'updated' },
            ]);

            const row = await trx('aux_cases').where({ id: auxCase.id.value }).first();
            expect(row.data.field_a).toBe('updated');
            expect(row.data.field_b).toBe('untouched');
        });

        it('updates a nested path without replacing sibling keys', async () => {
            const kase = await createCase();
            const auxCase = await AuxCasesMother.createAuxCase(auxCaseRepositoryTrx, {
                caso_id: kase.id.value,
                data: { nested: { key_a: 10, key_b: 20 } },
            });

            await auxCaseRepositoryTrx.updateDataFields(auxCase.id, kase.id.value, [
                { path: 'nested.key_a', value: 99 },
            ]);

            const row = await trx('aux_cases').where({ id: auxCase.id.value }).first();
            expect(row.data.nested.key_a).toBe(99);
            expect(row.data.nested.key_b).toBe(20);
        });

        it('creates a new nested key if it did not exist (jsonb_set create_missing=true)', async () => {
            const kase = await createCase();
            const auxCase = await AuxCasesMother.createAuxCase(auxCaseRepositoryTrx, {
                caso_id: kase.id.value,
                data: { existing: 'value' },
            });

            await auxCaseRepositoryTrx.updateDataFields(auxCase.id, kase.id.value, [
                { path: 'new_key', value: 'hello' },
            ]);

            const row = await trx('aux_cases').where({ id: auxCase.id.value }).first();
            expect(row.data.new_key).toBe('hello');
            expect(row.data.existing).toBe('value');
        });

        it('applies multiple updates atomically in one query', async () => {
            const kase = await createCase();
            const auxCase = await AuxCasesMother.createAuxCase(auxCaseRepositoryTrx, {
                caso_id: kase.id.value,
                data: { a: 1, b: 2, c: 3 },
            });

            await auxCaseRepositoryTrx.updateDataFields(auxCase.id, kase.id.value, [
                { path: 'a', value: 10 },
                { path: 'b', value: 20 },
            ]);

            const row = await trx('aux_cases').where({ id: auxCase.id.value }).first();
            expect(row.data.a).toBe(10);
            expect(row.data.b).toBe(20);
            expect(row.data.c).toBe(3);
        });

        it('two sequential partial updates preserve sibling fields (jsonb_set non-destructive)', async () => {
            const kase = await createCase();
            const auxCase = await AuxCasesMother.createAuxCase(auxCaseRepositoryTrx, {
                caso_id: kase.id.value,
                data: { field1: 'v1', field2: 'v2' },
            });

            await auxCaseRepositoryTrx.updateDataFields(auxCase.id, kase.id.value, [
                { path: 'field2', value: 'v2_updated' },
            ]);

            await auxCaseRepositoryTrx.updateDataFields(auxCase.id, kase.id.value, [
                { path: 'field1', value: 'v1_updated' },
            ]);

            const row = await trx('aux_cases').where({ id: auxCase.id.value }).first();
            expect(row.data.field1).toBe('v1_updated');
            expect(row.data.field2).toBe('v2_updated');
        });

        it('stores array values correctly at a given path', async () => {
            const kase = await createCase();
            const auxCase = await AuxCasesMother.createAuxCase(auxCaseRepositoryTrx, {
                caso_id: kase.id.value,
                data: { items: [] },
            });

            const newItems = [
                { id: 1, label: 'first' },
                { id: 2, label: 'second' },
            ];

            await auxCaseRepositoryTrx.updateDataFields(auxCase.id, kase.id.value, [
                { path: 'items', value: newItems },
            ]);

            const row = await trx('aux_cases').where({ id: auxCase.id.value }).first();
            expect(row.data.items).toEqual(newItems);
        });

        it('invalidates cache after update so next findByCaseId fetches fresh data', async () => {
            const kase = await createCase();
            const auxCase = await AuxCasesMother.createAuxCase(auxCaseRepositoryTrx, {
                caso_id: kase.id.value,
                data: { counter: 0 },
            });

            const caseIdVO = { value: kase.id.value };
            const cached = await auxCaseRepositoryTrx.findByCaseId(caseIdVO);
            expect(cached.data.value.counter).toBe(0);

            await auxCaseRepositoryTrx.updateDataFields(auxCase.id, kase.id.value, [{ path: 'counter', value: 42 }]);

            const fresh = await auxCaseRepositoryTrx.findByCaseId(caseIdVO);
            expect(fresh.data.value.counter).toBe(42);
        });

        it('does nothing and does not throw when updates list is empty', async () => {
            const kase = await createCase();
            const auxCase = await AuxCasesMother.createAuxCase(auxCaseRepositoryTrx, {
                caso_id: kase.id.value,
                data: { value: 'original' },
            });

            await expect(auxCaseRepositoryTrx.updateDataFields(auxCase.id, kase.id.value, [])).resolves.not.toThrow();

            const row = await trx('aux_cases').where({ id: auxCase.id.value }).first();
            expect(row.data.value).toBe('original');
        });
    });

    describe('AuxCasesUpdater.executeJsonbUpdates()', () => {
        it('delegates to updateDataFields and applies partial updates', async () => {
            const kase = await createCase();
            const auxCase = await AuxCasesMother.createAuxCase(auxCaseRepositoryTrx, {
                caso_id: kase.id.value,
                data: { section: { x: 1, y: 2 } },
            });

            const updater = new AuxCasesUpdater(auxCaseRepositoryTrx, caseRepository, currentUser);
            await updater.executeJsonbUpdates([{ path: 'section.x', value: 99 }], auxCase.id.value, {});

            const row = await trx('aux_cases').where({ id: auxCase.id.value }).first();
            expect(row.data.section.x).toBe(99);
            expect(row.data.section.y).toBe(2);
        });
    });

    describe('ModelValueSaver — AuxCases path', () => {
        function buildSaver() {
            return new ModelValueSaver(
                caseRepository,
                clientRepository,
                auxCaseRepositoryTrx,
                null,
                groupsRepository,
                globalConfigurationRepository,
                null
            );
        }

        it('saveToAuxCase updates a nested field without overwriting other fields', async () => {
            const kase = await createCase();
            await AuxCasesMother.createAuxCase(auxCaseRepositoryTrx, {
                caso_id: kase.id.value,
                data: { campo_a: 'original', campo_b: 'kept' },
            });

            const saver = buildSaver();
            await saver.execute('AuxCases', 'campo_a', 'modified', kase);

            const row = await trx('aux_cases').where({ caso_id: kase.id.value }).first();
            expect(row.data.campo_a).toBe('modified');
            expect(row.data.campo_b).toBe('kept');
        });

        it('saveToAuxCase throws InvalidArgumentError when value equals current value', async () => {
            const kase = await createCase();
            await AuxCasesMother.createAuxCase(auxCaseRepositoryTrx, {
                caso_id: kase.id.value,
                data: { campo: 'same_value' },
            });

            const saver = buildSaver();
            await expect(saver.execute('AuxCases', 'campo', 'same_value', kase)).rejects.toThrow(InvalidArgumentError);
        });

        it('saveToAuxCase via executeV2 updates nested field by caso_id', async () => {
            const kase = await createCase();
            await AuxCasesMother.createAuxCase(auxCaseRepositoryTrx, {
                caso_id: kase.id.value,
                data: { form: { sub: 'old' } },
            });

            const saver = buildSaver();
            await saver.executeV2({
                modelName: 'AuxCases',
                field: 'form.sub',
                value: 'new',
                caso_id: kase.id.value,
                cliente_id: kase.cliente_id.value,
            });

            const row = await trx('aux_cases').where({ caso_id: kase.id.value }).first();
            expect(row.data.form.sub).toBe('new');
        });
    });
});

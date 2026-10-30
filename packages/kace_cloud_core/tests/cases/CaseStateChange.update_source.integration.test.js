import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import { CaseUpdater, CaseTransitionsFinder, KnexCaseRepository } from '../../src/cases/index.js';
import { KnexGroupsRepository } from '../../src/grupos';
import { KnexShiftManagementRepository } from '../../src/shift-management';
import { KnexClientRepository } from '../../src/clients';
import { KnexUsersRepository, User } from '../../src/users';
import { KnexClassificationRepository } from '../../src/classifications';
import CasesMother from './domain/CasesMother';
import ClientMother from '../clients/domain/ClientMother';
import UsersMother from '../users/domain/UsersMother';
import ClassificationsMother from '../classifications/domain/ClassificationsMother';
import { GroupsMother } from '../grupos/domain/GroupsMother';
import { ensureParentRow } from '../support/ensureParentRow.js';

describe('State change — update_source is never inherited (invariant)', () => {
    const repository = new KnexCaseRepository(knexConfig);
    const groupsRepository = new KnexGroupsRepository(repository.connection);
    const shiftManagementRepository = new KnexShiftManagementRepository(repository.connection);
    const clientRepository = new KnexClientRepository(repository.connection);
    const usersRepository = new KnexUsersRepository(repository.connection);
    const classificationRepository = new KnexClassificationRepository(repository.connection);

    const currentUser = new User({
        permissions: { administrador: [{ module_id: 'cases', name: 'CaseUpdateNotOwner', granted: true }] },
        ...UsersMother.dto(),
    });

    const actionExecutionServiceMock = { execute: jest.fn(async () => true) };
    const eventPublisherMock = { publishAll: jest.fn(async () => true) };
    const tenant = { id: { value: 'tenant-1' } };

    async function seedCase(update_source) {
        const client = await ClientMother.createClient(clientRepository);
        const responsible = await UsersMother.createUser(usersRepository);
        const classification = await ClassificationsMother.createClassification(classificationRepository);
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
        return CasesMother.createCase(repository, {
            cliente_id: client.id.value,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
            update_source,
        });
    }

    async function changeState(caseId, extraDto = {}) {
        const updater = new CaseUpdater(
            repository,
            actionExecutionServiceMock,
            currentUser,
            eventPublisherMock,
            tenant
        );
        const transicion_id = uuidv4();
        await ensureParentRow(repository.connection, 'transiciones', transicion_id);
        await updater.execute(caseId, {
            transicion_id,
            updated_at: new Date(),
            updated_by: currentUser.id.value,
            ...extraDto,
        });
    }

    async function getDbUpdateSource(caseId) {
        const row = await repository.connection('cases').first('update_source').where({ id: caseId });
        return row.update_source;
    }

    async function getHistorialUpdateSource(caseId) {
        const result = await new CaseTransitionsFinder(repository).execute(caseId);
        return result.toJson().data[0].update_source;
    }

    beforeEach(async () => {
        jest.clearAllMocks();
    });

    afterEach(async () => {
        jest.clearAllMocks();
    });

    describe('no update_source in dto — must always result in null', () => {
        it('previous=manual → null (does not inherit manual)', async () => {
            const kase = await seedCase('manual');
            await changeState(kase.id.value);

            expect(await getDbUpdateSource(kase.id.value)).toBeNull();
            expect(await getHistorialUpdateSource(kase.id.value)).toBeNull();
        });

        it('previous=bulk → null (does not inherit bulk)', async () => {
            const kase = await seedCase('bulk');
            await changeState(kase.id.value);

            expect(await getDbUpdateSource(kase.id.value)).toBeNull();
            expect(await getHistorialUpdateSource(kase.id.value)).toBeNull();
        });

        it('previous=null → null (stays null)', async () => {
            const kase = await seedCase(null);
            await changeState(kase.id.value);

            expect(await getDbUpdateSource(kase.id.value)).toBeNull();
            expect(await getHistorialUpdateSource(kase.id.value)).toBeNull();
        });
    });

    describe('explicit update_source in dto — provided value is respected', () => {
        it('previous=null + dto.update_source=manual → manual', async () => {
            const kase = await seedCase(null);
            await changeState(kase.id.value, { update_source: 'manual' });

            expect(await getDbUpdateSource(kase.id.value)).toBe('manual');
            expect(await getHistorialUpdateSource(kase.id.value)).toBe('manual');
        });

        it('previous=manual + dto.update_source=manual → manual', async () => {
            const kase = await seedCase('manual');
            await changeState(kase.id.value, { update_source: 'manual' });

            expect(await getDbUpdateSource(kase.id.value)).toBe('manual');
            expect(await getHistorialUpdateSource(kase.id.value)).toBe('manual');
        });

        it('previous=manual + dto.update_source=null → null (explicit null is respected)', async () => {
            const kase = await seedCase('manual');
            await changeState(kase.id.value, { update_source: null });

            expect(await getDbUpdateSource(kase.id.value)).toBeNull();
            expect(await getHistorialUpdateSource(kase.id.value)).toBeNull();
        });

        it('previous=null + dto.update_source=bulk → bulk', async () => {
            const kase = await seedCase(null);
            await changeState(kase.id.value, { update_source: 'bulk' });

            expect(await getDbUpdateSource(kase.id.value)).toBe('bulk');
            expect(await getHistorialUpdateSource(kase.id.value)).toBe('bulk');
        });
    });

    describe('multiple consecutive state changes', () => {
        it('manual → auto → auto: all automatic changes are null independently', async () => {
            const kase = await seedCase(null);

            await changeState(kase.id.value, { update_source: 'manual' });
            jest.clearAllMocks();

            await changeState(kase.id.value);
            expect(await getDbUpdateSource(kase.id.value)).toBeNull();
            expect(await getHistorialUpdateSource(kase.id.value)).toBeNull();
            jest.clearAllMocks();

            await changeState(kase.id.value);
            expect(await getDbUpdateSource(kase.id.value)).toBeNull();
            expect(await getHistorialUpdateSource(kase.id.value)).toBeNull();
        });

        it('auto → manual → auto: last automatic does not inherit the intermediate manual', async () => {
            const kase = await seedCase(null);

            await changeState(kase.id.value);
            jest.clearAllMocks();

            await changeState(kase.id.value, { update_source: 'manual' });
            jest.clearAllMocks();

            await changeState(kase.id.value);
            expect(await getDbUpdateSource(kase.id.value)).toBeNull();
            expect(await getHistorialUpdateSource(kase.id.value)).toBeNull();
        });

        it('bulk → manual → auto: history reflects each value correctly', async () => {
            const kase = await seedCase(null);

            await changeState(kase.id.value, { update_source: 'bulk' });
            jest.clearAllMocks();
            await changeState(kase.id.value, { update_source: 'manual' });
            jest.clearAllMocks();
            await changeState(kase.id.value);

            const transitions = await new CaseTransitionsFinder(repository)
                .execute(kase.id.value)
                .then((r) => r.toJson().data);

            expect(transitions[0].update_source).toBeNull();
            expect(transitions[1].update_source).toBe('manual');
            expect(transitions[2].update_source).toBe('bulk');
        });

        it('manual → auto → manual → auto → manual: each history position reflects its exact value', async () => {
            const kase = await seedCase(null);
            const updater = new CaseUpdater(repository, null, currentUser, null, tenant);

            const cambiarEstado = async (update_source) => {
                const transicion_id = uuidv4();
                await ensureParentRow(repository.connection, 'transiciones', transicion_id);
                return updater.execute(kase.id.value, {
                    transicion_id,
                    updated_at: new Date(),
                    updated_by: currentUser.id.value,
                    ...(update_source !== undefined ? { update_source } : {}),
                });
            };

            await cambiarEstado('manual');
            await cambiarEstado(undefined);
            await cambiarEstado('manual');
            await cambiarEstado(undefined);
            await cambiarEstado('manual');

            expect(await getDbUpdateSource(kase.id.value)).toBe('manual');

            const transitions = await new CaseTransitionsFinder(repository)
                .execute(kase.id.value)
                .then((r) => r.toJson().data);

            expect(transitions.length).toBeGreaterThanOrEqual(6);
            expect(transitions[0].update_source).toBe('manual');
            expect(transitions[1].update_source).toBeNull();
            expect(transitions[2].update_source).toBe('manual');
            expect(transitions[3].update_source).toBeNull();
            expect(transitions[4].update_source).toBe('manual');
            expect(transitions[5].update_source).toBeNull();
        });
    });
});

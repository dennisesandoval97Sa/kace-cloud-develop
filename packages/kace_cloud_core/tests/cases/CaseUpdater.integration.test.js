import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import { CaseUpdater, KnexCaseRepository, DomainCaseFinder } from '../../src/cases/index.js';
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
import { CASE_RECLASSIFY_PERMISSION } from '../../src/shared/index.js';

describe('CaseUpdater', () => {
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

    async function seedCase(overrides = {}) {
        const client = await ClientMother.createClient(clientRepository);
        const responsible = await UsersMother.createUser(usersRepository);
        const classification = await ClassificationsMother.createClassification(classificationRepository);
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
        return CasesMother.createCase(repository, {
            cliente_id: client.id.value,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
            ...overrides,
        });
    }

    function makeUpdater() {
        return new CaseUpdater(repository, actionExecutionServiceMock, currentUser, eventPublisherMock, tenant);
    }

    beforeEach(async () => {
        jest.clearAllMocks();
    });

    afterEach(async () => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    describe('update_source reset on transicion_id change (regression)', () => {
        it('should reset update_source to null when transicion_id changes without explicit update_source in dto', async () => {
            const newTransicionId = uuidv4();
            await ensureParentRow(repository.connection, 'transiciones', newTransicionId);
            const kase = await seedCase({ update_source: 'manual' });

            await makeUpdater().execute(kase.id.value, {
                transicion_id: newTransicionId,
                updated_at: new Date(),
                updated_by: currentUser.id.value,
            });

            const updated = await repository.connection('cases').first('*').where({ id: kase.id.value });
            expect(updated.update_source).toBeNull();

            const historyRow = await repository
                .connection('history_cases')
                .where({ entity_id: kase.id.value })
                .orderBy('created_at', 'desc')
                .first();
            const newAttributes =
                typeof historyRow.new_attributes === 'string'
                    ? JSON.parse(historyRow.new_attributes)
                    : historyRow.new_attributes;
            expect(newAttributes.update_source).toBeNull();
        });

        it('should preserve explicit update_source when provided in dto alongside transicion_id', async () => {
            const newTransicionId = uuidv4();
            await ensureParentRow(repository.connection, 'transiciones', newTransicionId);
            const kase = await seedCase({ update_source: null });

            await makeUpdater().execute(kase.id.value, {
                transicion_id: newTransicionId,
                update_source: 'manual',
                updated_at: new Date(),
                updated_by: currentUser.id.value,
            });

            const updated = await repository.connection('cases').first('*').where({ id: kase.id.value });
            expect(updated.update_source).toBe('manual');
        });

        it('should NOT reset update_source when only non-transition fields are updated', async () => {
            const kase = await seedCase({ update_source: 'manual' });

            await makeUpdater().execute(kase.id.value, {
                motivo_baja: 'algún motivo',
                updated_at: new Date(),
                updated_by: currentUser.id.value,
            });

            const updated = await repository.connection('cases').first('*').where({ id: kase.id.value });
            expect(updated.update_source).toBe('manual');
        });
    });

    describe('ALLOW_UPDATE_CLOSED_CASE flag', () => {
        it('updates a resolved case without SLA or domain events when allowUpdateClosedCase is true', async () => {
            const slaSpy = jest.spyOn(DomainCaseFinder.prototype, 'executeForAns');
            const kase = await seedCase({ fecha_resolucion: new Date().toISOString(), vista: 'before' });

            await makeUpdater().execute(
                kase.id.value,
                { vista: 'closed-edit', updated_at: new Date(), updated_by: currentUser.id.value },
                true,
                { allowUpdateClosedCase: true }
            );

            const updated = await repository.connection('cases').first('*').where({ id: kase.id.value });
            expect(updated.vista).toBe('closed-edit');
            expect(slaSpy).not.toHaveBeenCalled();
            expect(eventPublisherMock.publishAll).not.toHaveBeenCalled();
        });

        it('throws 403 for a resolved case when allowUpdateClosedCase is false', async () => {
            const kase = await seedCase({ fecha_resolucion: new Date().toISOString() });

            await expect(
                makeUpdater().execute(
                    kase.id.value,
                    { vista: 'closed-edit', updated_at: new Date(), updated_by: currentUser.id.value },
                    true,
                    { allowUpdateClosedCase: false }
                )
            ).rejects.toMatchObject({ statusCode: 403 });
        });

        it('runs SLA and publishes events for an open case even when allowUpdateClosedCase is true', async () => {
            const slaSpy = jest.spyOn(DomainCaseFinder.prototype, 'executeForAns');
            const kase = await seedCase({ fecha_resolucion: null, vista: 'before' });

            await makeUpdater().execute(
                kase.id.value,
                { vista: 'open-edit', updated_at: new Date(), updated_by: currentUser.id.value },
                true,
                { allowUpdateClosedCase: true }
            );

            expect(slaSpy).toHaveBeenCalledWith(kase.id.value);
            expect(eventPublisherMock.publishAll).toHaveBeenCalled();
        });

        it('runs SLA and publishes events for an open case when allowUpdateClosedCase is false', async () => {
            const slaSpy = jest.spyOn(DomainCaseFinder.prototype, 'executeForAns');
            const kase = await seedCase({ fecha_resolucion: null, vista: 'before' });

            await makeUpdater().execute(
                kase.id.value,
                { vista: 'open-edit-default', updated_at: new Date(), updated_by: currentUser.id.value },
                true,
                { allowUpdateClosedCase: false }
            );

            expect(slaSpy).toHaveBeenCalledWith(kase.id.value);
            expect(eventPublisherMock.publishAll).toHaveBeenCalled();
        });
    });

    /**
     * `requiredPermission` no apaga la autorización: la cambia por otra. Un no-responsable pasa
     * solo si trae la capacidad declarada, y el dominio lo comprueba sin depender de que el Lambda
     * lo haya hecho antes.
     */
    describe('requiredPermission option', () => {
        const makeUserWithReclassify = (granted) =>
            new User({
                permissions: { administrador: [{ module_id: 'cases', name: 'CaseReclassify', granted }] },
                ...UsersMother.dto(),
            });

        const strangerUser = makeUserWithReclassify(true);

        const makeUpdaterFor = (user) =>
            new CaseUpdater(repository, actionExecutionServiceMock, user, eventPublisherMock, tenant);

        it('throws 403 when a non-owner without CaseUpdateNotOwner updates by default', async () => {
            const kase = await seedCase();

            await expect(
                makeUpdaterFor(strangerUser).execute(kase.id.value, {
                    vista: 'stranger-edit',
                    updated_at: new Date(),
                    updated_by: strangerUser.id.value,
                })
            ).rejects.toMatchObject({ statusCode: 403 });
        });

        it('lets a non-owner update when they hold the declared permission', async () => {
            const kase = await seedCase({ vista: 'before' });

            await makeUpdaterFor(strangerUser).execute(
                kase.id.value,
                { vista: 'stranger-edit', updated_at: new Date(), updated_by: strangerUser.id.value },
                true,
                { requiredPermission: CASE_RECLASSIFY_PERMISSION }
            );

            const updated = await repository.connection('cases').first('*').where({ id: kase.id.value });
            expect(updated.vista).toBe('stranger-edit');
        });

        /**
         * El agujero que cerraba este hallazgo: antes bastaba con que el llamador pidiera saltarse
         * la propiedad del caso para que el dominio no comprobara NADA.
         */
        it('throws 403 when the user does not hold the declared permission', async () => {
            const kase = await seedCase({ vista: 'before' });
            const withoutPermission = makeUserWithReclassify(false);

            await expect(
                makeUpdaterFor(withoutPermission).execute(
                    kase.id.value,
                    { vista: 'stranger-edit', updated_at: new Date(), updated_by: withoutPermission.id.value },
                    true,
                    { requiredPermission: CASE_RECLASSIFY_PERMISSION }
                )
            ).rejects.toMatchObject({ statusCode: 403 });

            const untouched = await repository.connection('cases').first('*').where({ id: kase.id.value });
            expect(untouched.vista).toBe('before');
        });

        it('throws 403 when clasificacion_id changes without a declared CaseReclassify permission', async () => {
            const kase = await seedCase({ vista: 'before' });
            const otherClassification = await ClassificationsMother.createClassification(classificationRepository);

            await expect(
                makeUpdater().execute(kase.id.value, {
                    clasificacion_id: otherClassification.id.value,
                    updated_at: new Date(),
                    updated_by: currentUser.id.value,
                })
            ).rejects.toMatchObject({ statusCode: 403 });

            const untouched = await repository.connection('cases').first('*').where({ id: kase.id.value });
            expect(untouched.clasificacion_id).toBe(kase.clasificacion_id.value);
            expect(untouched.vista).toBe('before');
        });

        it('throws 500 when the declared permission is malformed, instead of a 403 that hides the bug', async () => {
            const kase = await seedCase({ vista: 'before' });

            await expect(
                makeUpdaterFor(strangerUser).execute(
                    kase.id.value,
                    { vista: 'stranger-edit', updated_at: new Date(), updated_by: strangerUser.id.value },
                    true,
                    { requiredPermission: { moduleId: 'cases' } }
                )
            ).rejects.toMatchObject({ statusCode: 500 });

            const untouched = await repository.connection('cases').first('*').where({ id: kase.id.value });
            expect(untouched.vista).toBe('before');
        });
    });

    describe('assignment_change_type tagging on responsible change', () => {
        it('tags assignment_change_type=manual when the responsible changes via update', async () => {
            const kase = await seedCase();
            const newResponsible = await UsersMother.createUser(usersRepository);

            await makeUpdater().execute(kase.id.value, {
                responsable_id: newResponsible.id.value,
                updated_at: new Date(),
                updated_by: currentUser.id.value,
            });

            const updated = await repository.connection('cases').first('*').where({ id: kase.id.value });
            expect(updated.responsable_id).toBe(newResponsible.id.value);
            expect(updated.assignment_change_type).toBe('manual');
        });
    });

    describe('edited_by and edited_at tracking', () => {
        it('should inject and persist edited_by and edited_at when updating case', async () => {
            const kase = await seedCase();
            expect(kase.edited_by.value).toBeNull();
            expect(kase.edited_at.value).toBeNull();

            await makeUpdater().execute(kase.id.value, {
                motivo_baja: 'motivo actualizado',
                updated_at: new Date().toISOString(),
                updated_by: currentUser.id.value,
            });

            const updated = await repository.connection('cases').first('*').where({ id: kase.id.value });
            expect(updated.edited_by).toBe(currentUser.id.value);
            expect(updated.edited_at).not.toBeNull();
        });

        it('should NOT inject or persist edited_by or edited_at when updating case with a service account (account_type = 2)', async () => {
            const kase = await seedCase();
            expect(kase.edited_by.value).toBeNull();
            expect(kase.edited_at.value).toBeNull();

            const serviceUser = new User({
                permissions: { administrador: [{ module_id: 'cases', name: 'CaseUpdateNotOwner', granted: true }] },
                ...UsersMother.dto(),
                account_type: 2,
            });

            const updater = new CaseUpdater(
                repository,
                actionExecutionServiceMock,
                serviceUser,
                eventPublisherMock,
                tenant
            );
            await updater.execute(kase.id.value, {
                motivo_baja: 'motivo por servicio',
                updated_at: new Date().toISOString(),
                updated_by: serviceUser.id.value,
            });

            const updated = await repository.connection('cases').first('*').where({ id: kase.id.value });
            expect(updated.edited_by).toBeNull();
            expect(updated.edited_at).toBeNull();
        });

        it('should not overwrite existing edited_by and edited_at when updating case with a service account', async () => {
            const kase = await seedCase();
            const originalEditedAt = new Date('2026-01-01T10:00:00Z').toISOString();
            await repository.connection('cases').where({ id: kase.id.value }).update({
                edited_by: currentUser.id.value,
                edited_at: originalEditedAt,
            });

            const serviceUser = new User({
                permissions: { administrador: [{ module_id: 'cases', name: 'CaseUpdateNotOwner', granted: true }] },
                ...UsersMother.dto(),
                account_type: 2,
            });

            const updater = new CaseUpdater(
                repository,
                actionExecutionServiceMock,
                serviceUser,
                eventPublisherMock,
                tenant
            );
            await updater.execute(kase.id.value, {
                motivo_baja: 'motivo actualizado por servicio',
                updated_at: new Date().toISOString(),
                updated_by: serviceUser.id.value,
            });

            const updated = await repository.connection('cases').first('*').where({ id: kase.id.value });
            expect(updated.edited_by).toBe(currentUser.id.value);
            expect(new Date(updated.edited_at).toISOString()).toBe(new Date(originalEditedAt).toISOString());
        });
    });
});

import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import { CaseReopener, KnexCaseRepository } from '../../src/cases/index.js';
import { KnexGroupsRepository } from '../../src/grupos';
import { KnexGlobalConfigurationRepository } from '../../src/global-config';
import { KnexShiftManagementRepository } from '../../src/shift-management';
import { KnexClientRepository } from '../../src/clients';
import { KnexUsersRepository } from '../../src/users';
import { KnexClassificationRepository } from '../../src/classifications';
import { CustomError } from '../../src/shared/index.js';
import { Settings } from '../../src/global-config';
import CasesMother from './domain/CasesMother';
import ClientMother from '../clients/domain/ClientMother';
import UsersMother from '../users/domain/UsersMother';
import ClassificationsMother from '../classifications/domain/ClassificationsMother';
import { GroupsMother } from '../grupos/domain/GroupsMother';
import { ensureParentRow } from '../support/ensureParentRow.js';
import { GlobalConfigurationsMother } from '../global-config/domain/GlobalConfigurationsMother.js';
import { SETTINGS } from '../global-config/domain/SettingsMother.js';
import CommentsMother from '../comments/domain/CommentsMother.js';
import { KnexCommentsRepository } from '../../src/comments/index.js';

describe('CaseReopener', () => {
    const repository = new KnexCaseRepository(knexConfig);
    const groupsRepository = new KnexGroupsRepository(repository.connection);
    const globalConfigurationRepository = new KnexGlobalConfigurationRepository(repository.connection);
    const shiftManagementRepository = new KnexShiftManagementRepository(repository.connection);
    const clientRepository = new KnexClientRepository(repository.connection);
    const usersRepository = new KnexUsersRepository(repository.connection);
    const classificationRepository = new KnexClassificationRepository(repository.connection);
    const commentsRepository = new KnexCommentsRepository(repository.connection);

    function reopenPayload() {
        return {
            fecha_resolucion: null,
            updated_at: new Date(),
            updated_by: UsersMother.dto().id,
        };
    }

    async function seedClosedCase(overrides = {}) {
        const client = await ClientMother.createClient(clientRepository);
        const responsible = await UsersMother.createUser(usersRepository);
        const classification = await ClassificationsMother.createClassification(classificationRepository);
        const group = overrides.grupo_id
            ? null
            : await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
        return CasesMother.createCase(repository, {
            cliente_id: client.id.value,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group?.id.value,
            fecha_resolucion: new Date(),
            ...overrides,
        });
    }

    async function createGroupWithReopenDays(days) {
        const settings = JSON.parse(JSON.stringify(SETTINGS));
        settings.behaviors.application.agente.casos.reopen_cases_only_last_days = days;
        const configuration = await GlobalConfigurationsMother.createConfiguration(globalConfigurationRepository, {
            settings: new Settings(settings).value,
        });
        return GroupsMother.createGroup(groupsRepository, shiftManagementRepository, {
            configuration_id: configuration.id.value,
        });
    }

    function makeReopener() {
        return new CaseReopener(repository, groupsRepository, globalConfigurationRepository, commentsRepository);
    }

    beforeEach(async () => {
        jest.clearAllMocks();
    });

    afterEach(async () => {
        jest.clearAllMocks();
    });

    describe('update_source reset on transicion_id change (regression)', () => {
        it('should reset update_source to null when transicion_id changes without explicit update_source in payload', async () => {
            const newTransicionId = uuidv4();
            await ensureParentRow(repository.connection, 'transiciones', newTransicionId);
            const kase = await seedClosedCase({ update_source: 'manual' });

            await makeReopener().execute(
                kase.id.value,
                {
                    transicion_id: newTransicionId,
                    fecha_resolucion: null,
                    updated_at: new Date(),
                    updated_by: UsersMother.dto().id,
                },
                { userGroupId: kase.grupo_id.value }
            );

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

        it('should preserve explicit update_source when provided in payload alongside transicion_id', async () => {
            const newTransicionId = uuidv4();
            await ensureParentRow(repository.connection, 'transiciones', newTransicionId);
            const kase = await seedClosedCase({ update_source: null });

            await makeReopener().execute(
                kase.id.value,
                {
                    transicion_id: newTransicionId,
                    update_source: 'manual',
                    fecha_resolucion: null,
                    updated_at: new Date(),
                    updated_by: UsersMother.dto().id,
                },
                { userGroupId: kase.grupo_id.value }
            );

            const updated = await repository.connection('cases').first('*').where({ id: kase.id.value });
            expect(updated.update_source).toBe('manual');
        });

        it('should NOT reset update_source when only non-transition fields are updated', async () => {
            const kase = await seedClosedCase({ update_source: 'manual' });

            await makeReopener().execute(
                kase.id.value,
                {
                    fecha_resolucion: null,
                    updated_at: new Date(),
                    updated_by: UsersMother.dto().id,
                },
                { userGroupId: kase.grupo_id.value }
            );

            const updated = await repository.connection('cases').first('*').where({ id: kase.id.value });
            expect(updated.update_source).toBe('manual');
        });
    });

    describe('reopen window from global config', () => {
        it('rejects when created_at is older than configured days', async () => {
            const userGroup = await createGroupWithReopenDays(7);
            const kase = await seedClosedCase({
                grupo_id: userGroup.id.value,
                created_at: new Date('2000-01-01T00:00:00.000Z'),
            });

            await expect(
                makeReopener().execute(kase.id.value, reopenPayload(), { userGroupId: userGroup.id.value })
            ).rejects.toThrow(CustomError);
        });

        it('allows an old case when configured days is 0', async () => {
            const userGroup = await createGroupWithReopenDays(0);
            const kase = await seedClosedCase({
                grupo_id: userGroup.id.value,
                created_at: new Date('2000-01-01T00:00:00.000Z'),
            });

            await makeReopener().execute(kase.id.value, reopenPayload(), { userGroupId: userGroup.id.value });

            const updated = await repository.connection('cases').first('*').where({ id: kase.id.value });
            expect(updated.fecha_resolucion).toBeNull();
        });

        it('rejects an old case using the persisted default window', async () => {
            const kase = await seedClosedCase({
                created_at: new Date('2000-01-01T00:00:00.000Z'),
            });

            await expect(
                makeReopener().execute(
                    kase.id.value,
                    {
                        fecha_resolucion: null,
                        updated_at: new Date(),
                        updated_by: UsersMother.dto().id,
                    },
                    { userGroupId: kase.grupo_id.value }
                )
            ).rejects.toThrow(CustomError);
        });

        it('propagates config load failures instead of applying the default window', async () => {
            const kase = await seedClosedCase();
            const reopener = makeReopener();
            reopener.agentCasesConfigFinder.execute = async (_grupo, options = {}) => {
                expect(options.failOnError).toBe(true);
                throw new CustomError('CASE_REOPEN_CONFIG_UNAVAILABLE', 503);
            };

            await expect(
                reopener.execute(kase.id.value, reopenPayload(), { userGroupId: kase.grupo_id.value })
            ).rejects.toMatchObject({ message: 'CASE_REOPEN_CONFIG_UNAVAILABLE', statusCode: 503 });
        });
    });

    describe('reopen window from the acting user group', () => {
        it('allows an old case when the user group is unlimited even if the case group is not', async () => {
            const caseGroup = await createGroupWithReopenDays(7);
            const userGroup = await createGroupWithReopenDays(0);
            const kase = await seedClosedCase({
                grupo_id: caseGroup.id.value,
                created_at: new Date('2000-01-01T00:00:00.000Z'),
            });

            await makeReopener().execute(kase.id.value, reopenPayload(), { userGroupId: userGroup.id.value });

            const updated = await repository.connection('cases').first('*').where({ id: kase.id.value });
            expect(updated.fecha_resolucion).toBeNull();
        });

        it('rejects an old case when the user group window is exceeded even if the case group is unlimited', async () => {
            const caseGroup = await createGroupWithReopenDays(0);
            const userGroup = await createGroupWithReopenDays(7);
            const kase = await seedClosedCase({
                grupo_id: caseGroup.id.value,
                created_at: new Date('2000-01-01T00:00:00.000Z'),
            });

            await expect(
                makeReopener().execute(kase.id.value, reopenPayload(), { userGroupId: userGroup.id.value })
            ).rejects.toMatchObject({ message: 'CASE_REOPEN_WINDOW_EXCEEDED:7', statusCode: 422 });
        });
    });

    describe('reopen comment', () => {
        it('creates the comment and stores its id on the case', async () => {
            const kase = await seedClosedCase();
            const comment = CommentsMother.dto(kase.id.value);

            await makeReopener().execute(kase.id.value, reopenPayload(), {
                userGroupId: kase.grupo_id.value,
                comment,
            });

            const savedComment = await repository.connection('comentarios').first('*').where({ id: comment.id });
            expect(savedComment.descripcion).toBe(comment.descripcion);
            expect(savedComment.caso_id).toBe(kase.id.value);

            const updated = await repository.connection('cases').first('*').where({ id: kase.id.value });
            expect(updated.cambio_estado_comentario_id).toBe(comment.id);
            expect(updated.fecha_resolucion).toBeNull();
        });

        it('does not create a comment when the user group window is exceeded', async () => {
            const kase = await seedClosedCase({
                created_at: new Date('2000-01-01T00:00:00.000Z'),
            });
            const comment = CommentsMother.dto(kase.id.value);

            await expect(
                makeReopener().execute(kase.id.value, reopenPayload(), {
                    userGroupId: kase.grupo_id.value,
                    comment,
                })
            ).rejects.toMatchObject({ message: 'CASE_REOPEN_WINDOW_EXCEEDED:7' });

            const savedComment = await repository.connection('comentarios').first('*').where({ id: comment.id });
            expect(savedComment).toBeUndefined();
        });

        it('does not persist the comment when updating the case fails', async () => {
            const kase = await seedClosedCase();
            const comment = CommentsMother.dto(kase.id.value);
            const reopener = makeReopener();
            const originalUpdate = repository.update.bind(repository);
            repository.update = async () => {
                throw new Error('update failed');
            };

            try {
                await expect(
                    reopener.execute(kase.id.value, reopenPayload(), {
                        userGroupId: kase.grupo_id.value,
                        comment,
                    })
                ).rejects.toThrow('update failed');
            } finally {
                repository.update = originalUpdate;
            }

            const savedComment = await repository.connection('comentarios').first('*').where({ id: comment.id });
            expect(savedComment).toBeUndefined();

            const updated = await repository.connection('cases').first('*').where({ id: kase.id.value });
            expect(updated.fecha_resolucion).not.toBeNull();
        });
    });
});

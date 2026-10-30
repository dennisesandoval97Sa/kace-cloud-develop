import {
    KnexMailAccountRepository,
    MailAccount,
    MailAccountCounter,
    MailAccountCreator,
    MailAccountDeleter,
    MailAccountFinder,
    MailAccountResponse,
    MailAccountsCollectionResponse,
    MailAccountSearcher,
    MailAccountUpdater,
} from '../../src/mail-accounts/index.js';
import MailAccountMother from './domain/MailAccountMother.js';
import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import { CustomError } from '../../src/shared/errors/CustomError.js';
import { KnexGroupsRepository } from '../../src/grupos/infrastructure/persistence/KnexGroupsRepository.js';
import { KnexGlobalConfigurationRepository } from '../../src/global-config/infrastructure/persistence/KnexGlobalConfigurationRepository.js';
import { KnexWSRestWorkflowStepRepository } from '../../src/ws-rest-workflow-step/infrastructure/persistence/KnexWSRestWorkflowStepRepository.js';
import { KnexAllowedConnectionsRepository } from '../../src/allowed-conections/infrastructure/persistence/KnexAllowedConnectionsRepository.js';
import { KnexSecretsVaultRepository } from '../../src/secrets-vault/infrastructure/persistence/KnexSecretsVaultRepository.js';
import { Groups } from '../../src/grupos/index.js';
import { ensureParentRow } from '../support/ensureParentRow.js';

describe('MailAccountCreator', () => {
    const repository = new KnexMailAccountRepository(knexConfig);
    const groupsRepository = new KnexGroupsRepository(knexConfig);
    const globalConfigRepository = new KnexGlobalConfigurationRepository(knexConfig);
    const workflowStepRepository = new KnexWSRestWorkflowStepRepository(knexConfig);
    const allowedConnectionRepository = new KnexAllowedConnectionsRepository(knexConfig);
    const secretRepository = new KnexSecretsVaultRepository(knexConfig);
    const currentUser = { id: uuidv4(), name: 'Test User' };

    beforeEach(async () => {
        await repository.connection('allowed_connections').insert({
            id: uuidv4(),
            description: 'Allowed',
            connection: 'imap.example.com',
            is_active: true,
            has_ssl: false,
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        });
    });

    afterAll(async () => {
        await repository.destroyConnection();
        await groupsRepository.destroyConnection();
        await globalConfigRepository.destroyConnection();
        await workflowStepRepository.destroyConnection();
        await allowedConnectionRepository.destroyConnection();
        await secretRepository.destroyConnection();
    });

    it('should create an MailAccount', async () => {
        const dto = MailAccountMother.dto();
        const mailAccountCreator = new MailAccountCreator(
            repository,
            groupsRepository,
            globalConfigRepository,
            workflowStepRepository,
            allowedConnectionRepository,
            secretRepository,
            currentUser
        );

        await mailAccountCreator.execute(dto);

        const result = await repository.connection('mail_accounts').select('*').where('id', dto.id);

        expect(result.length).toBe(1);
    });

    it('can i get an existing mailboxAccount', async () => {
        const mailAccount = await MailAccountMother.createMailAccount(repository);
        const mailAccountFinder = new MailAccountFinder(repository);

        const mailAccountResponse = await mailAccountFinder.execute(mailAccount.id.value);

        expect(mailAccountResponse).not.toBeNull();
        expect(mailAccountResponse).toBeInstanceOf(MailAccountResponse);
    });

    it('can update an existing mailAccount', async () => {
        const mailAccount = await MailAccountMother.createMailAccount(repository);
        const mailAccountUpdater = new MailAccountUpdater(
            repository,
            groupsRepository,
            globalConfigRepository,
            workflowStepRepository,
            allowedConnectionRepository,
            secretRepository,
            currentUser
        );
        const dto = MailAccountMother.dto();
        delete dto.id;
        delete dto.created_at;
        delete dto.created_by;
        dto.vault = true;
        await mailAccountUpdater.execute(mailAccount.id.value, dto, { value: uuidv4() });

        const result = await repository.find(mailAccount.id);
        expect(result).toBeInstanceOf(MailAccount);
        expect(result.description.value).toBe(dto.description);
    });

    it('can delete an existing mailAccount', async () => {
        const mailAccount = await MailAccountMother.createMailAccount(repository);
        const mailAccountDeleter = new MailAccountDeleter(repository);

        await mailAccountDeleter.execute(mailAccount.id.value, {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        });

        const result = await repository.find(mailAccount.id);
        expect(result).toBeNull();
    });

    it('searches for MailAccount instances with given criteria with filter', async () => {
        for (let i = 0; i < 10; i++) {
            await MailAccountMother.createMailAccount(repository);
        }
        const dtoCriteria = {
            filter: [
                {
                    field: 'is_active',
                    operator: 'eq',
                    value: '1',
                    type: 'and',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const mailAccountSearch = new MailAccountSearcher(repository);

        const mailAccountResult = await mailAccountSearch.execute(dtoCriteria);
        expect(mailAccountResult).toBeInstanceOf(MailAccountsCollectionResponse);
    });

    it('searches for MailAccounts with criteria that match no records', async () => {
        const dtoCriteria = {
            filter: [
                {
                    field: 'is_active',
                    operator: 'eq',
                    value: '999',
                    type: 'and',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const mailAccountSearch = new MailAccountSearcher(repository);

        const mailAccountResult = await mailAccountSearch.execute(dtoCriteria);
        expect(mailAccountResult).toBeInstanceOf(MailAccountsCollectionResponse);
        expect(mailAccountResult.toJson().data.items.length).toBe(0);
    });

    it('should return empty when trying to find a MailAccount with a non-existent ID', async () => {
        const mailAccountFinder = new MailAccountFinder(repository);

        await expect(mailAccountFinder.execute(uuidv4())).rejects.toThrow(CustomError);
    });

    it('should count MailAccounts correctly', async () => {
        for (let i = 0; i < 10; i++) {
            await MailAccountMother.createMailAccount(repository);
        }
        const counter = new MailAccountCounter(repository);

        const count = await counter.execute({ filters: [], relationship: null });
        expect(Number(count)).toBe(10);
    });

    it('should throw an error when creating a MailAccount with missing required fields', async () => {
        const invalidDto = MailAccountMother.dto();
        delete invalidDto.id;
        const mailAccountCreator = new MailAccountCreator(
            repository,
            groupsRepository,
            globalConfigRepository,
            workflowStepRepository,
            allowedConnectionRepository,
            secretRepository,
            currentUser
        );

        await expect(mailAccountCreator.execute(invalidDto, { value: uuidv4() })).rejects.toThrow();
    });

    it('should handle updating a MailAccount with non-existent ID gracefully', async () => {
        const mailAccountUpdater = new MailAccountUpdater(
            repository,
            groupsRepository,
            globalConfigRepository,
            workflowStepRepository,
            allowedConnectionRepository,
            secretRepository,
            currentUser
        );
        const nonExistentId = uuidv4();
        const dto = MailAccountMother.dto();

        await expect(mailAccountUpdater.execute(nonExistentId, dto, { value: uuidv4() })).rejects.toThrow(CustomError);
    });

    it('should handle deleting a MailAccount with non-existent ID gracefully', async () => {
        const mailAccountDeleter = new MailAccountDeleter(repository);
        const nonExistentId = uuidv4();

        await expect(
            mailAccountDeleter.execute(nonExistentId, { deleted_at: new Date().toISOString(), deleted_by: uuidv4() })
        ).rejects.toThrow(CustomError);
    });

    it('should correctly handle updating with partially invalid data', async () => {
        const mailAccount = await MailAccountMother.createMailAccount(repository);
        const mailAccountUpdater = new MailAccountUpdater(
            repository,
            groupsRepository,
            globalConfigRepository,
            workflowStepRepository,
            allowedConnectionRepository,
            secretRepository,
            currentUser
        );
        const partialInvalidDto = { description: null };

        await expect(
            mailAccountUpdater.execute(mailAccount.id.value, partialInvalidDto, { value: uuidv4() })
        ).rejects.toThrow();
    });

    it('should throw an error when creating a Mail Account with a duplicate description', async () => {
        const dto1 = MailAccountMother.dto();
        const dto2 = MailAccountMother.dto();
        dto2.description = dto1.description;

        const mailAccountCreator = new MailAccountCreator(
            repository,
            groupsRepository,
            globalConfigRepository,
            workflowStepRepository,
            allowedConnectionRepository,
            secretRepository,
            currentUser
        );

        await mailAccountCreator.execute(dto1, { value: uuidv4() });

        await expect(mailAccountCreator.execute(dto2, { value: uuidv4() })).rejects.toThrow(
            `The following value(s) already exist: description '${dto1.description}'.`
        );
    });

    it('should throw an error when updating a Mail Account to have a duplicate description', async () => {
        const account1 = await MailAccountMother.createMailAccount(repository);
        const account2 = await MailAccountMother.createMailAccount(repository);

        const mailAccountUpdater = new MailAccountUpdater(
            repository,
            groupsRepository,
            globalConfigRepository,
            workflowStepRepository,
            allowedConnectionRepository,
            secretRepository,
            currentUser
        );

        await expect(
            mailAccountUpdater.execute(
                account2.id.value,
                { description: account1.description.value },
                { value: uuidv4() }
            )
        ).rejects.toThrow(`The following value(s) already exist: description '${account1.description.value}'.`);
    });

    it('should throw an error when creating a MailAccount with an unallowed host', async () => {
        const dto = MailAccountMother.dto();
        dto.host = 'imap.notallowed.com';

        const mailAccountCreator = new MailAccountCreator(
            repository,
            groupsRepository,
            globalConfigRepository,
            workflowStepRepository,
            allowedConnectionRepository,
            secretRepository,
            currentUser
        );

        await expect(mailAccountCreator.execute(dto, { value: uuidv4() })).rejects.toThrow(
            `Host '${dto.host}' is not allowed.`
        );
    });

    it('should throw an error when updating the host to an unallowed host', async () => {
        const mailAccount = await MailAccountMother.createMailAccount(repository);

        const invalidDto = {
            host: 'imap.notallowed.com',
        };

        const mailAccountUpdater = new MailAccountUpdater(
            repository,
            groupsRepository,
            globalConfigRepository,
            workflowStepRepository,
            allowedConnectionRepository,
            secretRepository,
            currentUser
        );

        await expect(mailAccountUpdater.execute(mailAccount.id.value, invalidDto, uuidv4())).rejects.toThrow(
            `Host '${invalidDto.host}' is not allowed.`
        );
    });

    it('should update a mail account without host in payload without crashing', async () => {
        const mailAccount = await MailAccountMother.createMailAccount(repository);

        const dtoWithoutHost = {
            description: 'Updated description without host',
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };

        const mailAccountUpdater = new MailAccountUpdater(
            repository,
            groupsRepository,
            globalConfigRepository,
            workflowStepRepository,
            allowedConnectionRepository,
            secretRepository,
            currentUser
        );

        await expect(mailAccountUpdater.execute(mailAccount.id.value, dtoWithoutHost, uuidv4())).resolves.not.toThrow();

        const result = await repository.find(mailAccount.id);
        expect(result.description.value).toBe(dtoWithoutHost.description);
    });

    it('should execute restflow when register_in_channel_hub is true and configuration exists on create', async () => {
        // Create group and config
        const groupId = uuidv4();
        const configId = uuidv4();
        const flowId = uuidv4();

        await repository.connection('global_configurations').insert({
            id: configId,
            description: 'Test Config',
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
            settings: JSON.stringify({
                layouts: { application: {} },
                behaviors: {
                    application: {
                        agente: { channel_hub: {} },
                        admin: {},
                    },
                },
                custom_fields: { application: {} },
            }),
        });

        // `grupos.horario_id` es una FK real en postgres y
        // este test inventaba el turno sin crearlo.
        const horarioId = uuidv4();
        await ensureParentRow(groupsRepository.connection, 'shift_management', horarioId);

        const group = Groups.create({
            id: groupId,
            nombre: 'Test Group',
            status: 1,
            configuration_id: configId,
            horario_id: horarioId,
            descripcion: 'Test description',
            codigo_externo: 'TEST_CODE',
            permisos: {},
            layouts: {},
            comportamientos: {},
            filter_order: 'ORDER BY created_at DESC',
            rol_id: null,
            expiredCasesCount: 0,
            intermediateCasesCount: 0,
            notExpiredCasesCount: 0,
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        });

        await groupsRepository.save(group);

        const dto = MailAccountMother.dto();
        dto.register_in_channel_hub = true;

        const mailAccountCreator = new MailAccountCreator(
            repository,
            groupsRepository,
            globalConfigRepository,
            workflowStepRepository,
            allowedConnectionRepository,
            secretRepository,
            currentUser
        );

        // This should not throw and should execute the workflow
        await expect(mailAccountCreator.execute(dto, group.id.value)).resolves.not.toThrow();
    });

    it('should update mail account when group has configuration without channel_hub flow', async () => {
        const groupId = uuidv4();
        const configId = uuidv4();

        await repository.connection('global_configurations').insert({
            id: configId,
            description: 'Test Config',
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
            settings: JSON.stringify({
                layouts: { application: {} },
                behaviors: {
                    application: {
                        agente: { channel_hub: {} },
                        admin: {},
                    },
                },
                custom_fields: { application: {} },
            }),
        });

        // `grupos.horario_id` es una FK real en postgres y
        // este test inventaba el turno sin crearlo.
        const horarioId = uuidv4();
        await ensureParentRow(groupsRepository.connection, 'shift_management', horarioId);

        const group = Groups.create({
            id: groupId,
            nombre: 'Test Group',
            status: 1,
            configuration_id: configId,
            horario_id: horarioId,
            descripcion: 'Test description',
            codigo_externo: 'TEST_CODE',
            permisos: {},
            layouts: {},
            comportamientos: {},
            filter_order: 'ORDER BY created_at DESC',
            rol_id: null,
            expiredCasesCount: 0,
            intermediateCasesCount: 0,
            notExpiredCasesCount: 0,
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        });

        await groupsRepository.save(group);

        const mailAccount = await MailAccountMother.createMailAccount(repository);

        const dtoUpdate = {
            host: mailAccount.host.value,
            description: 'Description updated',
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };

        const mailAccountUpdater = new MailAccountUpdater(
            repository,
            groupsRepository,
            globalConfigRepository,
            workflowStepRepository,
            allowedConnectionRepository,
            secretRepository,
            currentUser
        );

        await expect(mailAccountUpdater.execute(mailAccount.id.value, dtoUpdate, group.id)).resolves.not.toThrow();

        const result = await repository.find(mailAccount.id);
        expect(result.description.value).toBe(dtoUpdate.description);
    });

    it('should not execute restflow when register_in_channel_hub is false on update', async () => {
        const mailAccount = await MailAccountMother.createMailAccount(repository);
        const dto = {
            description: 'Updated without workflow',
            register_in_channel_hub: false,
            host: mailAccount.host.value,
        };

        const mailAccountUpdater = new MailAccountUpdater(
            repository,
            groupsRepository,
            globalConfigRepository,
            workflowStepRepository,
            allowedConnectionRepository,
            secretRepository,
            currentUser
        );

        await expect(mailAccountUpdater.execute(mailAccount.id.value, dto, { value: uuidv4() })).resolves.not.toThrow();
    });

    it('should not execute restflow when idGrupoActivo is not provided on update', async () => {
        const mailAccount = await MailAccountMother.createMailAccount(repository);

        const dto = {
            description: 'Updated without group',
            register_in_channel_hub: true,
            host: mailAccount.host.value,
        };

        const mailAccountUpdater = new MailAccountUpdater(
            repository,
            groupsRepository,
            globalConfigRepository,
            workflowStepRepository,
            allowedConnectionRepository,
            secretRepository,
            currentUser
        );

        // Should not throw even without group id
        await expect(mailAccountUpdater.execute(mailAccount.id.value, dto, uuidv4())).resolves.not.toThrow();
    });

    it('should store login_endpoint as URL value, not as field name', async () => {
        const loginEndpointUrl = 'https://accounts.google.com/o/oauth2/auth';
        const dto = MailAccountMother.dto({ login_endpoint: loginEndpointUrl });
        const mailAccountCreator = new MailAccountCreator(
            repository,
            groupsRepository,
            globalConfigRepository,
            workflowStepRepository,
            allowedConnectionRepository,
            secretRepository,
            currentUser
        );

        await mailAccountCreator.execute(dto);

        const rows = await repository.connection('mail_accounts').select('login_endpoint').where('id', dto.id);
        expect(rows[0].login_endpoint).toBe(loginEndpointUrl);
    });

    it('should clear code and refresh_token when updated to null', async () => {
        const mailAccount = await MailAccountMother.createMailAccount(repository);
        const mailAccountUpdater = new MailAccountUpdater(
            repository,
            groupsRepository,
            globalConfigRepository,
            workflowStepRepository,
            allowedConnectionRepository,
            secretRepository,
            currentUser
        );

        await mailAccountUpdater.execute(
            mailAccount.id.value,
            { code: null, refresh_token: null },
            { value: uuidv4() }
        );

        const rows = await repository
            .connection('mail_accounts')
            .select('code', 'refresh_token')
            .where('id', mailAccount.id.value);
        expect(rows[0].code).toBeNull();
        expect(rows[0].refresh_token).toBeNull();
    });

    it('should clear login_endpoint when updated to null', async () => {
        const mailAccount = await MailAccountMother.createMailAccount(repository);
        const mailAccountUpdater = new MailAccountUpdater(
            repository,
            groupsRepository,
            globalConfigRepository,
            workflowStepRepository,
            allowedConnectionRepository,
            secretRepository,
            currentUser
        );

        await mailAccountUpdater.execute(mailAccount.id.value, { login_endpoint: null }, { value: uuidv4() });

        const rows = await repository
            .connection('mail_accounts')
            .select('login_endpoint')
            .where('id', mailAccount.id.value);
        expect(rows[0].login_endpoint).toBeNull();
    });

    it('should persist register_in_channel_hub: false without being cleared', async () => {
        const dto = MailAccountMother.dto({ register_in_channel_hub: false });
        const mailAccountCreator = new MailAccountCreator(
            repository,
            groupsRepository,
            globalConfigRepository,
            workflowStepRepository,
            allowedConnectionRepository,
            secretRepository,
            currentUser
        );

        await mailAccountCreator.execute(dto);

        const rows = await repository.connection('mail_accounts').select('register_in_channel_hub').where('id', dto.id);
        expect(rows[0].register_in_channel_hub).toBeFalsy();
    });
});

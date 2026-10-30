import { knexConfig } from '../knexfile';
import { KnexS3ImportFiles } from '../../src/imports/infrastructure/persistence/KnexS3ImportFiles';
import { S3ImportFile } from '../../src/imports/domain/S3ImportFile.js';
import UsersMother from '../users/domain/UsersMother.js';
import MailAccountMother from '../mail-accounts/domain/MailAccountMother.js';

const validDto = {
    id: 'a57ed068-e85a-42ac-b4bd-a6dd46283073',
    file_path: 'folder/test.csv',
    status: 'pending',
    upload_attempts: 0,
    total_records: 10,
    processed_records: 0,
    last_updated_at: new Date(),
    created_at: new Date(),
    created_by: 'a57ed068-e85a-42ac-b4bd-a6dd46283073',
    error_details: null,
    target_table: 'usuarios',
};

describe('KnexS3ImportFiles - Integration Test', () => {
    const repository = new KnexS3ImportFiles(knexConfig);

    it('should save a new S3ImportFile into DB', async () => {
        const aggregate = S3ImportFile.create(validDto);
        await repository.save(aggregate);

        const rows = await repository.connection('s3_import_files').where({ id: validDto.id });
        expect(rows.length).toBe(1);
        expect(rows[0].file_path).toBe(validDto.file_path);
    });

    it('should find a pending file to process (ordered by created_at)', async () => {
        const dto1 = { ...validDto, created_at: new Date('2023-01-01T10:00:00Z') };
        const dto2 = {
            ...validDto,
            id: 'faa45ca0-f5d0-4436-8f72-10f166e80881',
            created_at: new Date('2023-01-01T11:00:00Z'),
        };

        await repository.save(S3ImportFile.create(dto2));
        await repository.save(S3ImportFile.create(dto1));

        const result = await repository.findFileToProcess();

        expect(result).toBeInstanceOf(S3ImportFile);
        expect(result.id.value).toBe('a57ed068-e85a-42ac-b4bd-a6dd46283073');
    });

    it('should update an existing S3ImportFile in DB', async () => {
        const aggregate = S3ImportFile.create(validDto);
        await repository.save(aggregate);

        const updateData = {
            status: 'completed',
            processed_records: 10,
        };

        const updated = await repository.updateImport(validDto.id, updateData);
        expect(updated).toBeInstanceOf(S3ImportFile);
        expect(updated.status.value).toBe('completed');
        expect(updated.processed_records.value).toBe(10);
    });

    it('should save record into dynamic table', async () => {
        const dto = UsersMother.dto();
        await repository.saveRecord('usuarios', { ...dto });

        const rows = await repository.connection('usuarios').where({ id: dto.id });
        expect(rows.length).toBe(1);
        expect(rows[0].nombres).toBe(dto.nombres);
    });

    it('should return imports for a given user', async () => {
        await repository.save(S3ImportFile.create(validDto));

        const result = await repository.findImportsByUser(validDto.created_by);
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(1);
        expect(result[0]).toBeInstanceOf(S3ImportFile);
    });

    it('should find user to notify', async () => {
        const dto = UsersMother.dto();

        await repository
            .connection('usuarios')
            .insert({ ...dto, id: validDto.created_by, created_at: new Date().toISOString() });

        const result = await repository.findUserToNotify(validDto.created_by);

        expect(result.email.value).toBe(dto.email);
    });

    it('should return mail account from notification config', async () => {
        const dto = MailAccountMother.dto();
        delete dto.settings;
        delete dto.folders;
        delete dto.vault_data;

        const mailAccountId = '3bd4134f-1035-488f-a63b-daa7e63cd796';
        const configId = '85c15d62-dafe-41e3-ab4b-b68617c3c13c';
        const grupoId = 'f66832d7-c2ff-418f-ba4d-a58432e5204c';

        await repository.connection('mail_accounts').insert({ ...dto, id: mailAccountId });

        await repository.connection('global_configurations').insert({
            id: configId,
            settings: JSON.stringify({
                behaviors: {
                    application: {
                        agente: {
                            casos: {
                                account_to_send_notifications: mailAccountId,
                            },
                        },
                    },
                },
            }),
        });

        await repository.connection('grupos').insert({
            id: grupoId,
            configuration_id: configId,
        });

        await repository.connection('usuarios').insert({
            id: validDto.created_by,
            grupo_activo: grupoId,
        });

        const result = await repository.getNotificationsConfig(validDto.created_by);
        expect(result).not.toBeNull();
        expect(result.id.value).toBe(mailAccountId);
    });

    it('resolves the mail account without looking up boveda_secretos when username/password are absent', async () => {
        const dto = MailAccountMother.dto();
        delete dto.settings;
        delete dto.folders;
        delete dto.vault_data;
        dto.username = null;
        dto.password = null;

        const mailAccountId = '3bd4134f-1035-488f-a63b-daa7e63cd797';
        const configId = '85c15d62-dafe-41e3-ab4b-b68617c3c13d';
        const grupoId = 'f66832d7-c2ff-418f-ba4d-a58432e5204d';
        const userId = 'a57ed068-e85a-42ac-b4bd-a6dd46283074';

        await repository.connection('mail_accounts').insert({ ...dto, id: mailAccountId });
        await repository.connection('global_configurations').insert({
            id: configId,
            settings: JSON.stringify({
                behaviors: { application: { agente: { casos: { account_to_send_notifications: mailAccountId } } } },
            }),
        });
        await repository.connection('grupos').insert({ id: grupoId, configuration_id: configId });
        await repository.connection('usuarios').insert({ id: userId, grupo_activo: grupoId });

        const result = await repository.getNotificationsConfig(userId);

        expect(result).not.toBeNull();
        expect(result.id.value).toBe(mailAccountId);
        expect(result.username.value).toBeNull();
        expect(result.password.value).toBeNull();
    });

    it('returns null when there is no notification config for the user (no grupo/config match)', async () => {
        const lonelyUserId = 'a57ed068-e85a-42ac-b4bd-a6dd46283075';
        await repository.connection('usuarios').insert({ id: lonelyUserId, grupo_activo: null });

        const result = await repository.getNotificationsConfig(lonelyUserId);

        expect(result).toBeNull();
    });

    // NOT COVERED (documented, not invented around): `global_configurations.settings` is a
    // `jsonb` column (see 20240814153659_table_global_configurations.js) and node-postgres
    // auto-parses jsonb into a JS object before KnexS3ImportFiles ever sees the row, so
    // `config.settings` is never a string in practice. Postgres itself also rejects malformed
    // JSON at INSERT time for a jsonb column, so there is no way to get invalid JSON stored
    // there either. The `typeof config.settings === 'string'` branch (and its JSON.parse
    // try/catch) in getNotificationsConfig() is dead code reachable only if that column were
    // ever read back as text (e.g. via a raw `::text` cast), which this repository doesn't do.

    it('returns null when account_to_send_notifications is missing from the parsed settings', async () => {
        const configId = '85c15d62-dafe-41e3-ab4b-b68617c3c13f';
        const grupoId = 'f66832d7-c2ff-418f-ba4d-a58432e5204f';
        const userId = 'a57ed068-e85a-42ac-b4bd-a6dd46283077';

        await repository.connection('global_configurations').insert({
            id: configId,
            settings: JSON.stringify({ behaviors: { application: {} } }),
        });
        await repository.connection('grupos').insert({ id: grupoId, configuration_id: configId });
        await repository.connection('usuarios').insert({ id: userId, grupo_activo: grupoId });

        const result = await repository.getNotificationsConfig(userId);

        expect(result).toBeNull();
    });

    it('returns null when the referenced mail_accounts row does not exist', async () => {
        const configId = '85c15d62-dafe-41e3-ab4b-b68617c3c130';
        const grupoId = 'f66832d7-c2ff-418f-ba4d-a58432e52050';
        const userId = 'a57ed068-e85a-42ac-b4bd-a6dd46283078';
        const missingMailAccountId = '00000000-0000-4000-8000-000000000099';

        await repository.connection('global_configurations').insert({
            id: configId,
            settings: JSON.stringify({
                behaviors: {
                    application: { agente: { casos: { account_to_send_notifications: missingMailAccountId } } },
                },
            }),
        });
        await repository.connection('grupos').insert({ id: grupoId, configuration_id: configId });
        await repository.connection('usuarios').insert({ id: userId, grupo_activo: grupoId });

        const result = await repository.getNotificationsConfig(userId);

        expect(result).toBeNull();
    });

    it('findActiveGroupsByIds returns [] without querying when given no ids', async () => {
        const emptyResult = await repository.findActiveGroupsByIds([]);
        const nullResult = await repository.findActiveGroupsByIds(null);

        expect(emptyResult).toEqual([]);
        expect(nullResult).toEqual([]);
    });

    it('updateImport throws when id or updateData is missing', async () => {
        await expect(repository.updateImport(null, { status: 'completed' })).rejects.toThrow();
        await expect(repository.updateImport(validDto.id, null)).rejects.toThrow();
    });

    it('updateImport returns null when no row matches the given id', async () => {
        const result = await repository.updateImport('00000000-0000-4000-8000-000000000098', {
            status: 'completed',
        });

        expect(result).toBeNull();
    });

    it('findUserToNotify returns null when the user does not exist', async () => {
        const result = await repository.findUserToNotify('00000000-0000-4000-8000-000000000097');

        expect(result).toBeNull();
    });
});

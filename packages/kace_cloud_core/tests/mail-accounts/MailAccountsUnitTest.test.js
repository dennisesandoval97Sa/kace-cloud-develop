import {
    KnexMailAccountRepository,
    MailAccount,
    MailAccountResponse,
    MailAccountTypesResponse,
    ValueObjectTypes,
} from '../../src/mail-accounts';
import { v4 as uuidv4 } from 'uuid';
import { MailAccountsTypes, ValueObjectStatus, ValueObjectUuid } from '../../src/shared';
import MailAccountMother from './domain/MailAccountMother.js';
import { MailAccountsCollectionResponse } from '../../src/mail-accounts/index.js';
import { DeleteFieldsDoNotExistError, UuidError } from '../../src/shared/index.js';
import { ValueObjectScope } from '../../src/mail-accounts/domain/value-object/ValueObjectScope.js';
import { ValueObjectLoginEndpoint } from '../../src/mail-accounts/domain/value-object/ValueObjectLoginEndpoint.js';
import { ValueObjectFolders } from '../../src/mail-accounts/domain/value-object/ValueObjectFolders.js';
import { jest } from '@jest/globals';

describe('MailAccount Entity', () => {
    const dto = MailAccountMother.dto();

    it('should create a mailAccount with valid data', () => {
        const mailAccount = MailAccount.create(dto);
        expect(mailAccount.id).toBeInstanceOf(ValueObjectUuid);
        expect(mailAccount.is_active).toBeInstanceOf(ValueObjectStatus);
    });

    it('should update mailAccount data', () => {
        const mailAccount = MailAccount.create(dto);
        const newData = {
            description: 'Updated description',
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        mailAccount.update(newData);

        expect(mailAccount.description.value).toBe('Updated description');
        expect(mailAccount.changedAttributes).toEqual(newData);
    });

    it('should throw an error with invalid UUID', () => {
        const invalidData = dto;
        invalidData.id = 'invalid-uuid';

        expect(() => MailAccount.create(invalidData)).toThrow(UuidError);
    });
});

describe('KnexMailAccountRepository', () => {
    it('qualifies findAllByEmailAccounts with the configured tenant schema', async () => {
        const rows = [MailAccountMother.dto({ email_account: 'Support@Example.com' })];
        const rawExpression = { sql: 'lower(email_account)' };
        const queryBuilder = {
            whereNull: jest.fn(function () {
                return this;
            }),
            whereIn: jest.fn(function () {
                return this;
            }),
            then: (resolve, reject) => Promise.resolve(rows).then(resolve, reject),
        };
        const connection = jest.fn(() => queryBuilder);
        connection.raw = jest.fn(() => rawExpression);
        connection.client = {
            config: {
                client: 'pg',
                schema: 'tenant_mail_accounts',
            },
            on: jest.fn(),
        };
        const repository = new KnexMailAccountRepository(connection);

        const result = await repository.findAllByEmailAccounts(['Support@Example.com', 'support@example.com', null]);

        expect(connection).toHaveBeenCalledWith('tenant_mail_accounts.mail_accounts');
        expect(connection).not.toHaveBeenCalledWith('mail_accounts');
        expect(queryBuilder.whereNull).toHaveBeenCalledWith('deleted_at');
        expect(connection.raw).toHaveBeenCalledWith('lower(email_account)');
        expect(queryBuilder.whereIn).toHaveBeenCalledWith(rawExpression, ['support@example.com']);
        expect(result).toHaveLength(1);
        expect(result[0]).toBeInstanceOf(MailAccount);
        expect(result[0].email_account.value).toBe('Support@Example.com');
    });
});

describe('MailAccounts Tests', () => {
    it('creates a new MailAccount instance from DTO', () => {
        const dto = MailAccountMother.dto();
        dto.updated_at = null;
        dto.updated_by = null;
        dto.deleted_at = null;
        dto.deleted_by = null;
        const mailAccount = MailAccount.create(dto);

        expect(mailAccount.id.value).toBe(dto.id);
        expect(mailAccount.description.value).toBe(dto.description);
        expect(mailAccount.is_active.value).toBe(dto.is_active);
        expect(mailAccount.created_at.value).toBe(dto.created_at);
        expect(mailAccount.updated_at.value).toBe(dto.updated_at);
        expect(mailAccount.created_by.value).toBe(dto.created_by);
        expect(mailAccount.updated_by.value).toBe(dto.updated_by);
        expect(mailAccount.deleted_at.value).toBe(dto.deleted_at);
        expect(mailAccount.deleted_by.value).toBe(dto.deleted_by);
    });

    it('updates an MailAccounts instance with new values', () => {
        const dto = MailAccountMother.dto();
        const mailAccount = MailAccount.create(dto);
        const updateDto = {
            description: 'Updated Name',
            email_account: 'updated@email.com',
            is_active: 2,
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        mailAccount.update(updateDto);

        expect(mailAccount.description.value).toBe(updateDto.description);
        expect(mailAccount.email_account.value).toBe(updateDto.email_account);
        expect(mailAccount.is_active.value).toBe(updateDto.is_active);
        expect(mailAccount.updated_at.value).toBe(updateDto.updated_at);
        expect(mailAccount.updated_by.value).toBe(updateDto.updated_by);
    });

    it('does not update properties when values are the same', () => {
        const dto = MailAccountMother.dto();
        const mailAccount = MailAccount.create(dto);

        mailAccount.update(dto);

        expect(mailAccount.changedAttributes).toEqual({});
    });

    it('marks an MailAccounts instance as deleted', () => {
        const dto = MailAccountMother.dto();
        const mailAccount = MailAccount.create(dto);
        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };
        mailAccount.delete(deleteDto);

        expect(mailAccount.deleted_at.value).toBe(deleteDto.deleted_at);
        expect(mailAccount.deleted_by.value).toBe(deleteDto.deleted_by);
    });

    it('should throw a error if deleted fields are empty', () => {
        const dto = MailAccountMother.dto();
        const mailAccount = MailAccount.create(dto);
        const deleteDto = {};

        expect(() => mailAccount.delete(deleteDto)).toThrow(DeleteFieldsDoNotExistError);
    });

    it('flushes changes in MailAccounts instance', () => {
        const dto = MailAccountMother.dto();
        const mailAccount = MailAccount.create(dto);
        const updateDto = {
            description: 'Updated Name',
            is_active: 2,
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        mailAccount.update(updateDto);
        mailAccount.flushChanges();

        expect(mailAccount.changedAttributes).toEqual({});
    });
});

describe('ValueObjectTypes Tests', () => {
    it('should create an instance with a valid value', () => {
        const value = MailAccountsTypes.MS_GRAPH_APPLICATION.value;
        const valueObject = new ValueObjectTypes('types', value);
        expect(valueObject).toBeInstanceOf(ValueObjectTypes);
    });

    it('should throw an error if the value is null', () => {
        const value = null;
        expect(() => new ValueObjectTypes('types', value)).toThrow('Invalid value');
    });

    it('should throw an error if the value is undefined', () => {
        const value = undefined;
        expect(() => new ValueObjectTypes('types', value)).toThrow('Invalid value');
    });

    it('should handle empty string as incorrect value', () => {
        const value = '';
        expect(() => new ValueObjectTypes('types', value)).toThrow('Invalid value');
    });
});

describe('MailAccounts Responses Tests', () => {
    it('converts MailAccounts object to JSON representation', () => {
        const mailAccount = new MailAccount(MailAccountMother.dto());
        const mailboxAccountResponse = new MailAccountResponse(mailAccount);

        const json = mailboxAccountResponse.toJson();
        expect(json).toEqual({
            data: {
                id: mailAccount.id.value,
                description: mailAccount.description.value,
                type: mailAccount.type.value,
                host: mailAccount.host.value,
                port: mailAccount.port.value,
                protocol: mailAccount.protocol.value,
                encryption: mailAccount.encryption.value,
                username: mailAccount.username.value,
                password: mailAccount.password.value,
                from_address: mailAccount.from_address.value,
                from_name: mailAccount.from_name.value,
                tenant_id: mailAccount.tenant_id.value,
                client_id: mailAccount.client_id.value,
                client_secret: mailAccount.client_secret.value,
                code: mailAccount.code.value,
                refresh_token: mailAccount.refresh_token.value,
                register_in_channel_hub: mailAccount.register_in_channel_hub
                    ? mailAccount.register_in_channel_hub.value
                    : false,
                mails_download_limit: mailAccount.mails_download_limit.value,
                login_endpoint: mailAccount.login_endpoint.value,
                graph_scope: mailAccount.graph_scope.value,
                start_syncing_from: mailAccount.start_syncing_from.value,
                last_synchronization: mailAccount.last_synchronization.value,
                folders: mailAccount.folders.value,
                access_token: mailAccount.access_token.value,
                email_account: mailAccount.email_account.value,
                vault: mailAccount.vault.value,
                vault_data: mailAccount.vault_data.value,
                is_active: mailAccount.is_active.value,
                created_at: mailAccount.created_at.value,
                created_by: mailAccount.created_by.value,
                updated_at: mailAccount.updated_at.value,
                updated_by: mailAccount.updated_by.value,
            },
        });
    });

    it('returns an empty object if mail account is not provided', () => {
        const mailAccountResponse = new MailAccountResponse(null);
        const json = mailAccountResponse.toJson();

        expect(json).toEqual({});
    });

    it('converts MailAccountsCollection to JSON representation', () => {
        const mailAccountsCollection = [
            new MailAccount(MailAccountMother.dto()),
            new MailAccount(MailAccountMother.dto()),
        ];
        const mailAccountCollectionResponse = new MailAccountsCollectionResponse(
            mailAccountsCollection,
            mailAccountsCollection.length
        );

        const json = mailAccountCollectionResponse.toJson();

        expect(json).toEqual({
            data: {
                items: mailAccountsCollection.map((mailAccount) => new MailAccountResponse(mailAccount).toJson().data),
            },
            metadata: {
                count: mailAccountsCollection.length,
            },
        });
    });
});

describe('ValueObjectScope Tests', () => {
    it('should create an instance with a valid value', () => {
        const validValue = 'user.read';
        const valueObject = new ValueObjectScope(validValue);
        expect(valueObject).toBeInstanceOf(ValueObjectScope);
    });

    it('should throw an error if the value is null, undefined, or empty', () => {
        const invalidValues = [null, undefined, ''];

        invalidValues.forEach((value) => {
            expect(() => new ValueObjectScope(value)).toThrow('scope: The value cannot be null');
        });
    });

    it('should throw an error if the value exceeds the maximum length', () => {
        const invalidValue = 'a'.repeat(256);
        expect(() => new ValueObjectScope(invalidValue)).toThrow(
            'scope: The value must be at most 255 characters long'
        );
    });

    it('should not throw an error if the value is a valid scope string with max length', () => {
        const validValue = 'a'.repeat(255);
        expect(() => new ValueObjectScope(validValue)).not.toThrow();
    });

    it('should not throw an error if is nullable and value is undefined', () => {
        expect(() => new ValueObjectScope(undefined, true)).not.toThrow();
    });
});

describe('ValueObjectLoginEndpoint Tests', () => {
    it('should create an instance with a valid value', () => {
        const validValue = 'https://login.example.com';
        const valueObject = new ValueObjectLoginEndpoint(validValue);
        expect(valueObject).toBeInstanceOf(ValueObjectLoginEndpoint);
    });

    it('should throw an error if the value is null, undefined, or empty', () => {
        const invalidValues = [null, undefined, ''];

        invalidValues.forEach((value) => {
            expect(() => new ValueObjectLoginEndpoint(value)).toThrow('The value cannot be null');
        });
    });

    it('should not throw an error if the value is a valid URL', () => {
        const validValue = 'https://login.example.com';
        expect(() => new ValueObjectLoginEndpoint(validValue)).not.toThrow();
    });
});

describe('ValueObjectFolders Tests', () => {
    it('should create an instance with a valid array of strings', () => {
        const validValue = ['inbox', 'sent', 'drafts'];
        const valueObject = new ValueObjectFolders(validValue);
        expect(valueObject).toBeInstanceOf(ValueObjectFolders);
    });

    it('should throw an error if the value is null, undefined, or empty', () => {
        const invalidValues = [null, undefined, ''];

        invalidValues.forEach((value) => {
            expect(() => new ValueObjectFolders(value)).toThrow('folders: The value cannot be null');
        });
    });

    it('should throw an error if any item in the array is not a string', () => {
        const invalidValue = ['inbox', 123, 'drafts'];
        expect(() => new ValueObjectFolders(invalidValue)).toThrow(
            'folders: All folders must be strings with a maximum length of 255 characters'
        );
    });

    it('should throw an error if any string in the array exceeds the maximum length', () => {
        const invalidValue = ['inbox', 'a'.repeat(256), 'drafts'];
        expect(() => new ValueObjectFolders(invalidValue)).toThrow(
            'folders: All folders must be strings with a maximum length of 255 characters'
        );
    });

    it('should not throw an error if all items in the array are valid strings with max length', () => {
        const validValue = ['inbox', 'sent', 'drafts'];
        expect(() => new ValueObjectFolders(validValue)).not.toThrow();
    });
});

describe('MailAccountTypesResponse', () => {
    test('should convert to JSON correctly', () => {
        const response = new MailAccountTypesResponse();

        const json = response.toJson();
        expect(json).toEqual({
            data: {
                GMAIL_APPLICATION: 'gmail_application',
                GMAIL_USER: 'gmail_user',
                MS_GRAPH_APPLICATION: 'ms_graph_application',
                MS_GRAPH_USER: 'ms_graph_user',
                SMTP: 'smtp',
            },
        });
    });
});

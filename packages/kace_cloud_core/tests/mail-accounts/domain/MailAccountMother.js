import Chance from 'chance';
import { v4 as uuidv4 } from 'uuid';
import { MailAccount } from '../../../src/mail-accounts/index.js';
import TestHelper from '../../TestHelper.js';
import { MailAccountsTypes } from '../../../src/shared/index.js';

export default class MailAccountMother {
    /**
     * Generates a Data Transfer Object (DTO) for the `MailAccount` entity.
     *
     * @returns {Object} The DTO containing the properties for an `MailAccount` entity.
     */
    static dto(overrides = {}) {
        return {
            id: uuidv4(),
            description: 'Personal email account',
            type: MailAccountsTypes.MS_GRAPH_APPLICATION.value,
            host: 'imap.example.com',
            port: null,
            protocol: null,
            encryption: null,
            username: 'USERNAME_REFERENCE',
            password: 'PASSWORD_REFERENCE',
            from_address: 'user@example.com',
            from_name: 'John Doe',
            tenant_id: 'TENANT_ID_REFERENCE',
            client_id: 'CLIENT_ID_REFERENCE',
            client_secret: 'CLIENT_SECRET_REFERENCE',
            code: 'authCode123',
            refresh_token: 'refreshToken456',
            mails_download_limit: 1000,
            login_endpoint: 'https://example.com/oauth/token',
            graph_scope: 'mail.read',
            start_syncing_from: new Date().toISOString(),
            last_synchronization: new Date().toISOString(),
            folders: ['Inbox', 'Sent', 'Drafts', 'Trash'],
            access_token: 'accessToken789',
            email_account: 'user@example.com',
            vault: false,
            vault_data: { test: 'test' },
            is_active: 1,
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
            ...overrides,
        };
    }

    static getRandomReference() {
        const chance = new Chance();
        return chance.word({ length: 10 }).toUpperCase().replace(/ /g, '_');
    }

    /**
     * Creates an `MailAccount` instance and saves it to the repository.
     *
     * @param {KnexMailAccountRepository} repository - The repository to save the `MailAccount` instance.
     * @returns {MailAccount} The created `MailAccount` instance.
     */
    static async createMailAccount(repository, overrides = {}) {
        const mailAccount = MailAccount.create(MailAccountMother.dto(overrides));
        await repository.save(mailAccount);
        return mailAccount;
    }

    /**
     * Generates a random Data Transfer Object (DTO) for the `MailAccount` entity.
     *
     * @returns {Object} The DTO containing random properties for an `MailAccount` entity.
     */
    static randomDto() {
        const chance = new Chance();
        return {
            id: uuidv4(),
            description: chance.sentence({ min: 1, max: 119 }),
            type: chance.pickone(['ms_graph_application']),
            host: chance.domain(),
            port: chance.integer({ min: 1, max: 65535 }),
            protocol: chance.pickone(['smtp']),
            encryption: 'tls',
            username: this.getRandomReference(),
            password: this.getRandomReference(),
            from_address: chance.email(),
            from_name: chance.name(),
            tenant_id: this.getRandomReference(),
            client_id: this.getRandomReference(),
            client_secret: this.getRandomReference(),
            code: chance.string({ length: 8 }),
            refresh_token: chance.string({ length: 20 }),
            mails_download_limit: chance.integer({ min: 100, max: 5000 }),
            login_endpoint: chance.url(),
            graph_scope: chance.word(),
            start_syncing_from: chance.date({ year: 2024 }).toISOString(),
            last_synchronization: chance.date().toISOString(),
            folders: ['Inbox', 'Sent', 'Drafts', 'Trash'],
            access_token: TestHelper.generateSafeValue(() => chance.string({ length: 40 })),
            email_account: chance.email(),
            vault: false,
            vault_data: { test: 'test' },
            is_active: chance.pickone([1, 2]),
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        };
    }

    /**
     * Creates an `MailAccount` instance with random properties and saves it to the repository.
     *
     * @param {KnexMailAccountRepository} repository - The repository to save the `MailAccount` instance.
     * @returns {MailAccount} The created `MailAccount` instance.
     */
    static async createRandomMailAccount(repository) {
        const mailboxAccount = MailAccount.create(MailAccountMother.randomDto());
        await repository.save(mailboxAccount);
        return mailboxAccount;
    }
}

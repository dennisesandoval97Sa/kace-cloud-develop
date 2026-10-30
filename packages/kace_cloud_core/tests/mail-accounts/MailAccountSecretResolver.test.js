import { MailAccountSecretResolver } from '../../src/mail-accounts/domain/MailAccountSecretResolver.js';
import { KnexMailAccountRepository } from '../../src/mail-accounts/infrastructure/persistence/KnexMailAccountRepository.js';
import { KnexSecretsVaultRepository } from '../../src/secrets-vault/infrastructure/persistence/KnexSecretsVaultRepository.js';
import MailAccountMother from './domain/MailAccountMother.js';
import { SecretsVaultMother } from '../secrets-vault/domain/SecretsVaultMother.js';
import { knexConfig } from '../knexfile.js';
import { MailAccount } from '../../src/mail-accounts/domain/MailAccount.js';
import LocalTenantRepository from '../../src/tenant/infrastructure/local/LocalTenantRepository.js';
import { TenantContext, ValueObjectUuid } from '../../src/shared/index.js';

describe('MailAccountSecretResolver Integration Tests', () => {
    const mailAccountRepository = new KnexMailAccountRepository(knexConfig);
    const secretsRepository = new KnexSecretsVaultRepository(knexConfig);
    const secretResolver = new MailAccountSecretResolver(secretsRepository);
    let tenant;

    beforeAll(async () => {
        const tenantRepository = new LocalTenantRepository();
        tenant = await tenantRepository.find(ValueObjectUuid.random());
    });

    afterAll(async () => {
        await mailAccountRepository.destroyConnection();
    });

    it('should resolve secrets in MailAccount properties', async () => {
        await TenantContext.run(tenant, async () => {
            await SecretsVaultMother.createEncryptedSecret(secretsRepository, {
                referencia: 'USERNAME_TEST',
                secreto: 'resolved_username',
            });

            await SecretsVaultMother.createEncryptedSecret(secretsRepository, {
                referencia: 'PASSWORD_TEST',
                secreto: 'resolved_password',
            });

            const mailAccountDto = MailAccountMother.dto();
            mailAccountDto.username = 'SECRET_USERNAME_TEST';
            mailAccountDto.password = 'SECRET_PASSWORD_TEST';

            const mailAccount = await MailAccountMother.createMailAccount(mailAccountRepository, mailAccountDto);

            const resolvedMailAccount = await secretResolver.resolve(mailAccount);

            expect(resolvedMailAccount).toBeInstanceOf(MailAccount);
            expect(resolvedMailAccount.username.value).toBe('resolved_username');
            expect(resolvedMailAccount.username.isResolved).toBe(true);
            expect(resolvedMailAccount.password.value).toBe('resolved_password');
            expect(resolvedMailAccount.password.isResolved).toBe(true);
        });
    });

    it('should resolve partial secrets in MailAccount', async () => {
        await TenantContext.run(tenant, async () => {
            await SecretsVaultMother.createEncryptedSecret(secretsRepository, {
                referencia: 'USERNAME_PARTIAL',
                secreto: 'resolved_username_partial',
            });

            const mailAccountDto = MailAccountMother.dto();
            mailAccountDto.username = 'SECRET_USERNAME_PARTIAL';
            mailAccountDto.password = 'plain_password';

            const mailAccount = await MailAccountMother.createMailAccount(mailAccountRepository, mailAccountDto);

            const resolvedMailAccount = await secretResolver.resolve(mailAccount);

            expect(resolvedMailAccount.username.value).toBe('resolved_username_partial');
            expect(resolvedMailAccount.username.isResolved).toBe(true);
            expect(resolvedMailAccount.password.value).toBe('plain_password');
            expect(resolvedMailAccount.password.isResolved).toBe(false);
        });
    });

    it('should handle missing secrets gracefully', async () => {
        await TenantContext.run(tenant, async () => {
            const mailAccountDto = MailAccountMother.dto();
            mailAccountDto.username = 'SECRET_NON_EXISTENT';
            mailAccountDto.password = 'SECRET_ALSO_NON_EXISTENT';

            const mailAccount = await MailAccountMother.createMailAccount(mailAccountRepository, mailAccountDto);

            const resolvedMailAccount = await secretResolver.resolve(mailAccount);

            expect(resolvedMailAccount).toBeInstanceOf(MailAccount);
            expect(resolvedMailAccount.username.value).toBe('SECRET_NON_EXISTENT');
            expect(resolvedMailAccount.password.value).toBe('SECRET_ALSO_NON_EXISTENT');
        });
    });

    it('should correctly identify MailAccounts with secrets', async () => {
        await TenantContext.run(tenant, async () => {
            const mailAccountDto = MailAccountMother.dto();
            mailAccountDto.username = 'SECRET_USERNAME_CHECK';
            mailAccountDto.password = 'SECRET_PASSWORD_CHECK';

            const mailAccount = await MailAccountMother.createMailAccount(mailAccountRepository, mailAccountDto);

            const hasSecrets = secretResolver.hasSecrets(mailAccount);

            expect(hasSecrets).toBe(true);
        });
    });

    it('should correctly identify MailAccounts without secrets', async () => {
        await TenantContext.run(tenant, async () => {
            const mailAccountDto = MailAccountMother.dto();
            mailAccountDto.username = 'plain_username';
            mailAccountDto.password = 'plain_password';

            const mailAccount = await MailAccountMother.createMailAccount(mailAccountRepository, mailAccountDto);

            const hasSecrets = secretResolver.hasSecrets(mailAccount);

            expect(hasSecrets).toBe(false);
        });
    });

    it('should resolve all secret properties in MailAccount', async () => {
        await TenantContext.run(tenant, async () => {
            const secrets = [
                { ref: 'USERNAME_ALL', value: 'resolved_username' },
                { ref: 'PASSWORD_ALL', value: 'resolved_password' },
                { ref: 'CLIENT_ID_ALL', value: 'resolved_client_id' },
                { ref: 'CLIENT_SECRET_ALL', value: 'resolved_client_secret' },
                { ref: 'TENANT_ID_ALL', value: 'resolved_tenant_id' },
            ];

            for (const secret of secrets) {
                await SecretsVaultMother.createEncryptedSecret(secretsRepository, {
                    referencia: secret.ref,
                    secreto: secret.value,
                });
            }

            const mailAccountDto = MailAccountMother.dto();
            mailAccountDto.username = 'SECRET_USERNAME_ALL';
            mailAccountDto.password = 'SECRET_PASSWORD_ALL';
            mailAccountDto.client_id = 'SECRET_CLIENT_ID_ALL';
            mailAccountDto.client_secret = 'SECRET_CLIENT_SECRET_ALL';
            mailAccountDto.tenant_id = 'SECRET_TENANT_ID_ALL';

            const mailAccount = await MailAccountMother.createMailAccount(mailAccountRepository, mailAccountDto);

            const resolvedMailAccount = await secretResolver.resolve(mailAccount);

            expect(resolvedMailAccount.username.value).toBe('resolved_username');
            expect(resolvedMailAccount.password.value).toBe('resolved_password');
            expect(resolvedMailAccount.client_id.value).toBe('resolved_client_id');
            expect(resolvedMailAccount.client_secret.value).toBe('resolved_client_secret');
            expect(resolvedMailAccount.tenant_id.value).toBe('resolved_tenant_id');

            expect(resolvedMailAccount.username.isResolved).toBe(true);
            expect(resolvedMailAccount.password.isResolved).toBe(true);
            expect(resolvedMailAccount.client_id.isResolved).toBe(true);
            expect(resolvedMailAccount.client_secret.isResolved).toBe(true);
            expect(resolvedMailAccount.tenant_id.isResolved).toBe(true);
        });
    });
});

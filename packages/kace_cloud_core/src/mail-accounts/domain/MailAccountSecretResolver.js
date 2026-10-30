import { SecretReplacer } from '../../secrets-vault';
import { Helper } from '../../shared';
import { ValueObjectVaultReference } from '../../shared/domain/value-object/ValueObjectVaultReference';

export class MailAccountSecretResolver {
    constructor(secretsRepository) {
        this.secretReplacer = new SecretReplacer(secretsRepository);
    }

    /**
     * Resolve all secrets in a MailAccount
     * @param {import('./MailAccount').MailAccount} mailAccount
     * @returns {Promise<MailAccount>}
     */
    async resolve(mailAccount) {
        const newMailAccount = mailAccount;

        const secretProperties = ['username', 'password', 'client_id', 'client_secret', 'tenant_id'];

        for (const property of secretProperties) {
            const propertyValue = mailAccount[property];

            if (!(propertyValue instanceof ValueObjectVaultReference)) continue;
            if (!propertyValue.value) continue;

            if (!propertyValue.isResolved && propertyValue.value.startsWith('SECRET_')) {
                try {
                    const value = propertyValue.value;
                    const resolvedValue = await this.secretReplacer.replaceSecretsInValue(value);

                    if (resolvedValue !== value) {
                        propertyValue.resolve(resolvedValue);
                    }
                } catch (error) {
                    Helper.logError(`Failed to resolve secret for ${property}:`, error);
                }
            }
        }

        return newMailAccount;
    }

    /**
     * Check if a MailAccount has any secret references
     * @param {MailAccount} mailAccount
     * @returns {boolean}
     */
    hasSecrets(mailAccount) {
        const secretProperties = ['username', 'password', 'client_id', 'client_secret', 'tenant_id'];

        return secretProperties.some((property) => mailAccount[property]?.value?.startsWith('SECRET_'));
    }
}

import { CustomError } from '../../../shared/errors/CustomError';
import { Crypto } from '../../../shared/domain/crypto';
import { SecretsFinderDomain } from '../..';
import { UniquenessValidator } from '../../../shared/validation/UniquenessValidator';

export class SecretUpdater {
    /** @type {KnexSecretsVaultRepository} is initialized in the constructor */ #repository;
    /** @type {object} */ #cryptoParams;
    /** @type {SecretsFinderDomain} is initialized in the constructor */ #finder;
    /** @type {UniquenessValidator} is initialized in the constructor */
    #uniquenessValidator;

    /**
     *
     * @param {KnexSecretsVaultRepository} repository
     * @param {object} cryptoParams
     */
    constructor(repository, cryptoParams) {
        this.#repository = repository;
        this.#cryptoParams = cryptoParams;
        this.#finder = new SecretsFinderDomain(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
    }

    /**
     *
     * @param {object} secretsVaultToUpdate data for update secret
     * @param {string} id idenficator secret for update
     * @returns {Promise<void>} void
     * @throws {CustomError} if the reference already exists or the secret does not exist
     * @throws {CustomError} if the secret does not exist
     * @throws {CustomError} if the reference already exists
     */
    async execute(secretsVaultToUpdate, id) {
        const secretsVault = await this.#finder.execute(id);

        if (!secretsVault) throw new CustomError(`The secret you are trying update does not exist`, 404);

        if (secretsVaultToUpdate.referencia) {
            await this.#uniquenessValidator.validate('referencia', secretsVaultToUpdate.referencia, id);
        }

        if (secretsVaultToUpdate.secreto !== undefined) {
            const crypto = new Crypto(
                this.#cryptoParams.secret_iv,
                this.#cryptoParams.secret_key,
                this.#cryptoParams.encryption_method
            );
            secretsVaultToUpdate.secreto = crypto.encryptData(secretsVaultToUpdate.secreto);
            secretsVaultToUpdate.password_encryption_migrated = null;
            if (this.#cryptoParams.encryption_method.toLowerCase() === Crypto.ENCRYPTION_METHOD) {
                secretsVaultToUpdate.password_encryption_migrated = true;
            }
        } else if (secretsVault.password_encryption_migrated.value === null &&
            this.#cryptoParams.encryption_method.toLowerCase() === Crypto.ENCRYPTION_METHOD) {
            secretsVault.password_encryption_migrated = true;
            const legacyCrypto = new Crypto(
                this.#cryptoParams.secret_iv,
                this.#cryptoParams.secret_key,
                Crypto.LEGACY_ENCRYPTION_METHOD
            );
            const decriptSecret = legacyCrypto.decryptData(secretsVault.secreto.value);

            const crypto = new Crypto(
                this.#cryptoParams.secret_iv,
                this.#cryptoParams.secret_key,
                this.#cryptoParams.encryption_method
            );
            secretsVaultToUpdate.secreto = crypto.encryptData(decriptSecret);
        }

        const originalValues = secretsVault.toJson();
        secretsVault.update(secretsVaultToUpdate);

        await this.#repository.update(secretsVault);
        await this.#repository.saveHistory(secretsVault, originalValues);
    }
}

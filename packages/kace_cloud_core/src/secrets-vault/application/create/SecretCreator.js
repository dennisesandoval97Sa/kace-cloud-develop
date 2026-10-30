import { SecretsFinderDomain, SecretsVault } from '../../index';
import { Crypto, CustomError, UniquenessValidator } from '../../../shared/index.js';

export class SecretCreator {
    /** @type {KnexSecretsVaultRepository} is initialized in the constructor */
    #repository;
    /** @type {SecretsFinderDomain} is initialized in the constructor */
    #finder;
    /** @type {object} is initialized in the constructor */
    #cryptoParams;
    /** @type {UniquenessValidator} is initialized in the constructor */
    #uniquenessValidator;

    /**
     * @param {KnexSecretsVaultRepository} repository
     * @param {object} cryptoParams
     */
    constructor(repository, cryptoParams) {
        this.#repository = repository;
        this.#finder = new SecretsFinderDomain(repository);
        this.#cryptoParams = cryptoParams;
        this.#uniquenessValidator = new UniquenessValidator(repository);
    }

    /**
     *
     * @param {object} secretsVault dto for create data in databse
     * @returns {Promise<void>}
     */
    async execute(secretsVault) {
        const result = await this.#finder.execute(secretsVault.id);
        if (result) {
            throw new CustomError(`Secret with id ${result.id.value} already exists`, 400);
        }
        await this.#uniquenessValidator.validate('referencia', secretsVault.referencia);

        const crypto = new Crypto(
            this.#cryptoParams.secret_iv,
            this.#cryptoParams.secret_key,
            this.#cryptoParams.encryption_method
        );
        secretsVault.password_encryption_migrated = null;
        if (this.#cryptoParams.encryption_method.toLowerCase() === Crypto.ENCRYPTION_METHOD) {
            secretsVault.password_encryption_migrated = true;
        }
        secretsVault.secreto = crypto.encryptData(secretsVault.secreto);
        const secretsVaultCreator = SecretsVault.create(secretsVault);
        await this.#repository.save(secretsVaultCreator);
        await this.#repository.saveHistory(secretsVaultCreator);
    }
}

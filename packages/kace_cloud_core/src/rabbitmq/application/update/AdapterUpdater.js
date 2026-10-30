import { ValueObjectUuid, CustomError, Crypto, Helper } from '../../../shared/index.js';
import { DomainAdapterFinder } from '../../domain/DomainAdapterFinder.js';

export class AdapterUpdater {
    /** @type {Object} repository */
    #repository;

    /** @type {DomainAdapterFinder} */
    #adapterFinder;

    /** @type {Object|null} */
    #cryptoParams;

    /**
     * @param {Object} repository - repository implementing update and findById and saveHistory
     */
    constructor(repository, cryptoParams = null) {
        this.#repository = repository;
        this.#adapterFinder = new DomainAdapterFinder(repository);
        this.#cryptoParams = cryptoParams;
    }

    /**
     * Update an adapter settings after validating existence and id format.
     * @param {string} id
     * @param {Object} dto
     */
    async execute(id, dto) {
        const validId = new ValueObjectUuid('id', id).value;

        const existing = await this.#adapterFinder.execute(validId);
        if (!existing) throw new CustomError(`Adapter with id ${validId} not found`, 404);

        const nullableFields = ["exchange", "vhost", "username", "password"];
        const cleanedDto = Object.entries(dto || {}).reduce((acc, [k, v]) => {
            if (v === "") {
                if (nullableFields.includes(k)) acc[k] = null;
            } else {
                acc[k] = v;
            }
            return acc;
        }, {});

        if (this.#cryptoParams && cleanedDto.password) {
            const crypto = new Crypto(
                this.#cryptoParams.secret_iv,
                this.#cryptoParams.secret_key,
                this.#cryptoParams.encryption_method
            );
            cleanedDto.password = crypto.encryptData(cleanedDto.password);
            cleanedDto.password_encryption_migrated = null;
            if (this.#cryptoParams.encryption_method.toLowerCase() === Crypto.ENCRYPTION_METHOD) {
                cleanedDto.password_encryption_migrated = true;
            }
        } else if (
            this.#cryptoParams &&
            this.#cryptoParams.encryption_method.toLowerCase() === Crypto.ENCRYPTION_METHOD &&
            !existing.password_encryption_migrated.value
        ) {
            const legacyCrypto = new Crypto(
                this.#cryptoParams.secret_iv,
                this.#cryptoParams.secret_key,
                Crypto.LEGACY_ENCRYPTION_METHOD
            );
            const decryptedPassword = legacyCrypto.decryptData(existing.password);

            const crypto = new Crypto(
                this.#cryptoParams.secret_iv,
                this.#cryptoParams.secret_key,
                this.#cryptoParams.encryption_method
            );
            cleanedDto.password = crypto.encryptData(decryptedPassword);
            cleanedDto.password_encryption_migrated = true;
        }

        const result = await this.#repository.update(validId, cleanedDto);

        if (this.#repository.saveHistory) {
            try {
                await this.#repository.saveHistory({ id: validId, updated: true, changes: dto });
            } catch (e) {
                Helper.logError(e);
                // history save failure should not block update
            }
        }

        return result;
    }
}

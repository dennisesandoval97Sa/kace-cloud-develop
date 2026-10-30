import { AdapterSettings } from '../../domain/AdapterSettings.js';
import { DomainAdapterFinder } from '../../domain/DomainAdapterFinder.js';
import { ValidationService } from '../../domain/ValidationService.js';
import { CustomError, Crypto } from '../../../shared/index.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';

export class AdapterCreator {
    /** @type {KnexAdapterSettingsRepository} repository */
    #repository;

    /** @type {ValidationService} */
    #validationService;

    /** @type {DomainAdapterFinder} */
    #adapterFinder;

    /** @type {Object|null} */
    #cryptoParams;

    /**
     * @param {Object} repository - repository implementing create, findById, findByName, saveHistory
     */
    constructor(repository, cryptoParams = null) {
        this.#repository = repository;
        this.#validationService = new ValidationService(repository);
        this.#adapterFinder = new DomainAdapterFinder(repository);
        this.#cryptoParams = cryptoParams;
    }

    /**
     * Create a new AdapterSettings entity and persist it.
     * Performs basic validations and uniqueness checks.
     * @param {Object} dto
     */
    async execute(dto) {
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
        }

        const adapter = AdapterSettings.create(cleanedDto);

        if (adapter.id) {
            const found = await this.#adapterFinder.execute(adapter.id);
            if (found) throw new CustomError(`Adapter with id ${adapter.id} already exists`, 400);
        }

        await this.#validationService.validateAdapterNameUnique(adapter.name);

        const result = await this.#repository.create(adapter);

        if (this.#repository.saveHistory) {
            try {
                await this.#repository.saveHistory(adapter);
            } catch (e) {
                Helper.logError('AdapterCreator.saveHistory failed', e && e.message ? e.message : e);
            }
        }

        return result;
    }
}

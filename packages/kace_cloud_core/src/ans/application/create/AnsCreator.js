import { Ans, DomainAnsFinder } from '../../index';
import { UniquenessValidator, ValidationFailError } from '../../../shared/index.js';

export class AnsCreator {
    #repository;
    /** @type {DomainAnsFinder} is initialized in the constructor */
    #ansFinder;
    /** @type {UniquenessValidator} is initialized in the constructor */
    #uniquenessValidator;

    constructor(repository) {
        this.#repository = repository;
        this.#ansFinder = new DomainAnsFinder(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
    }

    /**
     * Executes the creation of an Ans object and saves it to the repository.
     *
     * @param {Object} dto - The data transfer object containing the properties for the Ans object.
     * @returns {Promise<void>} A promise that resolves when the Ans object is saved.
     */
    async execute(dto) {
        const ans = Ans.create(dto);

        if (dto.intermedio >= dto.vencido) {
            throw new ValidationFailError(
                `Expired value: ${dto.intermedio}, must be upper to intermedium value: ${dto.vencido}`,
                'intermedio'
            );
        }

        const result = await this.#ansFinder.execute(ans.id.value);
        if (result) {
            throw new ValidationFailError(`ANS with id ${ans.id.value} already exists`, 'id');
        }

        const uniquenessFields = this.#prepareUniquenessFields(dto);
        await this.#uniquenessValidator.validateMultiple(uniquenessFields);
        await this.#uniquenessValidator.validate('nombre', dto.nombre);

        await this.#repository.save(ans);
        await this.#repository.saveHistory(ans);
    }

    #prepareUniquenessFields(dto) {
        return [
            { field: 'intermedio', value: dto.intermedio },
            { field: 'vencido', value: dto.vencido },
            { field: 'medicion_ans_id', value: dto.medicion_ans_id },
        ];
    }
}

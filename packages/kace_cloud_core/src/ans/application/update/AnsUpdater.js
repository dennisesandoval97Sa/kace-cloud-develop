import { UniquenessValidator, ValidationFailError } from '../../../shared/index.js';
import { DomainAnsFinder } from '../../index.js';

export class AnsUpdater {
    /** @type {DomainAnsFinder} is initialized in the constructor*/
    #ansFinder;
    /** @type {KnexAnsRepository} is initialized in the constructor*/
    #repository;
    /** @type {UniquenessValidator} is initialized in the constructor */
    #uniquenessValidator;

    constructor(repository) {
        this.#repository = repository;
        this.#ansFinder = new DomainAnsFinder(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
    }

    /**
     * Updates an Ans object in the repository.
     *
     * @param {string} id - The unique identifier of the Ans object to update.
     * @param {Object} dto - The data transfer object containing the properties to update in the Ans object.
     * @returns {Promise<void>} A promise that resolves when the Ans object is updated.
     */
    async execute(id, dto) {
        const ans = await this.#ansFinder.execute(id);

        if (!ans) {
            throw new ValidationFailError(`ANS with id ${id} does not exist.`, 'id');
        }

        // A partial update must keep the rule against the stored value of the field it does not send.
        const intermedio = dto.intermedio ?? ans.intermedio.value;
        const vencido = dto.vencido ?? ans.vencido.value;
        if (intermedio >= vencido) {
            throw new ValidationFailError(
                `Expired value: ${intermedio}, must be upper to intermedium value: ${vencido}`,
                'intermedio'
            );
        }

        if (dto.intermedio || dto.vencido || dto.medicion_ans_id) {
            const uniquenessFields = this.#prepareUniquenessFields(dto, ans);
            await this.#uniquenessValidator.validateMultiple(uniquenessFields, id);
        }

        const originalValues = ans.toJson();
        ans.update(dto);

        await this.#repository.update(ans);
        await this.#repository.saveHistory(ans, originalValues);

        ans.flushChanges();
    }

    #prepareUniquenessFields(dto, ans) {
        const fields = ['intermedio', 'vencido', 'medicion_ans_id'];

        return fields.map((field) => ({
            field,
            value: dto[field] !== undefined ? dto[field] : ans[field].value,
        }));
    }
}

import { UniquenessValidator } from '../../../shared/validation/UniquenessValidator';
import { DomainShiftManagementFinder } from '../../index';

export class ShiftManagementUpdater {
    /** @type {DomainShiftManagementFinder} is initialized in the constructor */
    #shiftManagementFinder;
    /** @type {KnexShiftManagementRepository} is initialized in the constructor */
    #repository;
    /** @type {UniquenessValidator} is initialized in the constructor */
    #uniquenessValidator;

    /**
     * Creates an instance of the `ShiftManagementUpdater` class.
     *
     * @param {KnexShiftManagementRepository} repository - An instance of the repository that manages ShiftManagement records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#shiftManagementFinder = new DomainShiftManagementFinder(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
    }

    /**
     * Updates a `ShiftManagement` object in the repository.
     *
     * @param {string} id - The unique identifier of the `ShiftManagement` object to update.
     * @param {Object} dto - The data transfer object containing the properties to update in the `ShiftManagement` object.
     * @returns {Promise<void>} A promise that resolves when the `ShiftManagement` object is updated.
     */
    async execute(id, dto) {
        const shiftManagement = await this.#shiftManagementFinder.execute(id);

        if (!shiftManagement) {
            throw new Error(`ShiftManagement with ID ${id} does not exist.`);
        }

        if (dto.description) {
            await this.#uniquenessValidator.validate('description', dto.description, id);
        }

        const originalValues = shiftManagement.toJson();
        shiftManagement.update(dto);

        await this.#repository.update(shiftManagement);
        await this.#repository.saveHistory(shiftManagement, originalValues);

        shiftManagement.flushChanges();
    }
}

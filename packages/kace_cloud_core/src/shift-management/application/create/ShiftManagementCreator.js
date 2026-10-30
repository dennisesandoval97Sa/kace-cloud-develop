import { CustomError, UniquenessValidator } from '../../../shared/index.js';
import { DomainShiftManagementFinder, ShiftManagement } from '../../index.js';

export class ShiftManagementCreator {
    /** @type {KnexShiftManagementRepository} is initialized in the constructor */
    #repository;
    /** @type {DomainShiftManagementFinder} is initialized in the constructor */
    #finder;
    /** @type {UniquenessValidator} is initialized in the constructor */
    #uniquenessValidator;

    /**
     * Creates an instance of `ShiftManagementCreator`.
     *
     * @param {KnexShiftManagementRepository} repository - The repository used to save ShiftManagement records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainShiftManagementFinder(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
    }

    /**
     * Executes the process of creating a new ShiftManagement entity.
     *
     * This method takes a data transfer object (DTO) containing the necessary properties to create
     * a new `ShiftManagement` object and then saves it to the repository.
     *
     * @param {Object} dto - The data transfer object containing the properties for the `ShiftManagement` object.
     * @returns {Promise<void>} A promise that resolves when the `ShiftManagement` object is successfully created.
     */
    async execute(dto) {
        const shiftManagement = ShiftManagement.create(dto);

        const result = await this.#finder.execute(shiftManagement.id.value);
        if (result) {
            throw new CustomError(`ShiftManagement with id ${shiftManagement.id.value} already exists`, 400);
        }

        await this.#uniquenessValidator.validate('description', dto.description);

        await this.#repository.save(shiftManagement);
        await this.#repository.saveHistory(shiftManagement);
    }
}

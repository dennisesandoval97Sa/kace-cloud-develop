import { SubcasesRelationship } from '../../domain/SubcasesRelationship';
import { InvalidArgumentError } from '../../../shared/index.js';
import { ValueObjectUuid } from '../../../shared/index.js';

export class SubCaseRelationCreator {
    /** @type {KnexSubcaseRelationshipRepository} is initialized in the constructor */
    #repository;

    /**
     * Creates an instance of `UserGroupCreator`.
     *
     * @param {KnexSubcaseRelationshipRepository} knexSubcaseRelationshipRepository - The repository used to save subcases relation.
     */
    constructor(knexSubcaseRelationshipRepository) {
        this.#repository = knexSubcaseRelationshipRepository;
    }

    /**
     * Handles creation of subcases relationships.
     *
     * @param {Object[]} dto - List of SubcasesRelationship entities.
     *   - `parent_case_id` (string): Identificador único del **caso padre** en la relación.
     *   - `child_case_id` (string): Identificador único del **subcaso** (caso hijo) en la relación.
     * @returns {Promise<void>}
     */
    async execute(parent_case_id, child_case_id, created_by) {
        if (!parent_case_id || !child_case_id) {
            throw new InvalidArgumentError('Both parent_case_id and child_case_id are required');
        }
        if (parent_case_id === child_case_id) {
            throw new InvalidArgumentError('parent_case_id cannot be equal to child_case_id');
        }

        const parentVO = new ValueObjectUuid('id', parent_case_id);
        const childVO = new ValueObjectUuid('id', child_case_id);

        const bothExist = await this.#repository.bothExist(parentVO, childVO);

        if (!bothExist) {
            throw new InvalidArgumentError('One or more of the provided IDs do not exist.');
        }

        const relationExist = await this.#repository.find(parentVO, childVO);
        if (relationExist) {
            throw new InvalidArgumentError('Relation already exist');
        }
        const relation = SubcasesRelationship.create({ parent_case_id, child_case_id });
        await this.#repository.save(relation);
        await this.#repository.saveHistory({
            action: 'create',
            parent_case_id,
            child_case_id,
            created_at: new Date(),
            created_by,
        });
    }
}

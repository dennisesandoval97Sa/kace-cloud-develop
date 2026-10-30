import { InvalidArgumentError } from '../../../shared/index.js';
import { ValueObjectUuid } from '../../../shared/index.js';

export class SubCaseRelationDeleter {
    /**
     * @param {KnexSubcaseRelationshipRepository} repository
     */
    constructor(repository) {
        this.repository = repository;
    }

    /**
     * Elimina la relación (parent -> child)
     * @param {Object} params
     * @param {string} params.parent_case_id
     * @param {string} params.child_case_id
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
        const relationExist = await this.repository.find(parentVO, childVO);

        if (!relationExist) {
            throw new InvalidArgumentError('Relation does not exist');
        }

        await this.repository.deleteByParentAndChild(parentVO, childVO);
        await this.repository.saveHistory({
            action: 'delete',
            parent_case_id,
            child_case_id,
            created_at: new Date(),
            created_by,
        });
    }
}

import { ValueObjectUuid } from '../../shared';

export class SubcasesOpenStatusService {
    /**
     * @param {object} deps
     * @param {import('../infrastructure/KnexSubcaseRelationshipRepository.js').KnexSubcaseRelationshipRepository} deps.subcaseRepo
     * @param {import('../../infrastructure/KnexCaseRepository.js').KnexCaseRepository} deps.caseRepo
     */
    constructor({ subcaseRepo }) {
        this.subcaseRepo = subcaseRepo;
    }

    /**
     * Retorna true/false si existe al menos un hijo abierto
     * @param {string} parentId
     */
    async hasOpenChildren(parentId) {
        const parentVO = new ValueObjectUuid('parent_case_id', parentId);
        return this.subcaseRepo.existsOpenChildByParent(parentVO.value);
    }
}

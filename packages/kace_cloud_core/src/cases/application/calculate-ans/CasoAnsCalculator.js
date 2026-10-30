import { DomainCaseFinder } from '../../index';
import { CaseAnsResponse } from '../CaseAnsCalculateResponse';
import { UpdateSLATimers } from '../../../shared/domain/services/UpdateSLATimers.js';

export class CasoAnsCalculator {
    /**
     * @type {KnexCaseRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     * @type {DomainCaseFinder}
     * is initialized in the constructor
     */
    #finder;

    /**
     * @param {KnexCaseRepository} repository
     */
    constructor(caseRepository) {
        this.#repository = caseRepository;
        this.#finder = new DomainCaseFinder(caseRepository);
    }

    /**
     *
     * @param {string} id identificator of case
     * @returns {Promise<CaseAnsResponse>}
     */
    async execute(id) {
        const { kase, caseAns, shiftManagement, stateAns, globalConfig } = await this.#finder.executeForAns(id);

        const slaUpdater = new UpdateSLATimers(kase, shiftManagement, caseAns, stateAns, globalConfig);

        const originalValues = kase.toJson();

        await slaUpdater.execute();

        await this.#repository.update(kase);

        await this.#repository.saveHistory(kase, originalValues);

        return new CaseAnsResponse(kase);
    }
}

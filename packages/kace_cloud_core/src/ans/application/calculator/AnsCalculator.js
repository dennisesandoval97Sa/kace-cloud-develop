import { AnsCalculateResponse, CalculateService } from '../../index.js';
import { Helper } from '../../../shared';

export class AnsCalculator {
    /** @type {CalculateService} is initialized in the constructor */
    #calculateService;

    /**
     *
     * @param {CalculateService} calculateAnsCasesService
     */
    constructor(caseRepository) {
        this.#calculateService = new CalculateService(caseRepository);
    }

    /**
     * Executes the creation of an Ans object and saves it to the repository.
     *
     * @param {string} measurementType - The data transfer object containing the properties for the Ans object.
     * @returns {Promise<AnsCalculateResponse>} A promise that resolves to an AnsResponse object containing the found Ans data.
     */
    async execute({ measurementType }) {
        if (!measurementType) throw new Error('Measurement type is not provided.');

        const label = `AnsCalc-${measurementType}-${Date.now()}`;
        Helper.logDebug(`  [AnsCalculator] Starting calculation for type: ${measurementType}`);
        Helper.logTime(label);

        const start = Date.now();
        const { processedCases, elapsedTime } = await this.#calculateService.execute(measurementType);

        const totalElapsed = Date.now() - start;
        Helper.logTimeEnd(label);
        Helper.logDebug(`  [AnsCalculator] Finished: ${processedCases} cases in ${totalElapsed}ms (service reported: ${elapsedTime}ms)`);

        return new AnsCalculateResponse(processedCases, elapsedTime);
    }
}
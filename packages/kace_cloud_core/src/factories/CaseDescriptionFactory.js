import { chance, Factory, uuidv4 } from './Factory.js';
import { CaseDescription, KnexCaseDescriptionRepository } from '../case-descriptions/index.js';
import { Helper } from '../shared/infrastructure/utils/Helper.js';

export class CaseDescriptionFactory extends Factory {
    /**
     * @param {*} knexConfig
     */
    constructor(knexConfig) {
        super(KnexCaseDescriptionRepository, CaseDescription, {}, knexConfig);

        this.define({
            id: () => uuidv4(),
            descripcion: () => chance.sentence({ words: 10 }),
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        })
            .afterMaking((caseDescription) => {
                Helper.logInfo(`CaseDescription made with id: ${caseDescription.id.value}`);
            })
            .afterCreating((caseDescription) => {
                Helper.logInfo(`CaseDescription created with id: ${caseDescription.id.value}`);
            });
    }
}

import { chance, Factory, uuidv4 } from './Factory.js';
import { KnexOneScriptRepository, OneScript } from '../one-script/index.js';
import { Helper } from '../shared/infrastructure/utils/Helper.js';
import { Parameters } from '../shared/domain/params/Parameters.js';

export class OneScriptFactory extends Factory {
    /**
     * @param {*} knexConfig
     */
    constructor(knexConfig) {
        super(KnexOneScriptRepository, OneScript, {}, knexConfig);

        this.define({
            id: () => uuidv4(),
            name: () => chance.word({ length: 10 }),
            url: () => chance.url(),
            url_api: () => Parameters.oneScriptUrlApi(uuidv4()),
            onescript_reference_id: () => uuidv4(),
            created_by: uuidv4(),
            created_at: new Date().toISOString(),
        })
            .afterMaking((oneScript) => {
                Helper.logInfo(`OneScript made with id: ${oneScript.id.value}`);
            })
            .afterCreating((oneScript) => {
                Helper.logInfo(`OneScript created with id: ${oneScript.id.value}`);
            });
    }
}

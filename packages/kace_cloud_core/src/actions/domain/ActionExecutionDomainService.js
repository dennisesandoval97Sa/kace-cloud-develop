import { Helper } from '../../shared/index.js';
import { FinderByTrigger } from './services/FinderByTrigger.js';
import { CaseFinder } from '../../cases/domain/CaseFinder.js';
import { CaseActionValidator } from '../../shared/domain/services/CaseActionValidator.js';

const isFrozenConditionContextEnabled = () => process.env.ACTION_FROZEN_CONDITION_CONTEXT_ENABLED === 'true';

export class ActionExecutionDomainService {
    /** @type {KnexActionRepository} */
    #actionRepository; // is initialized in the constructor
    /** @type {import('../../shared/domain/services/ActionExecutor.js').ActionExecutor} */
    #actionExecutor; // is initialized in the constructor
    /** @type {CaseFinder} */
    #caseFinder; // is initialized in the constructor
    /** @type {CaseActionValidator} */
    #entityActionValidator; // is initialized in the constructor
    /** @type {FinderByTrigger} */
    #finderByTrigger; // is initialized in the constructor

    constructor(actionRepository, actionExecutor, caseRepository) {
        this.#actionRepository = actionRepository;
        this.#actionExecutor = actionExecutor;
        this.#caseFinder = new CaseFinder(caseRepository);
        this.#entityActionValidator = new CaseActionValidator(actionRepository);
        this.#finderByTrigger = new FinderByTrigger(actionRepository);
    }

    /**
     *
     * @param {string} trigger
     * @param {Aggregate} entity
     * @param {{ conditionContext?: object }} [options] - `conditionContext`: snapshot precomputado
     *   contra el cual evaluar las condiciones (seam para el Enfoque B: snapshot serializado en el
     *   evento). Si se omite, se construye una vez con getCasoInfo.
     */
    async execute(trigger, entity, { conditionContext } = {}) {
        try {
            const actions = await this.#finderByTrigger.execute(trigger);
            const freeze = isFrozenConditionContextEnabled();

            // Snapshot CONGELADO para condiciones (capturado una vez).
            const frozenEntity = entity;
            const frozenContext = conditionContext ?? (await this.#actionRepository.getCasoInfo(entity));
            Helper.logDebug2('ActionExecutionDomainService::context', frozenContext);

            // Datos VIVOS para ejecución (se refrescan por acción de caso).
            let liveEntity = entity;
            let liveContext = frozenContext;

            for (const action of actions) {
                Helper.logInfo(`Case evaluate conditions for action ${action.description.value}. Executing...`);

                const condEntity = freeze ? frozenEntity : liveEntity;
                const condContext = freeze ? frozenContext : liveContext;

                const isValidate = await this.#entityActionValidator.validateWithContext(
                    condEntity,
                    action,
                    condContext
                );
                if (isValidate) {
                    Helper.logInfo(`Case meet conditions for action ${action.description.value}. Executing...`);
                    await this.#actionExecutor.execute(action, liveEntity, undefined, trigger);
                    Helper.logDebug(`after executing action ${JSON.stringify(liveEntity.toJson())}.`);
                    if (action.entity.value === 'case') {
                        liveEntity = await this.#caseFinder.execute(liveEntity.id.value);
                        liveContext = await this.#actionRepository.getCasoInfo(liveEntity);
                        Helper.logDebug(`after caseFinde action ${JSON.stringify(liveEntity.toJson())}.`);
                    }
                } else {
                    Helper.logInfo(`Case does not meet conditions for action ${action.description.value}. Skipping...`);
                }
            }
        } catch (error) {
            Helper.logError(`Error executing actions for trigger ${trigger}:`, error);
        }
    }
}

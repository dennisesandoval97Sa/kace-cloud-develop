import { chance, Factory, uuidv4 } from './Factory.js';
import { Case, KnexCaseRepository } from '../cases/index.js';
import { ClientFactory } from './ClientFactory.js';
import { TransitionFactory } from './TransitionFactory.js';
import { UserFactory } from './UserFactory.js';
import { ClassificationFactory } from './ClassificationFactory.js';
import { CaseDescriptionFactory } from './CaseDescriptionFactory.js';
import { GroupFactory } from './GroupFactory.js';
import { Helper } from '../shared/infrastructure/utils/Helper.js';

export class CaseFactory extends Factory {
    /**
     * @param {*} knexConfig
     */
    constructor(knexConfig) {
        super(KnexCaseRepository, Case, {}, knexConfig);

        this.define({
            id: () => uuidv4(),
            motivo_baja: 'motivo baja',
            alto_impacto: chance.pickone([1]),
            vista: chance.word(),
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
            update_source: 'manual',
        })
            .state('closed', { fecha_resolucion: new Date() })
            .state('ana_inicial', { ans_posicion: 1 })
            .state('ans_intermedio', { ans_posicion: 2 })
            .state('ans_vencido', { ans_posicion: 3 })
            .relation('cliente_id', new ClientFactory(knexConfig))
            .relation('transicion_id', new TransitionFactory(knexConfig))
            .relation('responsable_id', new UserFactory(knexConfig))
            .relation('clasificacion_id', new ClassificationFactory(knexConfig))
            .relation('descripcion_caso_id', new CaseDescriptionFactory(knexConfig))
            .relation('grupo_id', new GroupFactory(knexConfig))
            .afterMaking((caseAgg) => {
                Helper.logInfo(`Case made with id: ${caseAgg.id.value}`);
            })
            .afterCreating((caseAgg) => {
                Helper.logInfo(`Case created with id: ${caseAgg.id.value}`);
            });
    }
}

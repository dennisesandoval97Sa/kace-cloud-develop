import { v4 as uuidv4 } from 'uuid';
import { StatusEnum } from '../../../src/shared/index.js';
import { TransitionRule } from '../../../src/transition-rules/domain/TransitionRule.js';

export class TransitionRuleMother {
    /**
     * Generates a DTO for the TransitionRule entity.
     * @param {Object} override
     * @returns {Object}
     */
    static dto(override = {}) {
        return {
            id: uuidv4(),
            nombre: `Regla de prueba ${uuidv4().slice(0, 8)}`,
            conditions: {
                combinator: 'and',
                rules: [
                    {
                        combinator: 'and',
                        not: false,
                        rules: [
                            {
                                field: 'cases.status',
                                operator: '=',
                                value: '1',
                                type: 'manual_input',
                                value_type: 'text',
                            },
                        ],
                    },
                ],
            },
            status: StatusEnum.ACTIVE.value,
            created_by: uuidv4(),
            created_at: new Date().toISOString(),
            ...override,
        };
    }

    /**
     * Creates a TransitionRule instance and saves it to the repository.
     * @param {KnexTransitionRuleRepository} repository
     * @param {Object} override
     * @returns {Promise<TransitionRule>}
     */
    static async create(repository, override = {}) {
        const rule = TransitionRule.create(TransitionRuleMother.dto(override));
        await repository.save(rule);
        return rule;
    }
}

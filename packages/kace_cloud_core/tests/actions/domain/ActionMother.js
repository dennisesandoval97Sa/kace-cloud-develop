import { v4 as uuidV4 } from 'uuid';
import { Action, ActionTypes } from '../../../src/actions';
import Chance from 'chance';
import TestHelper from '../../TestHelper.js';

const chance = new Chance();
export default class ActionMother {
    /**
     * Generates a Data Transfer Object (DTO) for the `Action` entity.
     *
     * @returns {Object} The DTO containing the properties for an `Action` entity.
     */
    static dto({
        id,
        action_type,
        description,
        conditions,
        triggers,
        permissions,
        state_id,
        group_id,
        responsible_id,
        template_id,
        mail_account_id,
        advisor_list_id,
        group_list_id,
        ws_rest_flow_id,
        model_update_id,
        external_group_code,
        external_group_dynamic_code,
        external_user_code,
        external_user_dynamic_code,
        priority,
        is_active,
        automation_id,
        created_at,
        created_by,
        entity,
    } = {}) {
        return {
            id: id ?? uuidV4(),
            action_type: action_type ?? ActionTypes.ASIGNAR_ASESOR_EN_CURSO.value,
            description: description ?? TestHelper.generateSafeValue(() => chance.word({ length: 8 })),
            conditions: conditions ?? {},
            triggers: triggers ?? null,
            permissions: permissions ?? null,
            state_id: state_id ?? null,
            group_id: group_id ?? null,
            responsible_id: responsible_id ?? uuidV4(),
            template_id: template_id ?? null,
            mail_account_id: mail_account_id ?? null,
            advisor_list_id: advisor_list_id ?? null,
            group_list_id: group_list_id ?? null,
            ws_rest_flow_id: ws_rest_flow_id ?? null,
            model_update_id: model_update_id ?? null,
            external_group_code: external_group_code ?? null,
            external_group_dynamic_code: external_group_dynamic_code ?? null,
            external_user_code: external_user_code ?? null,
            external_user_dynamic_code: external_user_dynamic_code ?? null,
            priority: priority ?? 1,
            is_active: is_active ?? true,
            automation_id: automation_id ?? null,
            created_at: created_at ?? new Date().toISOString(),
            created_by: created_by ?? uuidV4(),
            entity: entity ?? 'case',
        };
    }

    /**
     * Creates an `Action` instance and saves it to the repository.
     *
     * @param {KnexActionRepository} repository - The repository to save the `Action` instance.
     * @param {Object} data - The data to create the `Action` instance.
     * @returns {Action} The created `Action` instance.
     */
    static async create(repository, data = {}) {
        const action = Action.create(ActionMother.dto(data));
        await repository.save(action);
        return action;
    }

    static WSActionDto({ ruleValue, ruleField, restFlowId, entity, triggers }) {
        const id = uuidV4();
        return {
            action_type: 'consumo_rest_flow',
            description: `test WS F2 ${id}`,
            conditions: {
                combinator: 'and',
                rules: [
                    {
                        combinator: 'and',
                        not: false,
                        rules: [
                            {
                                field: ruleField ?? 'cases.responsable_id',
                                operator: '=',
                                type: 'manual_input',
                                value: ruleValue ?? uuidV4(),
                                value_type: 'text',
                                id: uuidV4(),
                            },
                        ],
                        id: uuidV4(),
                    },
                ],
                id: uuidV4(),
            },
            triggers: triggers ?? ['crear_caso', 'editar_caso'],
            permissions: {
                blackList: { grupos: [], usuarios: [] },
                whiteList: { usuarios: [] },
            },
            ws_rest_flow_id: restFlowId ?? uuidV4(),
            is_active: true,
            priority: 99,
            id: id,
            entity: entity ?? 'case',
            created_at: new Date().toISOString(),
            created_by: uuidV4(),
        };
    }

    static SendEmailActionDto({ ruleValue, ruleField, templateId, entity, triggers, mailAccountId }) {
        const id = uuidV4();
        return {
            action_type: 'envio_correo',
            description: `Test send email ${id}`,
            conditions: {
                combinator: 'and',
                rules: [
                    {
                        combinator: 'and',
                        not: false,
                        rules: [
                            {
                                field: ruleField ?? 'cases.responsable_id',
                                operator: '=',
                                type: 'manual_input',
                                value: ruleValue ?? uuidV4(),
                                value_type: 'text',
                                id: uuidV4(),
                            },
                        ],
                        id: uuidV4(),
                    },
                ],
                id: uuidV4(),
            },
            triggers: triggers ?? ['crear_caso', 'editar_caso'],
            permissions: {
                blackList: { grupos: [], usuarios: [] },
                whiteList: { usuarios: [] },
            },
            mail_account_id: mailAccountId ?? uuidV4(),
            template_id: templateId ?? uuidV4(),
            is_active: true,
            priority: 99,
            id: id,
            entity: entity ?? 'case',
            created_at: new Date().toISOString(),
            created_by: uuidV4(),
        };
    }
}

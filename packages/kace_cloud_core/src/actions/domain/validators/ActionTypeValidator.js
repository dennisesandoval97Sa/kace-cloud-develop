import { ActionValidationError } from './ActionValidationError.js';

export class ActionTypeValidator {
    /**
     *
     * @param {Action} action
     */
    static validate(action) {
        const validator = ACTION_TYPE_VALIDATORS[action.action_type.value];
        if (!validator) {
            throw new ActionValidationError(`No validator found for action type: ${action.action_type.value}`);
        }
        validator(action);
    }
}

const ACTION_TYPE_VALIDATORS = {
    asignar_asesor_en_curso: createValidator('responsible_id'),
    asignar_lista_asesores: createValidator('advisor_list_id'),
    asignar_grupo_en_curso: createValidator('group_id'),
    asignar_lista_grupos: createValidator('group_list_id'),
    envio_correo: createValidator(['mail_account_id', 'template_id']),
    asignar_grupo_por_codigo_externo: createValidator('external_group_code'),
    asignar_usuario_por_codigo_externo: createValidator('external_user_code'),
    asignar_grupo_por_codigo_externo_dinamico: createValidator('external_group_dynamic_code'),
    asignar_usuario_por_codigo_externo_dinamico: createValidator('external_user_dynamic_code'),
    consumo_rest_flow: createValidator('ws_rest_flow_id'),
    actualizar_modelo: createValidator('model_update_id'),
};

function createValidator(requiredFields) {
    return (action) => {
        const fields = Array.isArray(requiredFields) ? requiredFields : [requiredFields];
        fields.forEach((field) => validateActionRequiredField(action, field));
        validateNoOtherFields(action, fields, `Action should only have ${fields.join(', ')}`);
    };
}

function validateActionRequiredField(action, field) {
    if (!action[field].value) {
        throw new ActionValidationError('Field cannot be empty');
    }
}

function validateNoOtherFields(action, allowedFields, message) {
    const allFields = [
        'responsible_id',
        'advisor_list_id',
        'group_id',
        'group_list_id',
        'mail_account_id',
        'template_id',
        'model_update_id',
        'external_group_code',
        'external_user_code',
        'external_group_dynamic_code',
        'external_user_dynamic_code',
        'ws_rest_flow_id',
    ];

    const invalidFields = allFields
        .filter((field) => !allowedFields.includes(field))
        .filter((field) => action[field].value != null);

    if (invalidFields.length > 0) {
        throw new ActionValidationError(message);
    }
}

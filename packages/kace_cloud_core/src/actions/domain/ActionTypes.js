import { Helper } from '../../shared/infrastructure/utils/Helper.js';

export class ActionTypes {
    static ASIGNAR_ASESOR_EN_CURSO = new ActionTypes('ASIGNAR_ASESOR_EN_CURSO', 'asignar_asesor_en_curso');
    static ASIGNAR_LISTA_ASESORES = new ActionTypes('ASIGNAR_LISTA_ASESORES', 'asignar_lista_asesores');
    static ASIGNAR_GRUPO_EN_CURSO = new ActionTypes('ASIGNAR_GRUPO_EN_CURSO', 'asignar_grupo_en_curso');
    static ASIGNAR_LISTA_GRUPOS = new ActionTypes('ASIGNAR_LISTA_GRUPOS', 'asignar_lista_grupos');
    static ASIGNAR_GRUPO_POR_CODIGO_EXTERNO = new ActionTypes(
        'ASIGNAR_GRUPO_POR_CODIGO_EXTERNO',
        'asignar_grupo_por_codigo_externo'
    );
    static ASIGNAR_USUARIO_POR_CODIGO_EXTERNO = new ActionTypes(
        'ASIGNAR_USUARIO_POR_CODIGO_EXTERNO',
        'asignar_usuario_por_codigo_externo'
    );
    static ASIGNAR_GRUPO_POR_CODIGO_EXTERNO_DINAMICO = new ActionTypes(
        'ASIGNAR_GRUPO_POR_CODIGO_EXTERNO_DINAMICO',
        'asignar_grupo_por_codigo_externo_dinamico'
    );
    static ASIGNAR_USUARIO_POR_CODIGO_EXTERNO_DINAMICO = new ActionTypes(
        'ASIGNAR_USUARIO_POR_CODIGO_EXTERNO_DINAMICO',
        'asignar_usuario_por_codigo_externo_dinamico'
    );
    static ENVIO_CORREO = new ActionTypes('ENVIO_CORREO', 'envio_correo');
    static CONSUMO_REST_FLOW = new ActionTypes('CONSUMO_REST_FLOW', 'consumo_rest_flow');
    static ACTUALIZAR_MODELO = new ActionTypes('ACTUALIZAR_MODELO', 'actualizar_modelo');

    /**
     * Action types that assign cases by resolving a target group first.
     * These types undergo group-level preprocessing in the cron producer:
     * groupId resolution, strategy check, and cupos limiting (if configured).
     * @returns {Set<string>}
     */
    static get GROUP_ASSIGNMENT_TYPES() {
        return new Set([
            ActionTypes.ASIGNAR_LISTA_ASESORES.value,
            ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value,
            ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO.value,
            ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO_DINAMICO.value,
        ]);
    }

    /**
     * Checks if a given action type assigns by group resolution.
     * @param {string} actionTypeValue
     * @returns {boolean}
     */
    static isGroupAssignment(actionTypeValue) {
        return ActionTypes.GROUP_ASSIGNMENT_TYPES.has(actionTypeValue);
    }

    constructor(key, value) {
        this.#ensureIsValidActionType(value);

        this.key = key;
        this.value = value;

        Object.freeze(this);
    }

    static fromValue(value) {
        for (const type of [
            ActionTypes.ASIGNAR_ASESOR_EN_CURSO,
            ActionTypes.ASIGNAR_LISTA_ASESORES,
            ActionTypes.ASIGNAR_GRUPO_EN_CURSO,
            ActionTypes.ASIGNAR_LISTA_GRUPOS,
            ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO,
            ActionTypes.ASIGNAR_USUARIO_POR_CODIGO_EXTERNO,
            ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO_DINAMICO,
            ActionTypes.ASIGNAR_USUARIO_POR_CODIGO_EXTERNO_DINAMICO,
            ActionTypes.ENVIO_CORREO,
            ActionTypes.CONSUMO_REST_FLOW,
            ActionTypes.ACTUALIZAR_MODELO,
        ]) {
            if (value === type.value) {
                return type;
            }
        }
        Helper.logError(`Invalid value: ${value}`);
        throw new Error(`Invalid value: ${value}`);
    }

    static toJson() {
        return {
            ASIGNAR_ASESOR_EN_CURSO: ActionTypes.ASIGNAR_ASESOR_EN_CURSO.value,
            ASIGNAR_LISTA_ASESORES: ActionTypes.ASIGNAR_LISTA_ASESORES.value,
            ASIGNAR_GRUPO_EN_CURSO: ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value,
            ASIGNAR_LISTA_GRUPOS: ActionTypes.ASIGNAR_LISTA_GRUPOS.value,
            ASIGNAR_GRUPO_POR_CODIGO_EXTERNO: ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO.value,
            ASIGNAR_USUARIO_POR_CODIGO_EXTERNO: ActionTypes.ASIGNAR_USUARIO_POR_CODIGO_EXTERNO.value,
            ASIGNAR_GRUPO_POR_CODIGO_EXTERNO_DINAMICO: ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO_DINAMICO.value,
            ASIGNAR_USUARIO_POR_CODIGO_EXTERNO_DINAMICO: ActionTypes.ASIGNAR_USUARIO_POR_CODIGO_EXTERNO_DINAMICO.value,
            ENVIO_CORREO: ActionTypes.ENVIO_CORREO.value,
            CONSUMO_REST_FLOW: ActionTypes.CONSUMO_REST_FLOW.value,
            ACTUALIZAR_MODELO: ActionTypes.ACTUALIZAR_MODELO.value,
        };
    }

    #ensureIsValidActionType(value) {
        if (!value) {
            throw new Error('The value cannot be null');
        }

        const validValues = [
            'asignar_asesor_en_curso',
            'asignar_lista_asesores',
            'asignar_grupo_en_curso',
            'asignar_lista_grupos',
            'asignar_grupo_por_codigo_externo',
            'asignar_usuario_por_codigo_externo',
            'asignar_grupo_por_codigo_externo_dinamico',
            'asignar_usuario_por_codigo_externo_dinamico',
            'envio_correo',
            'consumo_rest_flow',
            'actualizar_modelo',
        ];

        if (!validValues.includes(value)) {
            throw new Error(`The value must be a valid Type: ${value}`);
        }
    }
}

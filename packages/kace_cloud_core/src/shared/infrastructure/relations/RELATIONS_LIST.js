/**
 * @fileoverview Static list of logical relations between entities.
 * Each relation maps a logical join between two tables.
 * This list is used by the SharedContext services to expose
 * entity relationships without querying the database.
 */

const cases = [
    {
        entity: 'cases',
        relation: 'clients',
        alias: "case_clients",
        join_condition: {
            left: 'cases.cliente_id',
            operator: 'eq',
            right: 'clients.id'
        }
    },
    {
        entity: 'cases',
        relation: 'transiciones',
        alias: "case_transiciones",
        join_condition: {
            left: 'cases.transicion_id',
            operator: 'eq',
            right: 'transiciones.id'
        }
    },
    {
        entity: 'cases',
        relation: 'usuarios',
        alias: "case_responsable",
        join_condition: {
            left: 'cases.responsable_id',
            operator: 'eq',
            right: 'usuarios.id'
        }
    },
    {
        entity: 'cases',
        relation: 'clasificaciones',
        alias: "case_clasificaciones",
        join_condition: {
            left: 'cases.clasificacion_id',
            operator: 'eq',
            right: 'clasificaciones.id'
        }
    },
    {
        entity: 'cases',
        relation: 'descripciones_casos',
        alias: "case_descripciones_casos",
        join_condition: {
            left: 'cases.descripcion_caso_id',
            operator: 'eq',
            right: 'descripciones_casos.id'
        }
    },
    {
        entity: 'cases',
        relation: 'grupos',
        alias: "case_grupos",
        join_condition: {
            left: 'cases.grupo_id',
            operator: 'eq',
            right: 'grupos.id'
        }
    },
    {
        entity: 'cases',
        relation: 'usuarios',
        alias: "case_created_by",
        join_condition: {
            left: 'cases.created_by',
            operator: 'eq',
            right: 'usuarios.id'
        }
    },
    {
        entity: 'cases',
        relation: 'usuarios',
        alias: "case_updated_by",
        join_condition: {
            left: 'cases.updated_by',
            operator: 'eq',
            right: 'usuarios.id'
        }
    },
    {
        entity: 'cases',
        relation: 'usuarios',
        alias: "case_cloned_by",
        join_condition: {
            left: 'cases.cloned_by',
            operator: 'eq',
            right: 'usuarios.id'
        }
    },
    {
        entity: 'cases',
        relation: 'usuarios',
        alias: "case_reopen_by",
        join_condition: {
            left: 'cases.reopen_by',
            operator: 'eq',
            right: 'usuarios.id'
        }
    },
    {
        entity: 'cases',
        relation: 'usuarios',
        alias: "case_closed_by",
        join_condition: {
            left: 'cases.closed_by',
            operator: 'eq',
            right: 'usuarios.id'
        }
    },
    {
        entity: 'cases',
        relation: 'aux_cases',
        alias: "case_auxiliar",
        join_condition: {
            left: 'cases.id',
            operator: 'eq',
            right: 'aux_cases.caso_id'
        }
    }
];
const clients = [
    {
        entity: 'clients',
        relation: 'aux_clients',
        alias: "clients_auxiliar",
        join_condition: {
            left: 'clients.id',
            operator: 'eq',
            right: 'aux_clients.cliente_id'
        }
    },
    {
        entity: 'clients',
        relation: 'usuarios',
        alias: "clients_created_by",
        join_condition: {
            left: 'clients.created_by',
            operator: 'eq',
            right: 'usuarios.id'
        }
    },
    {
        entity: 'clients',
        relation: 'usuarios',
        alias: "clients_updated_by",
        join_condition: {
            left: 'clients.updated_by',
            operator: 'eq',
            right: 'usuarios.id'
        }
    }
];
const classifications = [
    {
        entity: 'clasificaciones',
        relation: 'flujos',
        alias: "clasificacion_flow",
        join_condition: {
            left: 'clasificaciones.flujo_id',
            operator: 'eq',
            right: 'flujos.id'
        }
    },
    {
        entity: 'clasificaciones',
        relation: 'ans',
        alias: "clasificacion_ans",
        join_condition: {
            left: 'clasificaciones.ans_id',
            operator: 'eq',
            right: 'ans.id'
        }
    },
    {
        entity: 'clasificaciones',
        relation: 'grupos',
        alias: "clasificacion_default_group",
        join_condition: {
            left: 'clasificaciones.default_group_id',
            operator: 'eq',
            right: 'grupos.id'
        }
    },
    {
        entity: 'clasificaciones',
        relation: 'cases',
        alias: "clasificacion_cases",
        join_condition: {
            left: 'cases.clasificacion_id',
            operator: 'eq',
            right: 'clasificaciones.id'
        }
    }
]
const transitions = [
    {
        entity: 'transiciones',
        relation: 'estados',
        alias: "transition_current_state",
        join_condition: {
            left: 'transiciones.estado_actual_id',
            operator: 'eq',
            right: 'estados.id'
        }
    },
    {
        entity: 'transiciones',
        relation: 'estados',
        alias: "transition_next_state",
        join_condition: {
            left: 'transiciones.siguiente_estado_id',
            operator: 'eq',
            right: 'estados.id'
        }
    },
    {
        entity: 'transiciones',
        relation: 'flujos',
        alias: "transition_flow",
        join_condition: {
            left: 'transiciones.flujo_id',
            operator: 'eq',
            right: 'flujos.id'
        }
    },
    {
        entity: 'transiciones',
        relation: 'ans',
        alias: "transition_ans",
        join_condition: {
            left: 'transiciones.flujo_id',
            operator: 'eq',
            right: 'ans.id'
        }
    }
];


export const RELATIONS_LIST = [
    ...cases,
    ...clients,
    ...classifications,
    ...transitions,
];

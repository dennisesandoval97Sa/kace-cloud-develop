export const ENTITY_STATE = "transition_next_state";
export const FIELD_STATE = "nombre";
export const FIELD_COLOR = "color";

export const BOARD_COLUMN_RULES = {
    HIDE_IF_EXISTS: [
        {
            target: { field: FIELD_COLOR, entity: ENTITY_STATE },
            dependsOn: { field: FIELD_STATE, entity: ENTITY_STATE },
        },
    ],
};

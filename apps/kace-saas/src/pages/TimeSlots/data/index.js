import { Uuid } from "@kace/plugins";
import { removeKey } from "@kace/utils";

export const formatDataBeforePost = (data, id) => {
    return id
        ? removeKey(data, [
            "id",
            "created_at",
            "created_by",
            "updated_at",
            "deleted_by",
            "deleted_at",
        ])
        : removeKey({ ...data, id: Uuid() }, ["updated_by"]);
};
export const initialValues = {
    description: "",
    start_time: "",
    end_time: "",
    max_appointments: "",
    agenda_id: "",
    updated_by: "",
    created_by: "",
    is_active: true,
};

export const DefaultColumEnum = {
    DESCRIPTION: {
        column_name: "description",
        data_type: "String",
        character_maximum_length: 36,
        relation: null,
        label: "Description",
    },
    START_TIME: {
        column_name: "start_time",
        data_type: "String",
        character_maximum_length: 36,
        relation: null,
        label: "Start time",
    },
    END_TIME: {
        column_name: "end_time",
        data_type: "String",
        character_maximum_length: 36,
        relation: null,
        label: "End time",
    },
    MAX_APPOINTMENTS: {
        column_name: "max_appointments",
        data_type: "String",
        character_maximum_length: 36,
        relation: null,
        label: "Max appointments",
    },
    IS_ACTIVE: {
        column_name: "is_active",
        data_type: "String",
        character_maximum_length: 36,
        relation: null,
        label: "Status",
    },
};

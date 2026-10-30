import { Uuid } from "@kace/plugins";
import { removeKey } from "@kace/utils";

export const formatDataBeforePost = (data, id) => {
    return id
        ? removeKey(data, [
            "id",
            "created_by",
            "created_at",
            "updated_at",
            "deleted_by",
            "deleted_at",
            "updated_by",
            "groups",
        ])
        : removeKey({ ...data, id: Uuid() }, [
            "updated_by",
            "groups",
        ]);
};

export const getInitialValues = (one_script_id = "") => {
    return {
        description: "",
        daily_limit: "",
        updated_by: "",
        created_by: "",
        is_active: true,
        one_script_id,
        is_for_weekend: false,
        groups: [],
    };
};

export const DefaultColumEnum = {
    DESCRIPTION: {
        column_name: "description",
        data_type: "String",
        character_maximum_length: 36,
        relation: null,
        label: "Description",
    },
    DAYLI_LIMIT: {
        column_name: "daily_limit",
        data_type: "String",
        character_maximum_length: 36,
        relation: null,
        label: "Daily limit",
    },
    IS_ACTIVE: {
        column_name: "is_active",
        data_type: "Boolean",
        character_maximum_length: null,
        relation: null,
        label: "Is active",
    },
    IS_FOR_WEEKEND: {
        column_name: "is_for_weekend",
        data_type: "Boolean",
        character_maximum_length: null,
        relation: null,
        label: "Is Weekend",
    },
};

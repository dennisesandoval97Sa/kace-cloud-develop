import { removeKey } from "@kace/utils";

export const formatDataBeforePost = (data, id) => {
    return removeKey(data, ["id", "created_at", "updated_at", "description", "created_by", "deleted_by", "deleted_at"]);
};
export const formatDataBeforePostAssingForm = (data, groups, id) => {
    return groups.map((group) => ({
        group_id: group.id,
        classification_id: id,
        form: data?.form || null,
    }));
};

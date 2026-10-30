import { formatDataBeforePost } from "../../../services/genericHandleSendInformation";
import { GROUP_SERVICE } from "../../../utils/URL";

const GROUP_FIELDS_TO_STRIP = [
    "expiredCases",
    "intermediateCases",
    "notExpiredCases",
    "filter_order",
    "comportamientos",
    "usuarios",
    "horario_description",
];

export const normalizeSelectedUserIds = (userIds = []) => {
    if (!Array.isArray(userIds)) return [];
    return [...new Set(userIds.filter(Boolean))];
};

export const buildGroupMutationData = (values, selectedUserIds = []) => {
    const id = values.id;
    const isCreate = !id;
    const dataPost = formatDataBeforePost(values, id, GROUP_FIELDS_TO_STRIP, {
        serverGeneratedId: isCreate,
    });

    if (isCreate) {
        dataPost.user_ids = normalizeSelectedUserIds(selectedUserIds);
    }

    return {
        id,
        url: id ? `${GROUP_SERVICE}/${id}` : GROUP_SERVICE,
        dataPost,
        isCreate,
    };
};

export const getGroupMembershipChanges = ({ isCreate, groupId, currentUsers = [], selectedUserIds = [] }) => {
    if (isCreate) {
        return { toAdd: [], toRemove: [] };
    }

    const selectedIds = normalizeSelectedUserIds(selectedUserIds);
    const currentUserIds = new Set(currentUsers.map((item) => item.usuario_id));
    const selectedUserIdSet = new Set(selectedIds);

    return {
        toAdd: selectedIds
            .filter((userId) => !currentUserIds.has(userId))
            .map((usuario_id) => ({ usuario_id, grupo_id: groupId })),
        toRemove: currentUsers
            .filter((item) => !selectedUserIdSet.has(item.usuario_id))
            .map(({ usuario_id, grupo_id }) => ({ usuario_id, grupo_id })),
    };
};

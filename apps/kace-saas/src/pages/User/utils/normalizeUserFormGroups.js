export const getSelectedGroupIds = (listValues = []) => listValues.map((item) => item.id).filter(Boolean);

export const shouldRequireGroups = (values = {}) => !values.id;

export const resolveActiveGroupForSelectedGroups = (activeGroup, groupIds = []) => {
    if (groupIds.length === 0) {
        return activeGroup;
    }

    return groupIds.some((groupId) => String(groupId) === String(activeGroup)) ? activeGroup : groupIds[0];
};

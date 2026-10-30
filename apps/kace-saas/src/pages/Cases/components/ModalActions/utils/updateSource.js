export const UPDATE_SOURCE = {
    MANUAL: "manual",
    BULK: "bulk",
};

export const getUpdateSource = (caseIds = []) => {
    const update_source = caseIds.length > 1 ? UPDATE_SOURCE.BULK : UPDATE_SOURCE.MANUAL;

    return update_source;
};

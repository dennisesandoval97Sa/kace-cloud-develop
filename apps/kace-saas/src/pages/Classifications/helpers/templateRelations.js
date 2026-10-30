export const buildAvailableTemplateIds = (seedIds = [], selectedTemplates = []) => [
    ...new Set([...seedIds.filter(Boolean), ...selectedTemplates.map(({ id }) => id).filter(Boolean)]),
];

export const getTemplateRelationChanges = ({
    persistedTemplateIds = [],
    selectedTemplates = [],
    availableTemplateIds = [],
}) => {
    const persistedIds = new Set(persistedTemplateIds);
    const selectedIds = new Set(selectedTemplates.map(({ id }) => id));
    const availableIds = new Set(availableTemplateIds);

    return {
        templateIdsToAdd: [...selectedIds].filter((id) => !persistedIds.has(id)),
        templateIdsToRemove: [...persistedIds].filter((id) => availableIds.has(id) && !selectedIds.has(id)),
    };
};

export const toTemplateRelationPayload = (classificationId, templateIds) =>
    templateIds.map((templateId) => ({
        classification_id: classificationId,
        template_id: templateId,
    }));

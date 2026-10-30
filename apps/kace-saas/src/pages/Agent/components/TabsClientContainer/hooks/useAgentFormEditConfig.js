import useConfigAgentData from "../../../../../hooks/useConfigAgentData";

const useAgentFormEditConfig = (clientId, isNew) => {
    const { clients } = useConfigAgentData();
    const fieldsEdit = clients?.fields_edit;

    const validateFieldsEdit = (fieldEdit = null) => {
        const field = fieldEdit ? `field_${fieldEdit}_edit` : null;
        if (isNew) {
            return false;
        }
        if (fieldsEdit) return Object.prototype.hasOwnProperty.call(fieldsEdit, field) && !fieldsEdit[field];
        return false;
    };

    return {
        validateFieldsEdit,
        clientId,
    };
};

export default useAgentFormEditConfig;

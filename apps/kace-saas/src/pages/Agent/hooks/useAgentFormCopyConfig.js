import { useCallback } from "react";
import { useSelector } from "react-redux";

const useAgentFormCopyConfig = () => {
    const { fields_copy: fieldsCopy } = useSelector(
        (state) => state.generalSetup?.configAgent?.clients,
    );

    const onlyCopyPaste = useCallback((e) => {
        const allowedKeys = [
            "ArrowLeft",
            "ArrowRight",
            "Tab",
            "Backspace",
            "Delete",
        ];
        const allowedCombos = ["c", "v", "a", "x", "z"];

        if (
            !(e.ctrlKey && allowedCombos.includes(e.key.toLowerCase())) &&
            !allowedKeys.includes(e.key)
        ) {
            e.preventDefault();
        }
    }, []);

    const validateFieldsCopyPaste = (fieldCopy = null) => {
        if (!fieldsCopy) return null;
        const field = fieldCopy ? `field_${fieldCopy}_copy` : null;
        if (field && Object.hasOwn(fieldsCopy, field) && fieldsCopy[field]) return onlyCopyPaste;
        return null;
    };

    return {
        validateFieldsCopyPaste,
    };
};

export default useAgentFormCopyConfig;

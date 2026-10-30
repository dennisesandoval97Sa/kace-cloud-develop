import { useSelector } from "react-redux";
import Joi from "joi";
import { charLimitKey } from "@kace/core/src/global-config/domain/settings/clientFieldCharLimits.js";

const applyModifiers = (schema, min, max, isRequired) => {
    if (typeof schema?.min === "function" && !isNaN(min) && Number(min) > 0) {
        schema = schema.min(Number(min));
    }
    if (typeof schema?.max === "function" && !isNaN(max) && Number(max) > 0) {
        schema = schema.max(Number(max));
    }
    if (isRequired && typeof schema.required === "function") {
        schema = schema.required();
    }
    return schema;
};

const useAgentFormConfig = (baseSchema) => {
    const { fields_required: fieldsRequired = {}, fields_max_min: fieldsMaxMin = {} } = useSelector(
        (state) => state.generalSetup?.configAgent?.clients || {},
    );
    const clientSchemaForm = {};

    for (const [key, originalSchema] of Object.entries(baseSchema)) {
        const fieldKey = `field_${key}`;
        const requiredFlag = fieldsRequired?.[`${fieldKey}_required`] || false;
        const min = fieldsMaxMin?.[charLimitKey(key, "min")] || undefined;
        const max = fieldsMaxMin?.[charLimitKey(key, "max")] || undefined;

        let schema = originalSchema;

        if (schema.type === "alternatives" && schema.$_terms.matches?.length) {
            const [conditional] = schema.$_terms.matches;

            if (conditional.ref && conditional.then && conditional.otherwise) {
                const then = applyModifiers(conditional.then, min, max, requiredFlag);
                const otherwise = applyModifiers(conditional.otherwise, min, max, requiredFlag);

                schema = Joi.alternatives().conditional(conditional.ref.key, {
                    is: conditional.is,
                    then,
                    otherwise,
                });
            }
        } else {
            schema = applyModifiers(schema, min, max, requiredFlag);
        }

        clientSchemaForm[key] = schema;
    }

    return { clientSchemaForm: Joi.object(clientSchemaForm) };
};

export default useAgentFormConfig;

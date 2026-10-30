import Joi from "joi";
import { ActionUpdateModelAggregates } from "../enums/ActionUpdateModelAggregates.js";
import { ActionUpdateModelFormulas } from "../enums/ActionUpdateModelFormulas.js";
import { ActionUpdateModelTypes } from "../enums/ActionUpdateModelTypes.js";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

const base = {
    description: JoiHelper.freeText(),
    aggregate: Joi.string().valid(...Object.values(ActionUpdateModelAggregates.toJson())),
    field: JoiHelper.legacyText({ max: 100 }),
    type: Joi.string().valid(...Object.values(ActionUpdateModelTypes.toJson())),
    formula: Joi.when("type", {
        is: ActionUpdateModelTypes.FORMULA.value,
        then: Joi.string().valid(...Object.values(ActionUpdateModelFormulas.toJson())),
        otherwise: Joi.string().optional().allow(null, ""),
    }),
    value: Joi.string()
        .max(100)
        .when("type", {
            is: Joi.exist(),
            then: Joi.when("type", {
                is: Joi.not(ActionUpdateModelTypes.FORMULA.value),
                then: Joi.required(),
                otherwise: Joi.when("formula", {
                    is: ActionUpdateModelFormulas.MODELO_A_MODELO.value,
                    then: Joi.required(),
                    otherwise: Joi.optional().allow(null),
                }),
            }),
            otherwise: Joi.optional(),
        }),
    aggregate_aux: Joi.string().valid(...Object.values(ActionUpdateModelAggregates.toJson())),
    field_aux: Joi.when("formula", {
        is: ActionUpdateModelFormulas.MODELO_A_MODELO.value,
        then: Joi.string(),
        otherwise: Joi.string().optional().allow(null, ""),
    }),
};

const requiredFields = {
    description: base.description.required(),
    aggregate: base.aggregate.required(),
    field: base.field.required(),
    type: base.type.required(),
};

export const ActionUpdateModelSchemaForm = Joi.object({ ...base, ...requiredFields }).strict();
export const ActionUpdateModelCreateSchema = Joi.object({ ...base, ...requiredFields, id: JoiHelper.uuid().required() }).strict();
export const ActionUpdateModelUpdateSchema = Joi.object({ ...base }).strict();

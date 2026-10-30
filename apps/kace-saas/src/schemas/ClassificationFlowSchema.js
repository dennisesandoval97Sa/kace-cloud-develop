import Joi from "joi";

export const ClassificationFlowSchema = Joi.object({
    id: Joi.any(),
    json_flujo: Joi.any().optional(),
});
import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

export const FlowCreateSchemaForm = Joi.object({
    id: JoiHelper.uuid(),
    nombre: JoiHelper.onlyLetters({ min: 1, max: 100 }).required(),
    json_flujo: Joi.object({
        nodes: Joi.array().required(),
        edges: Joi.array().required(),
    }).required(),
    status: JoiHelper.integer(),
}).strict();

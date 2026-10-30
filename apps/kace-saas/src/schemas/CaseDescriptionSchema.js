import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

const base = {
    descripcion: JoiHelper.freeText().required(),
};

export const createCaseDescriptionSchema = Joi.object({
    id: JoiHelper.uuid().required(),
    ...base,
}).strict();

export const updateCaseDescriptionSchema = Joi.object({
    ...base,
}).strict();

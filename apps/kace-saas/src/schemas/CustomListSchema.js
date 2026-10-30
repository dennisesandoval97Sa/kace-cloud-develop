import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

const auxItem = Joi.object({
    literal: Joi.string().required(),
    order: Joi.number().integer().min(1).required(),
});

export const CustomListCreateSchema = Joi.object({
    name: JoiHelper.legacyText({ min: 3, max: 255 }).required(),
    is_active: Joi.boolean().required(),
    aux_entity: JoiHelper.legacyText({ min: 3, max: 128 }).required(),
    aux_items: Joi.array().items(auxItem).required(),
    groups: Joi.array().items(Joi.string().uuid()),
});

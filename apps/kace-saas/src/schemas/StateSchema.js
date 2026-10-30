import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";
import {
    SHARED_VISUAL_COLOR_ALLOWLIST,
    SHARED_VISUAL_ICON_ALLOWLIST,
} from "@kace/core/src/shared/visual-options/sharedVisualOptions.js";

export const StateSchemaForm = Joi.object({
    nombre: JoiHelper.onlyLetters({ min: 3, max: 50 }).required(),
    descripcion: JoiHelper.description({ min: 1, max: 1000 }).required(),
    icon_class: JoiHelper.legacyText({ min: 1, max: 1000 })
        .valid(...SHARED_VISUAL_ICON_ALLOWLIST)
        .required(),
    status: JoiHelper.integer(),
    color: JoiHelper.color()
        .valid(...SHARED_VISUAL_COLOR_ALLOWLIST)
        .required(),
    require_observation: JoiHelper.boolean(),
}).strict();

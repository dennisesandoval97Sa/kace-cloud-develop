import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";
import { SHARED_VISUAL_COLOR_ALLOWLIST } from "@kace/core/src/shared/visual-options/sharedVisualOptions.js";

const visuallyEmptyRichText = Joi.string().custom((value, helpers) => {
    if (/<img\b[^>]*>/i.test(value)) {
        return helpers.error("any.invalid");
    }

    const visibleText = value
        .replace(/<[^>]*>/g, "")
        .replace(/&(?:nbsp|#160|#xA0);/gi, "")
        .replace(/[\s\u00A0\u200B-\u200D\u2060\uFEFF]/g, "");

    return visibleText.length === 0 ? value : helpers.error("any.invalid");
});

export const HelpsSchemaForm = Joi.object({
    titulo: JoiHelper.onlyLetters({ min: 5, max: 50 }).required(),
    descripcion: JoiHelper.htmlText({ min: 10, max: 30000 }).empty(visuallyEmptyRichText).required(),
    color: JoiHelper.color()
        .valid(...SHARED_VISUAL_COLOR_ALLOWLIST)
        .required(),
    is_active: JoiHelper.boolean(),
}).strict();

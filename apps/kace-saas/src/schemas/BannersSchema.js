import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";
import {
    SHARED_VISUAL_COLOR_ALLOWLIST,
    SHARED_VISUAL_ICON_ALLOWLIST,
} from "@kace/core/src/shared/visual-options/sharedVisualOptions.js";

const statusSchema = JoiHelper.integer().valid(1, 2).required();

export const BannerCreateSchemaForm = Joi.object({
    id: JoiHelper.uuid(),
    descripcion: JoiHelper.legacyText({ min: 3, max: 5000 }).required(),
    propiedades: Joi.object({
        position: JoiHelper.generalText().required(),
        icon: JoiHelper.generalText({ max: 100 })
            .valid(...SHARED_VISUAL_ICON_ALLOWLIST)
            .required(),
        color: JoiHelper.color()
            .valid(...SHARED_VISUAL_COLOR_ALLOWLIST)
            .required(),
        siteToShow: JoiHelper.generalText().required(),
    }).required(),
    especificaciones: Joi.object({
        users: Joi.array().items(JoiHelper.uuid()).allow(null),
        groups: Joi.array().items(JoiHelper.uuid()).allow(null),
        clients: Joi.array().items(JoiHelper.uuid()).allow(null),
    }).required(),
    fecha_inicio: JoiHelper.date().required(),
    fecha_fin: JoiHelper.date().required().greater(Joi.ref("fecha_inicio")).messages({
        "date.greater": "La fecha de fin debe ser mayor que la fecha de inicio",
    }),
    status: statusSchema,
}).strict();

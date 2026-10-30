import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

const validateDateRange = (value, helpers) => {
    if (value?.fecha_inicio > value?.fecha_fin) {
        return helpers.message("La fecha de inicio no puede ser mayor que la fecha de fin");
    }
    return value;
};

export const UserNotificationCreateSchema = Joi.object({
    asunto: JoiHelper.legacyText({ max: 25 }).required(),
    mensaje: JoiHelper.legacyText({ max: 1000 }).required(),
    fecha_inicio: JoiHelper.date({ iso: true }).required().strict(false),
    fecha_fin: JoiHelper.date({ iso: true }).required().strict(false),
    leida: JoiHelper.boolean(),
    leida_por: JoiHelper.uuid().allow(null),
    user_id: JoiHelper.uuid(),
    is_active: JoiHelper.boolean(),
})
    .custom(validateDateRange, "Date range validation")
    .strict();

import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

export const UserFormSchema = Joi.object({
    newUser: JoiHelper.integer(),
    account_type: JoiHelper.legacyText({ min: 1, max: 1 }).valid("1", "2").required(),
    login: JoiHelper.generalText({ min: 1, max: 100 }).required(),
    is_active: JoiHelper.integer().max(2),
    nombres: JoiHelper.description({ min: 1, max: 100 }).required().allow(null),
    apellido1: JoiHelper.description({ min: 1, max: 100 }).required().allow(null),
    apellido2: JoiHelper.description({ min: 1, max: 100 }).allow(""),
    email: JoiHelper.email().required(),
    password: Joi.when("account_type", {
        is: Joi.valid("1", 1),
        then: Joi.string().allow("", null).max(100).optional(),
        otherwise: Joi.when("newUser", {
            is: 1,
            then: Joi.string().max(100).min(1).required(),
            otherwise: Joi.string().max(100).min(1).allow(""),
        }),
    }),
    rol_id: JoiHelper.uuid().required(),
    external_id: JoiHelper.generalText({ max: 45 }).allow("", null),
    telefono: JoiHelper.localPhone().allow(""),
    codigos_externos: Joi.object(),
    movil: JoiHelper.localPhone().allow(""),
}).strict();

import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

export const grupos = Joi.object({
    nombre: JoiHelper.onlyLetters({ min: 3, max: 100 }),
    descripcion: JoiHelper.description({ min: 3, max: 100 }).allow(null),
    created_at: Joi.string(),
    updated_at: Joi.string(),
    created_by: JoiHelper.uuid(),
});

export const usuarios = Joi.object({
    login: JoiHelper.generalText({ min: 1, max: 100 }),
    nombres: JoiHelper.description({ min: 1, max: 100 }).allow(null),
    apellido1: JoiHelper.description({ min: 1, max: 100 }).allow(null),
    apellido2: JoiHelper.description({ min: 1, max: 100 }).allow(""),
    email: JoiHelper.email(),
    telefono: JoiHelper.localPhone().allow(""),
    created_at: Joi.string(),
    updated_at: Joi.string(),
    created_by: JoiHelper.uuid(),
});

export const clasificaciones = Joi.object({
    nivel1: JoiHelper.legacyText({ max: 100 }),
    nivel2: JoiHelper.legacyText({ max: 100 }).allow(""),
    nivel3: JoiHelper.legacyText({ max: 100 }).allow(""),
    nivel4: JoiHelper.legacyText({ max: 100 }).allow(""),
    nivel5: JoiHelper.legacyText({ max: 100 }).allow(""),
    nivel6: JoiHelper.legacyText({ max: 100 }).allow(""),
    nivel7: JoiHelper.legacyText({ max: 100 }).allow(""),
    nivel8: JoiHelper.legacyText({ max: 100 }).allow(""),
    nivel9: JoiHelper.legacyText({ max: 100 }).allow(""),
    nivel10: JoiHelper.legacyText({ max: 100 }).allow(""),
    created_at: Joi.string(),
    updated_at: Joi.string(),
    created_by: JoiHelper.uuid(),
});

export const exportSchema = {
    usuarios,
    grupos,
    clasificaciones,
};

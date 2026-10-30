import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

export const GroupSchemaForm = Joi.object({
    id: JoiHelper.uuid(),
    nombre: JoiHelper.onlyLetters({ min: 3, max: 100 }).required(),
    horario_id: JoiHelper.uuid().required(),
    descripcion: JoiHelper.description({ min: 3, max: 100 }).required().allow(null),
    codigo_externo: JoiHelper.legacyText({ min: 1, max: 20 }).allow(null),
    codigos_externos: Joi.object().allow(null),
    permisos: Joi.object().allow(null),
    layouts: Joi.object().allow(null),
    comportamientos: Joi.object().allow(null),
    filter_order: JoiHelper.legacyText({ min: 3, max: 10000 }).allow(null),
    status: JoiHelper.integer(),
    configuration_id: JoiHelper.uuid().required(),
}).strict();

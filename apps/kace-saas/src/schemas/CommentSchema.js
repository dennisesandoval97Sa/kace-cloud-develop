import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

export const CommentsCreateSchema = Joi.object({
    id: JoiHelper.uuid(),
    descripcion: JoiHelper.htmlText({ min: 3, max: 5000 }).required(),
    calificacion: JoiHelper.integer({ min: 1, max: 10 }).allow(null),
    caso_id: JoiHelper.uuid().allow(null),
}).strict();

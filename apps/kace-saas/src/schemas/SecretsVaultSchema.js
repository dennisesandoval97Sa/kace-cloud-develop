import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

export const SecretsVaultCreateSchemaForm = Joi.object({
    descripcion: JoiHelper.description({ min: 3, max: 255 }).required().allow(null),
    referencia: JoiHelper.constantCase().required(),
    secreto: Joi.string().min(1).max(255).required(),
}).strict();

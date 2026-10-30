import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

const baseSchema = {
    description: JoiHelper.legacyText({ min: 3 }).required(),
    type: Joi.string().required(),
    config: Joi.object(),
};

export const GlobalRulesSchema = Joi.object({
    asignacion: Joi.string(),
    agentesCasosEditarEstadoSinResponsabilidad: JoiHelper.boolean(),
    wizardV2: JoiHelper.boolean(),
    verColumnasAux: JoiHelper.boolean(),
    useInteractions: JoiHelper.boolean(),
    cantidadUsuarios: JoiHelper.integer(),
    canReopenCases: JoiHelper.boolean(),
    daysAllowed: JoiHelper.integer(),
    conditionReOpenCase: JoiHelper.legacyText(),
    parametrizarColumnas: JoiHelper.boolean(),
    envioListaDistribucion: JoiHelper.boolean(),
    agentesCasosDescripcion: JoiHelper.boolean(),
    agentesCasosEditarDocumento: JoiHelper.boolean(),
}).strict();

export const GlobalConfigCreateSchema = Joi.object({
    id: JoiHelper.uuid(),
    ...baseSchema,
}).strict();

export const GlobalConfigUpdateSchema = Joi.object({ ...baseSchema }).strict();

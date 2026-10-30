import Joi from "joi";

const baseSchema = {
    description: Joi.string().required().min(3),
    type: Joi.string().required(),
    config: Joi.object(),
};

export const GlobalRulesSchema = Joi.object({
    asignacion: Joi.string(),
    agentesCasosEditarEstadoSinResponsabilidad: Joi.boolean(),
    wizardV2: Joi.boolean(),
    verColumnasAux: Joi.boolean(),
    useInteractions: Joi.boolean(),
    cantidadUsuarios: Joi.number(),
    canReopenCases: Joi.boolean(),
    daysAllowed: Joi.number(),
    conditionReOpenCase: Joi.string(),
    parametrizarColumnas: Joi.boolean(),
    envioListaDistribucion: Joi.boolean(),
    agentesCasosDescripcion: Joi.boolean(),
    agentesCasosEditarDocumento: Joi.boolean(),
});
export const GlobalConfigCreateSchema = Joi.object({
    id: Joi.string().uuid(),
    ...baseSchema,
});
export const GlobalConfigUpdateSchema = Joi.object({ ...baseSchema });

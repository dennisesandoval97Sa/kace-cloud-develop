import Joi from "joi"

const uuidRule = Joi.string().uuid()
const tipoRule = Joi.number().integer()
const descripcionRule = Joi.string().max(100)
const destinatarioRule = Joi.string().max(100000)
const copiaRule = Joi.string().max(100000).allow(null, "")
const asuntoRule = Joi.string().max(1000)
const cuerpoRule = Joi.string().max(100000)
const rutaRule = Joi.string().max(1000).allow(null, "")
const incluyeAdjuntosRule = Joi.boolean()
const enviarAdjuntosDelCasoRule = Joi.boolean()
const statusRule = Joi.number().integer()
const timestampRule = Joi.date()
const createdByRule = uuidRule

export const TemplatesCreateSchema = Joi.object({
    id: uuidRule,
    tipo: tipoRule.required(),
    descripcion: descripcionRule.required(),
    destinatario: destinatarioRule.required(),
    copia: copiaRule,
    copia_oculta: copiaRule,
    asunto: asuntoRule.required(),
    cuerpo: cuerpoRule.required(),
    ruta: rutaRule,
    incluye_adjuntos: incluyeAdjuntosRule,
    enviar_adjuntos_del_caso: enviarAdjuntosDelCasoRule,
    status: statusRule.required(),
    created_at: timestampRule.required(),
    created_by: createdByRule.required()
})

export const TemplatesUpdateSchema = Joi.object({
    id: uuidRule,
    tipo: tipoRule,
    descripcion: descripcionRule,
    destinatario: destinatarioRule,
    copia: copiaRule,
    copia_oculta: copiaRule,
    asunto: asuntoRule,
    cuerpo: cuerpoRule,
    ruta: rutaRule,
    incluye_adjuntos: incluyeAdjuntosRule,
    enviar_adjuntos_del_caso: enviarAdjuntosDelCasoRule,
    status: statusRule,
    updated_at: timestampRule.required(),
    updated_by: createdByRule.required()
})

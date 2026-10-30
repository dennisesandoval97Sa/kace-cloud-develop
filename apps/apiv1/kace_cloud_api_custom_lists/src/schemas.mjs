import Joi from "joi"


const auxItem = Joi.object({
  literal: Joi.string().min(1).max(255).required(),
  order: Joi.number().integer().min(1).required()
});

export const schemaCreate = Joi.object({
  id: Joi.string().uuid().required(),
  name: Joi.string().min(1).max(255).required(),
  is_active: Joi.boolean().required(),
  aux_entity: Joi.string().min(1).max(128).required(),
  aux_items: Joi.array()
    .items(auxItem)
    .unique((a, b) => a.literal === b.literal)
    .required(),
  groups: Joi.array().items(
    Joi.string().uuid()
  ),

  created_at: Joi.date().timestamp().allow(null),
  created_by: Joi.string().uuid().required()
});


export const schemaUpdate = Joi.object({
  name: Joi.string().min(1).max(255),
  is_active: Joi.boolean(),
  aux_entity: Joi.string().min(1).max(128),
  aux_items: Joi.array()
    .items(auxItem)
    .unique((a, b) => a.literal === b.literal),
  groups: Joi.array()
    .items(Joi.string().uuid())
    .unique(),
  updated_at: Joi.date().iso().optional(),
  updated_by: Joi.string().uuid().required()
})
import { ValueObjectUuid } from '@kace/core/src/shared/index.js';
import Joi from 'joi';

const CLIENT_TYPE_HUMAN = 'Natural';
const CLIENT_TYPE_COMPANY = 'Comercial';

export const TYPE_DOCUMENT = Object.freeze({
    NIT: 'NIT',
    CC: 'CC',
});

const NamesValidations = {
    is: CLIENT_TYPE_HUMAN,
    then: Joi.string().max(300),
    otherwise: Joi.allow(null, ''),
};
export const ClientCreateSchema = Joi.object({
    id: Joi.string()
        .uuid()
        .default(() => ValueObjectUuid.random()),
    /*
     * SONAR-EXC: Se deja el TODO ya que es deuda tecnica que se resolverá a futuro
     * TODO: validar contra literales. Se debe definir en la configuracion
     */
    tipo_cliente: Joi.string().valid(CLIENT_TYPE_HUMAN, CLIENT_TYPE_COMPANY).required(),
    // SONAR-EXC: Se deja el TODO ya que es deuda tecnica que se resolverá a futuro
    tipo_documento: Joi.string().required().max(45), // TODO: ampliar 45 caracteres, validar contra literales
    // SONAR-EXC: Se deja el TODO ya que es deuda tecnica que se resolverá a futuro
    documento: Joi.string().required().max(45), // TODO: ampliar 45 caracteres
    nombres: Joi.alternatives().conditional('tipo_cliente', NamesValidations),
    apellido1: Joi.string().allow(null, '').max(100),
    apellido2: Joi.string().allow(null, '').max(100),
    nombre_empresa: Joi.alternatives().conditional('tipo_cliente', {
        // SONAR-EXC: Se deja el TODO ya que es deuda tecnica que se resolverá a futuro
        is: 'Comercial', // TODO: validar contra literales. Se debe definir en la configuracion
        then: Joi.string().required().max(100),
        otherwise: Joi.string().allow(null, '').max(100),
    }),
    // SONAR-EXC: Se deja el TODO ya que es deuda tecnica que se resolverá a futuro
    sexo: Joi.string().allow(null, '').max(15), // TODO: validar contra literales
    // SONAR-EXC: Se deja el TODO ya que es deuda tecnica que se resolverá a futuro
    estado_civil: Joi.string().allow(null, '').max(15), // TODO: validar contra literales
    fecha_nacimiento: Joi.alternatives().conditional('tipo_cliente', {
        // SONAR-EXC: Se deja el TODO ya que es deuda tecnica que se resolverá a futuro
        is: 'Natural', // TODO: validar contra literales. Se debe definir en la configuracion
        then: Joi.date(),
        otherwise: Joi.date().allow(null, '').optional(),
    }),
    email: Joi.string()
        .email({ tlds: { allow: false } })
        .allow(null, ''),
    email_alterno: Joi.string()
        .email({ tlds: { allow: false } })
        .allow(null, ''),
    telefono: Joi.string().allow(null, '').max(15),
    telefono_alterno: Joi.string().allow(null, '').max(15),
    campos_extra1: Joi.string().allow(null, '').max(100),
    campos_extra2: Joi.string().allow(null, '').max(100),
    campos_extra3: Joi.string().allow(null, '').max(100),
    // SONAR-EXC: Se deja el TODO ya que es deuda tecnica que se resolverá a futuro
    status: Joi.number().integer().max(10), // TODO: cambiar por "is_active" (bool)
    // SONAR-EXC: Se deja el TODO ya que es deuda tecnica que se resolverá a futuro
    padre_id: Joi.string().uuid().allow(null, ''), // TODO: cambiar por "client_parent_id"
    // SONAR-EXC: Se deja el TODO ya que es deuda tecnica que se resolverá a futuro
    habeas_data: Joi.string().max(10), // TODO: validar contra enum
    contactos: Joi.array().items(Joi.string().uuid()).when('tipo_documento', {
        // SONAR-EXC: Se deja el TODO ya que es deuda tecnica que se resolverá a futuro
        is: TYPE_DOCUMENT.NIT, // TODO: Validacion dinamica. ¿validar contra literales?  ¿tipo de cliente es mas adecuado?
        then: Joi.required(),
        otherwise: Joi.optional(),
    }),
    created_at: Joi.date().timestamp().optional(),
    created_by: Joi.string().uuid().optional(),
});

export const ClientUpdateSchema = Joi.object({
    nombre_empresa: Joi.alternatives().conditional('tipo_cliente', {
        // SONAR-EXC: Se deja el TODO ya que es deuda tecnica que se resolverá a futuro
        is: 'Comercial', // TODO: validar contra literales. Se debe definir en la configuracion
        then: Joi.string().required().max(100),
        otherwise: Joi.string().allow(null, '').max(100),
    }),
    // SONAR-EXC: Se deja el TODO ya que es deuda tecnica que se resolverá a futuro
    tipo_documento: Joi.string().required().max(45), // TODO: ampliar 45 caracteres, validar contra literales
    tipo_cliente: Joi.string().valid('Natural', 'Comercial').required(),
    documento: Joi.string().max(45).min(1),
    nombres: Joi.string().allow(null, '').max(300),
    apellido1: Joi.string().allow(null, '').max(100),
    apellido2: Joi.string().allow(null, '').max(100),
    sexo: Joi.string().allow(null, '').max(15),
    estado_civil: Joi.string().allow(null, '').max(15),
    fecha_nacimiento: Joi.date().allow(null),
    email: Joi.string()
        .email({ tlds: { allow: false } })
        .allow(null, ''),
    email_alterno: Joi.string()
        .email({ tlds: { allow: false } })
        .allow(null, ''),
    telefono: Joi.string().allow(null, '').max(15),
    telefono_alterno: Joi.string().allow(null, '').max(15),
    campos_extra1: Joi.string().allow(null, '').max(100),
    campos_extra2: Joi.string().allow(null, '').max(100),
    campos_extra3: Joi.string().allow(null, '').max(100),
    status: Joi.number().integer().max(10).min(1),
    habeas_data: Joi.string().max(10).min(1),
    padre_id: Joi.string().uuid().allow(null, ''),
    updated_at: Joi.date().optional(),
    updated_by: Joi.string().uuid().optional(),
});

export const ParentUpdateSchema = () =>
    Joi.object({
        padre_id: Joi.string().uuid(),
        habeas_data: Joi.string().max(10).min(1),
    });

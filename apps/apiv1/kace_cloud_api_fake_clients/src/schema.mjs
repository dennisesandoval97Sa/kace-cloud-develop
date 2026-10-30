import Joi from 'joi';

const CLIENT_TYPE_HUMAN = 'Natural';
const CLIENT_TYPE_COMPANY = 'Comercial';

export const TYPE_DOCUMENT = Object.freeze({
    NIT: 'NIT',
    CC: 'CC',
});

const NamesValidations = {
    is: CLIENT_TYPE_HUMAN,
    then: Joi.string().max(100).allow(null, ''),
    otherwise: Joi.allow(null, ''),
};
export const ClientCreateSchema = Joi.object({
    id: Joi.string().uuid(),
    tipo_cliente: Joi.string().valid(CLIENT_TYPE_HUMAN, CLIENT_TYPE_COMPANY),
    tipo_documento: Joi.string().max(45).allow(null, ''),
    documento: Joi.string().max(45).allow(null, ''),
    nombres: Joi.alternatives().conditional('tipo_cliente', NamesValidations),
    apellido1: Joi.string().max(100).allow(null, ''),
    apellido2: Joi.string().max(100).allow(null, ''),
    nombre_empresa: Joi.alternatives().conditional('tipo_cliente', {
        is: 'Comercial',
        then: Joi.string().max(100).allow(null, ''),
        otherwise: Joi.string().max(100).allow(null, ''),
    }),
    sexo: Joi.string().max(15).allow(null, ''),
    estado_civil: Joi.string().max(15).allow(null, ''),
    fecha_nacimiento: Joi.alternatives().conditional('tipo_cliente', {
        is: 'Natural',
        then: Joi.date().allow(null, ''),
        otherwise: Joi.date().optional().allow(null, ''),
    }),
    email: Joi.string()
        .email({ tlds: { allow: false } })
        .allow(null, ''),
    email_alterno: Joi.string()
        .email({ tlds: { allow: false } })
        .allow(null, ''),
    telefono: Joi.string().max(15).allow(null, ''),
    telefono_alterno: Joi.string().max(15).allow(null, ''),
    campos_extra1: Joi.string().allow(null, '').max(100),
    campos_extra2: Joi.string().allow(null, '').max(100),
    campos_extra3: Joi.string().allow(null, '').max(100),
    status: Joi.number().integer().max(10).allow(null, ''),
    padre_id: Joi.string().uuid().allow(null, ''),
    habeas_data: Joi.string().max(10).allow(null, ''),
    contactos: Joi.array()
        .items(Joi.string().uuid())
        .when('tipo_documento', {
            is: TYPE_DOCUMENT.NIT,
            then: Joi.optional().allow(null, ''),
            otherwise: Joi.optional().allow(null, ''),
        }),
    created_at: Joi.date().timestamp().optional().allow(null, ''),
    created_by: Joi.string().uuid().optional().allow(null, ''),
});

export const ClientUpdateSchema = Joi.object({
    nombre_empresa: Joi.alternatives().conditional('tipo_cliente', {
        is: 'Comercial',
        then: Joi.string().optional().max(100).allow(null, ''),
        otherwise: Joi.string().max(100).allow(null, ''),
    }),
    tipo_documento: Joi.string().max(45).allow(null, ''),
    tipo_cliente: Joi.string().valid('Natural', 'Comercial').optional(),
    documento: Joi.string().max(45).allow(null, ''),
    nombres: Joi.string().max(100).allow(null, ''),
    apellido1: Joi.string().max(100).allow(null, ''),
    apellido2: Joi.string().max(100).allow(null, ''),
    sexo: Joi.string().max(15).allow(null, ''),
    estado_civil: Joi.string().max(15).allow(null, ''),
    fecha_nacimiento: Joi.date().allow(null, ''),
    email: Joi.string()
        .email({ tlds: { allow: false } })
        .allow(null, ''),
    email_alterno: Joi.string()
        .email({ tlds: { allow: false } })
        .allow(null, ''),
    telefono: Joi.string().max(15).allow(null, ''),
    telefono_alterno: Joi.string().max(15).allow(null, ''),
    campos_extra1: Joi.string().allow(null, '').max(100),
    campos_extra2: Joi.string().allow(null, '').max(100),
    campos_extra3: Joi.string().allow(null, '').max(100),
    status: Joi.number().integer().max(10).allow(null, ''),
    habeas_data: Joi.string().max(10).allow(null, ''),
    padre_id: Joi.string().uuid().allow(null, ''),
    updated_at: Joi.date().optional().allow(null, ''),
    updated_by: Joi.string().uuid().optional().allow(null, ''),
});

export const ParentUpdateSchema = () =>
    Joi.object({
        padre_id: Joi.string().uuid().allow(null, ''),
        habeas_data: Joi.string().max(10).allow(null, ''),
    });

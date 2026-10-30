import Joi from 'joi';
import DependencyHelper from './DependencyHelper.js';

const DECIMAL_NUMBER_REGEX = /^[+-]?\d+(\.\d+)?$/;
const NUMERIC_CONSTRAINTS = ['min', 'max', 'greater', 'less', 'precision', 'multiple'];

/**
 * Parsea un valor string a número si cumple estrictamente con el formato decimal con signo opcional y parte entera obligatoria.
 *
 * NOTA DE DISEÑO: No reconoce notación científica (ej. '1e3'), bases alternativas ('0x1A', '0b101', '0o17')
 * ni decimales sin parte entera (ej. '.5'). Estos valores se preservan como string sin convertir de forma intencional,
 * según la especificación y cobertura de pruebas del proyecto.
 *
 * @param {*} val - Valor a parsear.
 * @returns {number|*} - Número parseado si es válido y finito, o el valor original si no lo es.
 */
const parseNumber = (val) => {
    if (typeof val !== 'string') return val;
    const trimmed = val.trim();
    if (!DECIMAL_NUMBER_REGEX.test(trimmed)) return val;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : val;
};

const parseNumberList = (values) => [].concat(values).map(parseNumber);

/**
 * Aplica la restricción `valid` o `invalid` de Joi sobre un schema numérico,
 * filtrando previamente los valores que no son números finitos (strings no convertibles,
 * null, undefined, NaN, Infinity).
 *
 * Esto es equivalente al `applyListConstraint` de StringSchemaBuilder, adaptado al
 * contexto numérico: sólo los valores que parseNumber convirtió con éxito a `number`
 * finito se registran en Joi, evitando que restricciones incorrectas silencien la
 * validación o bloqueen valores equivocados.
 *
 * @param {import('joi').NumberSchema} schema - Schema Joi sobre el que se aplica la restricción.
 * @param {'valid'|'invalid'} method - Método Joi a invocar.
 * @param {Array<*>} values - Lista de valores raw del dto (pueden ser números, strings o mixtos).
 * @returns {import('joi').NumberSchema} Schema resultante (o el mismo si no hay valores válidos).
 */
const applyNumericListConstraint = (schema, method, values) => {
    const parsed = parseNumberList(values).filter((v) => typeof v === 'number' && Number.isFinite(v));
    if (parsed.length === 0) return schema;
    return schema[method](...parsed);
};

const isValidNumericConstraint = (constraint, value) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return false;
    if (constraint === 'multiple') return value > 0;
    if (constraint === 'precision') return Number.isInteger(value) && value >= 0;
    return true;
};

class NumberSchemaBuilder {
    static build(dto) {
        let schema = Joi.number();

        const safeApply = (fn, label) => {
            try {
                schema = fn(schema);
            } catch (e) {
                // SONAR-EXC: NODEJS No expone logs porque es server-side
                console.log(`NumberSchemaBuilder::build [${label}]`, dto, e);
            }
        };

        try {
            for (const constraint of NUMERIC_CONSTRAINTS) {
                const value = parseNumber(dto[constraint]);
                if (isValidNumericConstraint(constraint, value)) {
                    safeApply((s) => s[constraint](value), constraint);
                }
            }

            if (dto.integer) schema = schema.integer();
            if (dto.positive === true && dto.negative !== true) schema = schema.positive();
            if (dto.negative === true && dto.positive !== true) schema = schema.negative();
            if (dto.unsafe) schema = schema.unsafe();
            if (dto.port) schema = schema.port();

            if (dto.valid != null) safeApply((s) => applyNumericListConstraint(s, 'valid', dto.valid), 'valid');
            if (dto.invalid != null) safeApply((s) => applyNumericListConstraint(s, 'invalid', dto.invalid), 'invalid');
            if (dto.default !== undefined) safeApply((s) => s.default(parseNumber(dto.default)), 'default');
            if (dto.restflow_id) schema = Joi.string().uuid();
        } catch (e) {
            // SONAR-EXC: NODEJS No expone logs porque es server-side
            console.log(`NumberSchemaBuilder::build`, dto, e);
        }

        return DependencyHelper.applyConditionalRequired(schema, dto);
    }
}

export { parseNumber, parseNumberList };
export default NumberSchemaBuilder;

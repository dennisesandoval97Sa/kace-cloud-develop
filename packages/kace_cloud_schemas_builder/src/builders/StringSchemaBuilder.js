import Joi from 'joi';
import DependencyHelper from './DependencyHelper.js';
import { parseNumber } from './NumberSchemaBuilder.js';

const LENGTH_CONSTRAINTS = ['min', 'max', 'length'];
const STRING_FLAGS = ['alphanum', 'isoDate', 'base64', 'dataUri', 'trim', 'lowercase', 'uppercase'];
const ARG_CONSTRAINTS = ['ip', 'email', 'uri'];
const ALLOWED_REGEX_FLAGS = 'imsu';

const parseLengthConstraint = (val) => {
    const num = parseNumber(val);
    return typeof num === 'number' && Number.isInteger(num) && num >= 0 ? num : undefined;
};

const applyListConstraint = (schema, method, values) => {
    if (!values) return schema;
    const vals = Array.isArray(values) ? values.filter((v) => v !== undefined) : values;
    const hasValues = Array.isArray(vals) ? vals.length > 0 : vals !== undefined;
    if (!hasValues) return schema;
    return Array.isArray(vals) ? schema[method](...vals) : schema[method](vals);
};

class StringSchemaBuilder {
    static build(dto) {
        let schema = Joi.string();

        const safeApply = (fn, label) => {
            try {
                schema = fn(schema);
            } catch (e) {
                // SONAR-EXC: NODEJS No expone logs porque es server-side
                console.log(`StringSchemaBuilder::build [${label}]`, dto, e);
            }
        };

        try {
            // 1. Restricciones de longitud (min, max, length)
            for (const constraint of LENGTH_CONSTRAINTS) {
                if (dto[constraint] !== undefined) {
                    const limit = parseLengthConstraint(dto[constraint]);
                    if (limit !== undefined) {
                        safeApply((s) => s[constraint](limit), constraint);
                    }
                }
            }

            // 2. Modificadores booleanos (trim, lowercase, etc.)
            for (const flag of STRING_FLAGS) {
                if (dto[flag]) schema = schema[flag]();
            }

            // 3. Restricciones con argumento (ip, email, uri)
            for (const constraint of ARG_CONSTRAINTS) {
                if (dto[constraint]) {
                    safeApply((s) => s[constraint](dto[constraint]), constraint);
                }
            }

            // 4. Expresión regular
            if (dto.pattern?.regex) {
                safeApply((s) => {
                    const safeFlags = (dto.pattern.flags || '')
                        .split('')
                        .filter((flag) => ALLOWED_REGEX_FLAGS.includes(flag))
                        .join('');
                    const regex = new RegExp(dto.pattern.regex, safeFlags);
                    return s.pattern(regex, dto.pattern.name);
                }, 'pattern');
            }

            // 5. Reemplazos de regex
            if (dto.regexReplace) {
                safeApply((s) => {
                    let current = s;
                    dto.regexReplace.forEach(({ pattern, replacement }) => {
                        current = current.replace(new RegExp(pattern), replacement);
                    });
                    return current;
                }, 'regexReplace');
            }

            // 6. Listas valid e invalid
            if (dto.valid) safeApply((s) => applyListConstraint(s, 'valid', dto.valid), 'valid');
            if (dto.invalid) safeApply((s) => applyListConstraint(s, 'invalid', dto.invalid), 'invalid');

            // 7. Valor por defecto y restflow
            if (dto.default !== undefined) safeApply((s) => s.default(dto.default), 'default');
            if (dto.restflow_id) schema = schema.uuid();
        } catch (e) {
            // SONAR-EXC: NODEJS No expone logs porque es server-side
            console.log(`StringSchemaBuilder::build`, dto, e);
        }

        // 8. Garantía de required siempre fuera del try
        return DependencyHelper.applyConditionalRequired(schema, dto);
    }
}

export default StringSchemaBuilder;

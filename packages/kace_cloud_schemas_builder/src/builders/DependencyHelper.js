import Joi from 'joi';

class DependencyHelper {
    static applyUiLabel(schema, dto) {
        if (typeof dto.ui?.label === 'string' && dto.ui.label.trim() !== '') {
            return schema.label(dto.ui.label.trim());
        }
        return schema;
    }

    static applyConditionalRequired(schema, dto) {
        const base = DependencyHelper.applyUiLabel(schema, dto);

        if (dto.ui?.is_visible === false) {
            return base.optional().allow('', null);
        }

        if (!dto.required && !dto.dependency && !dto.dependsOn) {
            return base.optional().allow('', null);
        }

        if (!dto.dependency && !dto.dependsOn) {
            return dto.required ? base.required().not(null, '') : base.optional().allow('', null);
        }

        const requiredSchema = dto.required ? base.required().not(null, '') : base.optional().allow('', null);
        const inactiveSchema = Joi.any().optional().allow('', null);

        if (dto.dependencyValueValidation === true) {
            const dependencyValues = DependencyHelper.#parseDependencyValues(dto.dependencyValue);

            if (dependencyValues.length === 0) {
                return inactiveSchema;
            }

            return Joi.when(Joi.ref(dto.dependsOn), {
                is: Joi.any()
                    .required()
                    .valid(...dependencyValues),
                then: requiredSchema,
                otherwise: inactiveSchema,
            });
        }

        return Joi.when(Joi.ref(dto.dependsOn), {
            is: Joi.any().required().not(null, ''),
            then: requiredSchema,
            otherwise: inactiveSchema,
        });
    }

    static applyArrayConditional(schema, dto) {
        const base = DependencyHelper.applyUiLabel(schema, dto);

        if (dto.ui?.is_visible === false) {
            return base.optional();
        }

        if (!dto.required && !dto.dependency && !dto.dependsOn) {
            return base.optional();
        }

        if (!dto.dependency && !dto.dependsOn) {
            return dto.required ? base.min(1).required().messages({ 'array.min': 'required' }) : base.optional();
        }

        const requiredSchema = dto.required
            ? base.min(1).required().messages({ 'array.min': 'required' })
            : base.optional();
        const inactiveSchema = Joi.any().optional();

        if (dto.dependencyValueValidation === true) {
            const dependencyValues = DependencyHelper.#parseDependencyValues(dto.dependencyValue);

            if (dependencyValues.length === 0) {
                return inactiveSchema;
            }

            return Joi.when(Joi.ref(dto.dependsOn), {
                is: Joi.any()
                    .required()
                    .valid(...dependencyValues),
                then: requiredSchema,
                otherwise: inactiveSchema,
            });
        }

        return Joi.when(Joi.ref(dto.dependsOn), {
            is: Joi.any().required().not(null, ''),
            then: requiredSchema,
            otherwise: inactiveSchema,
        });
    }

    static #parseDependencyValues(rawValue) {
        const raw = typeof rawValue === 'string' ? rawValue : '';
        return raw
            .split(',')
            .map((v) => v.trim())
            .filter((v) => v)
            .map((v) => {
                try {
                    const parsed = JSON.parse(v);
                    if (typeof parsed === 'object' && parsed !== null) {
                        return v;
                    }
                    return parsed;
                } catch {
                    return v;
                }
            });
    }
}

export default DependencyHelper;

import Joi from 'joi';
import DependencyHelper from './DependencyHelper.js';

class BooleanSchemaBuilder {
    static build(dto) {
        let schema = dto.restflow_id ? Joi.string().uuid() : Joi.boolean();
        if (!dto.restflow_id) {
            if (dto.truthyValues) schema = schema.truthy(...dto.truthyValues);
            if (dto.falsyValues) schema = schema.falsy(...dto.falsyValues);
            if (dto.default !== undefined) schema = schema.default(dto.default);
        }

        return DependencyHelper.applyConditionalRequired(schema, dto);
    }
}

export default BooleanSchemaBuilder;

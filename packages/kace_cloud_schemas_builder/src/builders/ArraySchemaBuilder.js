import Joi from 'joi';
import DependencyHelper from './DependencyHelper.js';

class ArraySchemaBuilder {
    static build(dto) {
        let schema = Joi.array();
        if (dto.items) {
            schema = schema.items(dto.items);
        }
        schema = DependencyHelper.applyArrayConditional(schema, dto);
        return schema;
    }
}

export default ArraySchemaBuilder;

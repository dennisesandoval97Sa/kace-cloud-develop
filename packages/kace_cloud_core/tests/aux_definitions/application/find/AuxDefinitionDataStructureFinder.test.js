import { AuxDefinitionDataStructureFinder } from '../../../../src/aux_definitions/application/find/AuxDefinitionDataStructureFinder.js';
import { Schema } from '../../../../src/schemas/domain/Schema.js';
import { ValidationFailError } from '../../../../src/shared/index.js';
import { SchemasMother } from '../../../schemas/domain/SchemasMother.js';

const SCHEMA_ID = '11111111-1111-4111-8111-111111111111';
const DATA_STRUCTURE = { document: { type: 'string', required: false, unique: true } };

const finderWith = ({ definition, schema, rules = schema }) =>
    new AuxDefinitionDataStructureFinder(
        { findByTableName: async () => definition },
        {
            find: async (id) => (id.value === SCHEMA_ID ? schema : null),
            getSchemaRules: async (id) => (id.value === SCHEMA_ID ? rules : null),
        }
    );

const schemaWith = (dataStructure) =>
    Schema.create(SchemasMother.dto({ id: SCHEMA_ID, data_structure: dataStructure }));

describe('AuxDefinitionDataStructureFinder', () => {
    it('returns the data_structure of the schema bound to the aux table', async () => {
        const finder = finderWith({
            definition: { schema_id: { value: SCHEMA_ID } },
            schema: schemaWith(DATA_STRUCTURE),
        });

        expect(await finder.execute('aux_cases')).toEqual(DATA_STRUCTURE);
    });

    it('returns an empty structure when the aux table has no definition', async () => {
        const finder = finderWith({ definition: null });

        expect(await finder.execute('aux_cases')).toEqual({});
    });

    it('throws when the definition points to a schema that does not exist', async () => {
        const finder = finderWith({ definition: { schema_id: { value: SCHEMA_ID } }, schema: null });

        await expect(finder.execute('aux_cases')).rejects.toBeInstanceOf(ValidationFailError);
    });

    it('returns an empty structure when the schema rules cannot be resolved', async () => {
        const finder = finderWith({
            definition: { schema_id: { value: SCHEMA_ID } },
            schema: schemaWith(DATA_STRUCTURE),
            rules: null,
        });

        await expect(finder.execute('aux_cases')).resolves.toEqual({});
    });
});

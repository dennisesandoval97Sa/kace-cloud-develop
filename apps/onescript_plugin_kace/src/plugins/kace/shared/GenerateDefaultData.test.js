import { describe, expect, it } from 'vitest';
import {
  generateDefaultDataFromSchema,
  mergeSchemaWithData,
  buildSchemaKeyMap,
  unflattenWithSchemaMap,
  flattenObject,
} from './GenerateDefaultData.js';

describe('GenerateDefaultData', () => {
  describe('generateDefaultDataFromSchema', () => {
    it('should correctly preserve falsy default values (0, false, empty string)', () => {
      const schema = {
        data_structure: {
          number_field: {
            type: 'number',
            default: 0,
          },
          boolean_field: {
            type: 'boolean',
            default: false,
          },
          string_field: {
            type: 'string',
            default: '',
          },
          date_field: {
            type: 'date',
            default: '2024-01-01T00:00:00.000Z',
          },
        },
      };

      const result = generateDefaultDataFromSchema(schema);

      expect(result.number_field).toBe(0);
      expect(result.boolean_field).toBe(false);
      expect(result.string_field).toBe('');
      expect(result.date_field).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should fallback to type defaults if default property is not provided', () => {
      const schema = {
        data_structure: {
          number_field: {
            type: 'number',
          },
          boolean_field: {
            type: 'boolean',
          },
          string_field: {
            type: 'string',
          },
          array_field: {
            type: 'array',
          },
        },
      };

      const result = generateDefaultDataFromSchema(schema);

      expect(result.number_field).toBe('');
      expect(result.boolean_field).toBe(false);
      expect(result.string_field).toBe('');
      expect(result.array_field).toEqual([]);
    });

    it('should recursively process object fields', () => {
      const schema = {
        data_structure: {
          group: {
            type: 'object',
            data_structure: {
              nested_number: {
                type: 'number',
                default: 42,
              },
              nested_falsy: {
                type: 'boolean',
                default: false,
              },
            },
          },
        },
      };

      const result = generateDefaultDataFromSchema(schema);

      expect(result.group).toEqual({
        nested_number: 42,
        nested_falsy: false,
      });
    });
    it('should fallback to type default when default is explicitly null', () => {
      const schema = {
        data_structure: {
          number_field: { type: 'number', default: null },
          boolean_field: { type: 'boolean', default: null },
          array_field: { type: 'array', default: null },
        },
      };

      const result = generateDefaultDataFromSchema(schema);

      expect(result.number_field).toBe('');
      expect(result.boolean_field).toBe(false);
      expect(result.array_field).toEqual([]);
    });

    it('should return empty object for null schema', () => {
      expect(generateDefaultDataFromSchema(null)).toEqual({});
    });
  });

  describe('mergeSchemaWithData', () => {
    it('should merge defaults with existing data and prefer existing data', () => {
      const schema = {
        data_structure: {
          field1: { type: 'string', default: 'default1' },
          field2: { type: 'string', default: 'default2' },
        },
      };

      const existingData = {
        field1: 'existing1',
      };

      const result = mergeSchemaWithData(schema, existingData);

      expect(result.field1).toBe('existing1');
      expect(result.field2).toBe('default2');
    });
  });

  describe('buildSchemaKeyMap', () => {
    it('should build a key map of the schema', () => {
      const schema = {
        data_structure: {
          estudios: {
            type: 'object',
            data_structure: {
              primaria: { type: 'boolean' },
              secundaria: { type: 'boolean' },
            },
          },
        },
      };
      const keyMap = buildSchemaKeyMap(schema);
      expect(keyMap.get('estudios')).toBe('estudios');
      expect(keyMap.get('primaria')).toBe('estudios.primaria');
      expect(keyMap.get('secundaria')).toBe('estudios.secundaria');
    });
  });

  describe('unflattenWithSchemaMap', () => {
    it('should unflatten data using key map', () => {
      const flatData = {
        primaria: true,
        secundaria: false,
      };
      const keyMap = new Map([
        ['primaria', 'estudios.primaria'],
        ['secundaria', 'estudios.secundaria'],
      ]);
      const result = unflattenWithSchemaMap(flatData, keyMap);
      expect(result).toEqual({
        estudios: {
          primaria: true,
          secundaria: false,
        },
      });
    });
  });

  describe('flattenObject', () => {
    it('should flatten nested objects without parent prefix', () => {
      const obj = {
        estudios: {
          primaria: true,
          secundaria: false,
        },
        other: 'value',
      };
      const result = flattenObject(obj);
      expect(result).toEqual({
        primaria: true,
        secundaria: false,
        other: 'value',
      });
    });
  });
});

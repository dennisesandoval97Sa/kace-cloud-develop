import { describe, it, expect } from 'vitest';
import SchemaBuilder from '@kace/schemabuilder/src/SchemaBuilder.js';
import {
  parseDependencyValues,
  evaluateDependency,
  buildCustomConditional,
  buildRequiredValidation,
  preprocessSchema,
  transformFormioComponents,
} from './useSchema.utils.js';

const evalConditional = (expr, data, row = null) =>
  new Function('data', 'row', `var show = true; ${expr}; return show;`)(
    data,
    row
  );

describe('parseDependencyValues', () => {
  it('splits a comma-separated string into trimmed tokens', () => {
    expect(parseDependencyValues('a, b, c')).toEqual(['a', 'b', 'c']);
  });

  it('returns an array with one element for a single value', () => {
    expect(parseDependencyValues('especial')).toEqual(['especial']);
  });

  it('filters out empty tokens', () => {
    expect(parseDependencyValues('a,,b, ,c')).toEqual(['a', 'b', 'c']);
  });

  it('returns empty array for empty string', () => {
    expect(parseDependencyValues('')).toEqual([]);
  });

  it('returns empty array for non-string input', () => {
    expect(parseDependencyValues(null)).toEqual([]);
    expect(parseDependencyValues(undefined)).toEqual([]);
    expect(parseDependencyValues(/** @type {any} */ (42))).toEqual([]);
  });
});

describe('evaluateDependency', () => {
  describe('no dependency defined', () => {
    it('returns true when field has no dependency flags', () => {
      expect(evaluateDependency({ required: true }, 'anything')).toBe(true);
    });

    it('returns true when dependency is false', () => {
      expect(
        evaluateDependency({ dependency: false, dependsOn: 'tipo' }, 'val')
      ).toBe(true);
    });
  });

  describe('simple presence dependency (no dependencyValueValidation)', () => {
    const rule = { dependency: true, dependsOn: 'tipo' };

    it('returns true when parent has a non-empty value', () => {
      expect(evaluateDependency(rule, 'normal')).toBe(true);
      expect(evaluateDependency(rule, 0)).toBe(true);
      expect(evaluateDependency(rule, false)).toBe(true); // false is not null/undefined/''
    });

    it('returns false when parent is undefined', () => {
      expect(evaluateDependency(rule, undefined)).toBe(false);
    });

    it('returns false when parent is null', () => {
      expect(evaluateDependency(rule, null)).toBe(false);
    });

    it('returns false when parent is empty string', () => {
      expect(evaluateDependency(rule, '')).toBe(false);
    });
  });

  describe('dependencyValueValidation — single value', () => {
    const rule = {
      dependency: true,
      dependsOn: 'tipo',
      dependencyValue: 'especial',
      dependencyValueValidation: true,
    };

    it('returns true when parent matches the expected value', () => {
      expect(evaluateDependency(rule, 'especial')).toBe(true);
    });

    it('returns false when parent does not match', () => {
      expect(evaluateDependency(rule, 'normal')).toBe(false);
    });

    it('returns false when parent is absent', () => {
      expect(evaluateDependency(rule, undefined)).toBe(false);
      expect(evaluateDependency(rule, null)).toBe(false);
      expect(evaluateDependency(rule, '')).toBe(false);
    });

    it('coerces numeric string — "true" matches boolean true', () => {
      const boolRule = {
        dependency: true,
        dependsOn: 'flag',
        dependencyValue: 'true',
        dependencyValueValidation: true,
      };
      expect(evaluateDependency(boolRule, true)).toBe(true);
      expect(evaluateDependency(boolRule, false)).toBe(false);
    });

    it('coerces number strings', () => {
      const numRule = {
        dependency: true,
        dependsOn: 'nivel',
        dependencyValue: '1',
        dependencyValueValidation: true,
      };
      expect(evaluateDependency(numRule, 1)).toBe(true);
      expect(evaluateDependency(numRule, 2)).toBe(false);
    });
  });

  describe('dependencyValueValidation — multiple values (comma list)', () => {
    const rule = {
      dependency: true,
      dependsOn: 'tipo',
      dependencyValue: 'a, b, c',
      dependencyValueValidation: true,
    };

    it('returns true when parent matches any value in the list', () => {
      expect(evaluateDependency(rule, 'a')).toBe(true);
      expect(evaluateDependency(rule, 'b')).toBe(true);
      expect(evaluateDependency(rule, 'c')).toBe(true);
    });

    it('returns false when parent is not in the list', () => {
      expect(evaluateDependency(rule, 'd')).toBe(false);
    });

    it('returns false when parent is absent', () => {
      expect(evaluateDependency(rule, undefined)).toBe(false);
      expect(evaluateDependency(rule, '')).toBe(false);
    });
  });
});

describe('buildCustomConditional', () => {
  it('returns null when field has no dependency', () => {
    expect(buildCustomConditional({ required: true }, 'campo')).toBeNull();
    expect(
      buildCustomConditional({ dependency: false, dependsOn: 'x' }, 'campo')
    ).toBeNull();
  });

  it('generates presence-based expression', () => {
    const rule = { dependency: true, dependsOn: 'tipo' };
    const expr = buildCustomConditional(rule, 'campo');
    expect(expr).toContain('consider(data)');
    expect(expr).toContain(JSON.stringify('tipo'));
    expect(expr).toContain('show =');
    expect(expr).not.toContain('consider(row)');
  });

  it('uses row accessor inside editgrid', () => {
    const rule = { dependency: true, dependsOn: 'tipo' };
    const expr = buildCustomConditional(rule, 'campo', true);
    expect(expr).toContain('consider(row)');
    expect(expr).toContain('consider(data)');
  });

  it('generates value-match expression for single dependencyValue', () => {
    const rule = {
      dependency: true,
      dependsOn: 'tipo',
      dependencyValue: 'especial',
      dependencyValueValidation: true,
    };
    const expr = buildCustomConditional(rule, 'campo');
    expect(expr).toContain('"especial"');
    expect(expr).toContain('show =');
  });

  it('generates includes expression for comma-separated dependencyValue', () => {
    const rule = {
      dependency: true,
      dependsOn: 'tipo',
      dependencyValue: 'a, b, c',
      dependencyValueValidation: true,
    };
    const expr = buildCustomConditional(rule, 'campo');
    expect(expr).toContain('.includes(normalizedValue)');
    expect(expr).toContain('"a"');
    expect(expr).toContain('"b"');
    expect(expr).toContain('"c"');
  });

  it('the generated expression evaluates correctly at runtime (presence)', () => {
    const rule = { dependency: true, dependsOn: 'tipo' };
    const expr = buildCustomConditional(rule, 'campo');

    expect(evalConditional(expr, { tipo: 'normal' })).toBe(true);
    expect(evalConditional(expr, { tipo: '' })).toBe(false);
    expect(evalConditional(expr, { tipo: null })).toBe(false);
    expect(evalConditional(expr, {})).toBe(false);
  });

  it('the generated expression evaluates value-match correctly at runtime', () => {
    const rule = {
      dependency: true,
      dependsOn: 'tipo',
      dependencyValue: 'especial',
      dependencyValueValidation: true,
    };
    const expr = buildCustomConditional(rule, 'campo');

    expect(evalConditional(expr, { tipo: 'especial' })).toBe(true);
    expect(evalConditional(expr, { tipo: 'normal' })).toBe(false);
    expect(evalConditional(expr, {})).toBe(false);
  });

  it('the generated expression evaluates comma-list correctly at runtime', () => {
    const rule = {
      dependency: true,
      dependsOn: 'tipo',
      dependencyValue: 'a, b, c',
      dependencyValueValidation: true,
    };
    const expr = buildCustomConditional(rule, 'campo');

    expect(evalConditional(expr, { tipo: 'a' })).toBe(true);
    expect(evalConditional(expr, { tipo: 'c' })).toBe(true);
    expect(evalConditional(expr, { tipo: 'd' })).toBe(false);
    expect(evalConditional(expr, {})).toBe(false);
  });

  it('the generated expression uses row over data inside editgrid', () => {
    const rule = { dependency: true, dependsOn: 'tipo' };
    const expr = buildCustomConditional(rule, 'campo', true);

    expect(evalConditional(expr, { tipo: '' }, { tipo: 'desde-row' })).toBe(
      true
    );
    expect(evalConditional(expr, { tipo: 'desde-data' }, {})).toBe(true);
    expect(evalConditional(expr, {}, {})).toBe(false);
  });

  it('shows nested correo_electronico when sibling linea is AUTOS', () => {
    const rule = {
      dependency: true,
      dependsOn: 'linea',
      dependencyValue: 'AUTOS',
      dependencyValueValidation: true,
    };
    const expr = buildCustomConditional(rule, 'correo_electronico', false, [
      'asignacion_asistencia_movilidad',
    ]);
    expect(
      evalConditional(expr, {
        asignacion_asistencia_movilidad: { linea: 'AUTOS' },
      })
    ).toBe(true);
    expect(
      evalConditional(expr, {
        asignacion_asistencia_movilidad: { linea: 'OTRO' },
      })
    ).toBe(false);
    expect(evalConditional(expr, {})).toBe(false);
  });

  it('falls back to root linea when the nested object lacks the key', () => {
    const rule = {
      dependency: true,
      dependsOn: 'linea',
      dependencyValue: 'AUTOS',
      dependencyValueValidation: true,
    };
    const expr = buildCustomConditional(rule, 'correo_electronico', false, [
      'asignacion_asistencia_movilidad',
    ]);
    expect(
      evalConditional(expr, {
        linea: 'AUTOS',
        asignacion_asistencia_movilidad: {},
      })
    ).toBe(true);
  });

  it('does not read row when not in editgrid (container inside columns)', () => {
    const rule = { dependency: true, dependsOn: 'linea' };
    const expr = buildCustomConditional(rule, 'correo_electronico', false, [
      'asignacion_asistencia_movilidad',
    ]);
    expect(expr).not.toContain('consider(row)');
    expect(expr).not.toContain('row[');
  });

  it('does not fall through to root when the nested sibling exists and is empty', () => {
    const rule = {
      dependency: true,
      dependsOn: 'linea',
      dependencyValue: 'AUTOS',
      dependencyValueValidation: true,
    };
    const expr = buildCustomConditional(rule, 'correo_electronico', false, [
      'asignacion_asistencia_movilidad',
    ]);
    expect(
      evalConditional(expr, {
        linea: 'AUTOS',
        asignacion_asistencia_movilidad: { linea: '' },
      })
    ).toBe(false);
  });

  it('does not fall through to root when the nested sibling exists and is undefined', () => {
    const rule = {
      dependency: true,
      dependsOn: 'linea',
      dependencyValue: 'AUTOS',
      dependencyValueValidation: true,
    };
    const expr = buildCustomConditional(rule, 'correo_electronico', false, [
      'asignacion_asistencia_movilidad',
    ]);
    expect(
      evalConditional(expr, {
        linea: 'AUTOS',
        asignacion_asistencia_movilidad: { linea: undefined },
      })
    ).toBe(false);
  });

  it('resolves a two-segment path at the leaf, the mid ancestor, and the root', () => {
    const rule = {
      dependency: true,
      dependsOn: 'linea',
      dependencyValue: 'MATCH',
      dependencyValueValidation: true,
    };
    const expr = buildCustomConditional(rule, 'campo', false, ['a', 'b']);

    expect(
      evalConditional(expr, {
        linea: 'OTHER',
        a: { linea: 'OTHER', b: { linea: 'MATCH' } },
      })
    ).toBe(true);

    expect(
      evalConditional(expr, {
        linea: 'OTHER',
        a: { linea: 'MATCH', b: {} },
      })
    ).toBe(true);

    expect(
      evalConditional(expr, {
        linea: 'MATCH',
        a: { b: {} },
      })
    ).toBe(true);
  });

  it('reads a container nested inside an editgrid row via row, not the root', () => {
    const rule = {
      dependency: true,
      dependsOn: 'linea',
      dependencyValue: 'AUTOS',
      dependencyValueValidation: true,
    };
    const path = [
      { key: 'items', nestsArray: true },
      { key: 'contenedor', nestsArray: false },
    ];
    const expr = buildCustomConditional(rule, 'correo', true, path);
    expect(expr).toContain('consider(at(row,');
    expect(
      evalConditional(
        expr,
        {
          linea: 'AUTOS',
          items: [{ contenedor: { linea: 'OTRO' } }],
        },
        { contenedor: { linea: 'OTRO' } }
      )
    ).toBe(false);
    expect(
      evalConditional(
        expr,
        {
          linea: 'OTRO',
          items: [{ contenedor: { linea: 'AUTOS' } }],
        },
        { contenedor: { linea: 'AUTOS' } }
      )
    ).toBe(true);
  });

  it('JSON.stringifies dependsOn so a quote in the key does not break the expression', () => {
    const expr = buildCustomConditional(
      { dependency: true, dependsOn: "x');" },
      'campo'
    );
    expect(expr).toContain(JSON.stringify("x');"));
    expect(() => evalConditional(expr, {})).not.toThrow();
    expect(evalConditional(expr, { "x');": 'yes' })).toBe(true);
  });

  it('keeps generated accessor length linear with path depth', () => {
    const rule = { dependency: true, dependsOn: 'linea' };
    const deepPath = ['c0', 'c1', 'c2', 'c3', 'c4', 'c5'];
    const expr = buildCustomConditional(rule, 'campo', false, deepPath);
    expect(expr.length).toBeLessThan(2000);
  });
});
describe('buildRequiredValidation', () => {
  it('returns true when required is true', () => {
    expect(buildRequiredValidation({ required: true })).toBe(true);
  });

  it('returns false when required is false', () => {
    expect(buildRequiredValidation({ required: false })).toBe(false);
  });

  it('returns false (not null) when required is not defined in the rule', () => {
    // Must return false so that any validate.required=true from the original
    // Form.io JSON is overridden, preventing hidden dependent fields from
    // staying visible/required when their dependency condition is not met.
    expect(buildRequiredValidation({})).toBe(false);
    expect(buildRequiredValidation({ type: 'string' })).toBe(false);
  });

  it('returns null for non-object input (no data_structure entry for this key)', () => {
    expect(buildRequiredValidation(null)).toBeNull();
    expect(buildRequiredValidation('string')).toBeNull();
  });
});

describe('preprocessSchema', () => {
  // Mirrors the test suite from DependencyHelper.test.js in the backend

  describe('inactive field — required is stripped', () => {
    const schema = {
      tipo: { type: 'string', required: false },
      codigo: {
        type: 'string',
        required: true,
        min: 5,
        max: 10,
        dependsOn: 'tipo',
        dependency: true,
        dependencyValue: 'especial',
        dependencyValueValidation: true,
      },
    };

    it('strips required when parent field is absent', () => {
      const result = preprocessSchema(schema, { codigo: 'AB' });
      expect(result.codigo).not.toHaveProperty('required');
    });

    it('strips required when parent has wrong value', () => {
      const result = preprocessSchema(schema, { tipo: 'normal', codigo: 'AB' });
      expect(result.codigo).not.toHaveProperty('required');
    });

    it('keeps required when parent matches the expected value', () => {
      const result = preprocessSchema(schema, {
        tipo: 'especial',
        codigo: 'ABCDE',
      });
      expect(result.codigo.required).toBe(true);
    });

    it('keeps dependsOn on an active local sibling so SchemaBuilder emits Joi.when()', () => {
      const result = preprocessSchema(schema, {
        tipo: 'especial',
        codigo: 'ABCDE',
      });
      expect(result.codigo.dependsOn).toBe('tipo');
      expect(result.codigo.dependency).toBe(true);
      expect(result.codigo.dependencyValue).toBe('especial');
      expect(result.codigo.dependencyValueValidation).toBe(true);
    });

    it('strips all validators (min, max, …) when inactive — Form.io must not fire constraints', () => {
      const inactiveResult = preprocessSchema(schema, { tipo: 'normal' });
      // All validators must be stripped so Form.io skips them entirely.
      expect(inactiveResult.codigo).not.toHaveProperty('min');
      expect(inactiveResult.codigo).not.toHaveProperty('max');
    });

    it('keeps validators (min, max) when the dependency is met', () => {
      const activeResult = preprocessSchema(schema, {
        tipo: 'especial',
        codigo: 'ABCDE',
      });
      expect(activeResult.codigo.min).toBe(5);
      expect(activeResult.codigo.max).toBe(10);
    });

    it('keeps dependency/dependsOn intact so SchemaBuilder can build Joi.when()', () => {
      const result = preprocessSchema(schema, { tipo: 'normal' });
      expect(result.codigo.dependency).toBe(true);
      expect(result.codigo.dependsOn).toBe('tipo');
    });
  });

  describe('simple presence dependency', () => {
    const schema = {
      padre: { type: 'string', required: false },
      hijo: {
        type: 'string',
        required: true,
        dependency: true,
        dependsOn: 'padre',
      },
    };

    it('strips required when parent is absent', () => {
      const result = preprocessSchema(schema, {});
      expect(result.hijo).not.toHaveProperty('required');
    });

    it('strips required when parent is empty string', () => {
      const result = preprocessSchema(schema, { padre: '' });
      expect(result.hijo).not.toHaveProperty('required');
    });

    it('keeps required when parent has any non-empty value', () => {
      const result = preprocessSchema(schema, { padre: 'cualquier' });
      expect(result.hijo.required).toBe(true);
    });
  });

  describe('boolean parent dependency', () => {
    const schema = {
      flag: { type: 'boolean', required: false },
      email_contacto: {
        type: 'string',
        required: true,
        email: { tlds: false },
        dependsOn: 'flag',
        dependency: true,
        dependencyValue: 'true',
        dependencyValueValidation: true,
      },
    };

    it('strips required when flag is false', () => {
      const result = preprocessSchema(schema, {
        flag: false,
        email_contacto: 'no-es-email',
      });
      expect(result.email_contacto).not.toHaveProperty('required');
    });

    it('keeps required when flag is true', () => {
      const result = preprocessSchema(schema, {
        flag: true,
        email_contacto: 'test@test.com',
      });
      expect(result.email_contacto.required).toBe(true);
    });
  });

  describe('multiple allowed values', () => {
    const schema = {
      tipo: { type: 'string', required: false },
      campo: {
        type: 'string',
        required: true,
        dependsOn: 'tipo',
        dependency: true,
        dependencyValue: 'a, b, c',
        dependencyValueValidation: true,
      },
    };

    it('keeps required when parent matches one of the listed values', () => {
      expect(preprocessSchema(schema, { tipo: 'a' }).campo.required).toBe(true);
      expect(preprocessSchema(schema, { tipo: 'b' }).campo.required).toBe(true);
      expect(preprocessSchema(schema, { tipo: 'c' }).campo.required).toBe(true);
    });

    it('strips required when parent does not match any listed value', () => {
      const result = preprocessSchema(schema, { tipo: 'd' });
      expect(result.campo).not.toHaveProperty('required');
    });
  });

  describe('non-dependent fields are not modified', () => {
    const schema = {
      nombre: { type: 'string', required: true, min: 3 },
      edad: { type: 'number', required: false },
    };

    it('leaves required-only fields untouched', () => {
      const result = preprocessSchema(schema, {});
      expect(result.nombre.required).toBe(true);
      expect(result.nombre.min).toBe(3);
      expect(result.edad.required).toBe(false);
    });
  });

  describe('nested dependsOn ancestor at root', () => {
    const schema = {
      campo_qa: { type: 'string', required: false },
      asignacion_asistencia_movilidad: {
        type: 'object',
        data_structure: {
          correo_electronico: {
            type: 'string',
            required: true,
            min: 2,
            dependency: true,
            dependsOn: 'campo_qa',
            dependencyValue: 'Test',
            dependencyValueValidation: true,
          },
        },
      },
    };

    it('keeps nested required when only the root parent matches', () => {
      const result = preprocessSchema(schema, {
        campo_qa: 'Test',
        asignacion_asistencia_movilidad: {},
      });
      expect(
        result.asignacion_asistencia_movilidad.data_structure.correo_electronico
          .required
      ).toBe(true);
      expect(
        result.asignacion_asistencia_movilidad.data_structure.correo_electronico
          .min
      ).toBe(2);
    });

    it('drops dependsOn/dependency keys on an active field resolved via a root ancestor, so SchemaBuilder emits the unconditional required schema instead of a sibling-scoped Joi.when()', () => {
      const result = preprocessSchema(schema, {
        campo_qa: 'Test',
        asignacion_asistencia_movilidad: {},
      });
      const correo =
        result.asignacion_asistencia_movilidad.data_structure
          .correo_electronico;
      expect(correo.required).toBe(true);
      expect(correo).not.toHaveProperty('dependsOn');
      expect(correo).not.toHaveProperty('dependency');
      expect(correo).not.toHaveProperty('dependencyValue');
      expect(correo).not.toHaveProperty('dependencyValueValidation');
    });

    it('strips nested required when the root parent does not match', () => {
      const result = preprocessSchema(schema, {
        campo_qa: 'Nope',
        asignacion_asistencia_movilidad: {},
      });
      const correo =
        result.asignacion_asistencia_movilidad.data_structure
          .correo_electronico;
      expect(correo).not.toHaveProperty('required');
      expect(correo).not.toHaveProperty('min');
      // Structural keys are kept on inactive fields so SchemaBuilder still emits Joi.when().
      expect(correo.dependsOn).toBe('campo_qa');
      expect(correo.dependency).toBe(true);
    });
  });

  describe('nested sibling empty does not fall through to root', () => {
    const schema = {
      linea: { type: 'string' },
      contenedor: {
        type: 'object',
        data_structure: {
          linea: { type: 'string' },
          correo: {
            type: 'string',
            required: true,
            dependency: true,
            dependsOn: 'linea',
            dependencyValue: 'AUTOS',
            dependencyValueValidation: true,
          },
        },
      },
    };

    it('strips validators when nested linea is empty even if root linea is AUTOS', () => {
      const result = preprocessSchema(schema, {
        linea: 'AUTOS',
        contenedor: { linea: '' },
      });
      expect(result.contenedor.data_structure.correo).not.toHaveProperty(
        'required'
      );
    });
  });

  describe('nested data_structure', () => {
    const schema = {
      contenedor: {
        type: 'object',
        required: false,
        data_structure: {
          flag: { type: 'boolean', required: false },
          campo_nested: {
            type: 'string',
            required: true,
            dependency: true,
            dependsOn: 'flag',
            dependencyValue: 'true',
            dependencyValueValidation: true,
          },
        },
      },
    };

    it('recursively processes nested data_structure with the nested data', () => {
      const data = { contenedor: { flag: false, campo_nested: 'val' } };
      const result = preprocessSchema(schema, data);
      expect(result.contenedor.data_structure.campo_nested).not.toHaveProperty(
        'required'
      );
    });

    it('keeps required in nested field when nested parent matches', () => {
      const data = { contenedor: { flag: true, campo_nested: 'val' } };
      const result = preprocessSchema(schema, data);
      expect(result.contenedor.data_structure.campo_nested.required).toBe(true);
    });
  });

  describe('array-type data_structure', () => {
    const schema = {
      items: {
        type: 'array',
        required: false,
        data_structure: {
          activo: { type: 'boolean', required: false },
          descripcion: {
            type: 'string',
            required: true,
            dependency: true,
            dependsOn: 'activo',
            dependencyValue: 'true',
            dependencyValueValidation: true,
          },
        },
      },
    };

    it('keeps local item dependency keys so Joi.when can evaluate each row', () => {
      const data = {
        items: [
          { activo: true, descripcion: 'ok' },
          { activo: false, descripcion: '' },
        ],
      };
      const result = preprocessSchema(schema, data);
      expect(result.items.data_structure.descripcion.required).toBe(true);
      expect(result.items.data_structure.descripcion.dependsOn).toBe('activo');
      expect(result.items.data_structure.descripcion.dependency).toBe(true);
    });

    it('does not freeze row-0 activation onto other rows via SchemaBuilder', () => {
      const data = {
        items: [
          { activo: true, descripcion: 'ok' },
          { activo: false, descripcion: '' },
        ],
      };
      const processed = preprocessSchema(schema, data);
      const { error } = SchemaBuilder.build(processed).validate(data, {
        abortEarly: false,
      });
      expect(error).toBeUndefined();
    });

    it('still requires the field on active rows when row 0 is inactive', () => {
      const data = {
        items: [
          { activo: false, descripcion: '' },
          { activo: true, descripcion: '' },
        ],
      };
      const processed = preprocessSchema(schema, data);
      const { error } = SchemaBuilder.build(processed).validate(data, {
        abortEarly: false,
      });
      expect(error).toBeDefined();
      expect(
        error.details.some((d) => d.path.join('.') === 'items.1.descripcion')
      ).toBe(true);
    });

    it('drops ancestor dependency keys inside array items so all rows share the root parent', () => {
      const nested = {
        campo_qa: { type: 'string' },
        items: {
          type: 'array',
          required: false,
          data_structure: {
            correo: {
              type: 'string',
              required: true,
              dependency: true,
              dependsOn: 'campo_qa',
              dependencyValue: 'Test',
              dependencyValueValidation: true,
            },
          },
        },
      };
      const data = {
        campo_qa: 'Test',
        items: [{ correo: 'a@b.c' }, { correo: '' }],
      };
      const processed = preprocessSchema(nested, data);
      expect(processed.items.data_structure.correo).not.toHaveProperty(
        'dependsOn'
      );
      const { error } = SchemaBuilder.build(processed).validate(data, {
        abortEarly: false,
      });
      expect(error).toBeDefined();
      expect(
        error.details.some((d) => d.path.join('.') === 'items.1.correo')
      ).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('returns non-object schema as-is', () => {
      expect(preprocessSchema(null, {})).toBeNull();
      expect(preprocessSchema(undefined, {})).toBeUndefined();
    });

    it('handles primitive field values in schema without crashing', () => {
      const schema = { simple: 'string-value' };
      expect(preprocessSchema(schema, {})).toEqual({ simple: 'string-value' });
    });
  });
});

describe('transformFormioComponents', () => {
  const correoRule = {
    type: 'string',
    dependency: true,
    dependsOn: 'linea',
    dependencyValue: 'AUTOS',
    dependencyValueValidation: true,
  };

  const ds = {
    asignacion_asistencia_movilidad: {
      type: 'object',
      data_structure: {
        linea: { type: 'string' },
        correo_electronico: correoRule,
      },
    },
  };

  const components = [
    {
      type: 'panel',
      key: 'asignacion',
      components: [
        {
          type: 'container',
          key: 'asignacion_asistencia_movilidad',
          components: [
            {
              type: 'columns',
              key: 'cols',
              columns: [
                {
                  components: [
                    { type: 'kace_text_field', key: 'correo_electronico' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ];

  it('injects customConditional that reads nested linea through panel/container/columns', () => {
    const result = transformFormioComponents(components, ds);
    const correo =
      result[0].components[0].components[0].columns[0].components[0];
    expect(correo.customConditional).toEqual(expect.any(String));
    expect(
      evalConditional(correo.customConditional, {
        asignacion_asistencia_movilidad: { linea: 'AUTOS' },
      })
    ).toBe(true);
    expect(
      evalConditional(correo.customConditional, {
        asignacion_asistencia_movilidad: { linea: 'MOTO' },
      })
    ).toBe(false);
  });

  it('re-anchors a container inside an editgrid onto the row object', () => {
    const tree = [
      {
        type: 'editgrid',
        key: 'items',
        components: [
          {
            type: 'container',
            key: 'contenedor',
            components: [{ type: 'kace_text_field', key: 'correo' }],
          },
        ],
      },
    ];
    const nestedDs = {
      items: {
        type: 'array',
        data_structure: {
          contenedor: {
            type: 'object',
            data_structure: {
              linea: { type: 'string' },
              correo: correoRule,
            },
          },
        },
      },
    };
    const result = transformFormioComponents(tree, nestedDs);
    const correo = result[0].components[0].components[0];
    expect(correo.customConditional).toEqual(expect.any(String));
    expect(correo.customConditional).toContain('consider(at(row,');
    expect(
      evalConditional(
        correo.customConditional,
        { linea: 'AUTOS', items: [{ contenedor: { linea: 'OTRO' } }] },
        { contenedor: { linea: 'OTRO' } }
      )
    ).toBe(false);
    expect(
      evalConditional(
        correo.customConditional,
        { linea: 'OTRO', items: [{ contenedor: { linea: 'AUTOS' } }] },
        { contenedor: { linea: 'AUTOS' } }
      )
    ).toBe(true);
  });
});

describe('real-world schema integration', () => {
  const ds = {
    placa: {
      type: 'string',
      required: true,
      dependency: false,
      dependencyValueValidation: false,
    },
    campo_qa: {
      type: 'string',
      required: false,
      dependency: false,
      dependencyValueValidation: false,
    },
    campo_depenciente_dos: {
      type: 'string',
      max: 6,
      required: true,
      dependsOn: 'placa',
      dependency: true,
      dependencyValue: 'XYZ123',
      dependencyValueValidation: true,
    },
    campo_dependiente_uno: {
      type: 'string',
      max: 10,
      min: 5,
      required: true,
      dependsOn: 'campo_qa',
      dependency: true,
      dependencyValueValidation: false, // activo con cualquier valor no vacío
    },
  };

  // ── placa (campo normal, required: true, sin dependencia) ──────────────────
  describe('placa — campo requerido sin dependencia', () => {
    it('nunca se le elimina required', () => {
      expect(preprocessSchema(ds, {}).placa.required).toBe(true);
      expect(preprocessSchema(ds, { campo_qa: 'x' }).placa.required).toBe(true);
    });
  });

  describe('campo_depenciente_dos — depende de placa = "XYZ123"', () => {
    it('strips required cuando placa está ausente', () => {
      const result = preprocessSchema(ds, {});
      expect(result.campo_depenciente_dos).not.toHaveProperty('required');
    });

    it('strips required cuando placa tiene otro valor', () => {
      const result = preprocessSchema(ds, { placa: 'ABC123' });
      expect(result.campo_depenciente_dos).not.toHaveProperty('required');
    });

    it('conserva required cuando placa = "XYZ123"', () => {
      const result = preprocessSchema(ds, { placa: 'XYZ123' });
      expect(result.campo_depenciente_dos.required).toBe(true);
    });

    it('elimina max cuando la dependencia no se cumple, lo conserva cuando sí', () => {
      const inactiveResult = preprocessSchema(ds, { placa: 'OTRO' });
      expect(inactiveResult.campo_depenciente_dos).not.toHaveProperty('max');

      const activeResult = preprocessSchema(ds, { placa: 'XYZ123' });
      expect(activeResult.campo_depenciente_dos.max).toBe(6);
    });

    it('conserva dependency/dependsOn para que SchemaBuilder construya Joi.when()', () => {
      const result = preprocessSchema(ds, { placa: 'OTRO' });
      expect(result.campo_depenciente_dos.dependency).toBe(true);
      expect(result.campo_depenciente_dos.dependsOn).toBe('placa');
    });
  });

  // ── campo_dependiente_uno — dependsOn campo_qa (presencia, sin valor fijo) ─
  describe('campo_dependiente_uno — depende de presencia de campo_qa', () => {
    it('strips required cuando campo_qa está ausente', () => {
      const result = preprocessSchema(ds, {});
      expect(result.campo_dependiente_uno).not.toHaveProperty('required');
    });

    it('strips required cuando campo_qa es string vacío', () => {
      const result = preprocessSchema(ds, { campo_qa: '' });
      expect(result.campo_dependiente_uno).not.toHaveProperty('required');
    });

    it('strips required cuando campo_qa es null', () => {
      const result = preprocessSchema(ds, { campo_qa: null });
      expect(result.campo_dependiente_uno).not.toHaveProperty('required');
    });

    it('conserva required cuando campo_qa tiene cualquier valor no vacío', () => {
      expect(
        preprocessSchema(ds, { campo_qa: 'cualquier' }).campo_dependiente_uno
          .required
      ).toBe(true);
      expect(
        preprocessSchema(ds, { campo_qa: '0' }).campo_dependiente_uno.required
      ).toBe(true);
    });

    it('elimina min/max cuando la dependencia no se cumple, los conserva cuando sí', () => {
      const inactive = preprocessSchema(ds, { campo_qa: '' });
      expect(inactive.campo_dependiente_uno).not.toHaveProperty('min');
      expect(inactive.campo_dependiente_uno).not.toHaveProperty('max');

      const active = preprocessSchema(ds, { campo_qa: 'valor' });
      expect(active.campo_dependiente_uno.min).toBe(5);
      expect(active.campo_dependiente_uno.max).toBe(10);
    });
  });

  // ── buildCustomConditional con el schema real ──────────────────────────────
  describe('buildCustomConditional con campos del schema real', () => {
    it('campo_depenciente_dos: show=true solo cuando placa = "XYZ123"', () => {
      const expr = buildCustomConditional(
        ds.campo_depenciente_dos,
        'campo_depenciente_dos'
      );
      expect(evalConditional(expr, { placa: 'XYZ123' })).toBe(true);
      expect(evalConditional(expr, { placa: 'ABC123' })).toBe(false);
      expect(evalConditional(expr, {})).toBe(false);
    });

    it('campo_dependiente_uno: show=true con cualquier valor no vacío en campo_qa', () => {
      const expr = buildCustomConditional(
        ds.campo_dependiente_uno,
        'campo_dependiente_uno'
      );
      expect(evalConditional(expr, { campo_qa: 'texto' })).toBe(true);
      expect(evalConditional(expr, { campo_qa: '' })).toBe(false);
      expect(evalConditional(expr, {})).toBe(false);
    });

    it('placa y campo_qa no generan customConditional (dependency: false)', () => {
      expect(buildCustomConditional(ds.placa, 'placa')).toBeNull();
      expect(buildCustomConditional(ds.campo_qa, 'campo_qa')).toBeNull();
    });
  });
});

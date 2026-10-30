import SchemaBuilder from '../src/SchemaBuilder';

/**
 * Builds a Joi object schema and validates the given data,
 * returning the array of error message strings (empty if OK).
 */
function validateData(dataStructure, data) {
    const schema = SchemaBuilder.build(dataStructure);
    const result = schema.validate(data, { abortEarly: false, allowUnknown: true });
    return result.error?.details?.map((d) => d.message) ?? [];
}

function hasError(errors) {
    return errors.length > 0;
}

function hasFieldError(errors, field) {
    return errors.some((msg) => msg.includes(`"${field}"`));
}

const booleanDependencyStructure = {
    campo_padre: { type: 'boolean', required: true },
    campo_dependiente: {
        type: 'string',
        required: true,
        dependsOn: 'campo_padre',
        dependency: true,
        dependencyValue: 'true',
        dependencyValueValidation: true,
    },
};

const stringDependencyStructure = {
    estado: { type: 'string', required: false },
    notas: {
        type: 'string',
        required: true,
        dependsOn: 'estado',
        dependency: true,
        dependencyValue: 'activo',
        dependencyValueValidation: true,
    },
};

const numberDependencyStructure = {
    prioridad: { type: 'number', required: false },
    descripcion: {
        type: 'number',
        required: true,
        dependsOn: 'prioridad',
        dependency: true,
        dependencyValue: '1',
        dependencyValueValidation: true,
    },
};

const multiValueDependencyStructure = {
    tipo: { type: 'string', required: false },
    detalle: {
        type: 'string',
        required: true,
        dependsOn: 'tipo',
        dependency: true,
        dependencyValue: 'A,B,C',
        dependencyValueValidation: true,
    },
};

const simpleRequiredStructure = {
    nombre: { type: 'string', required: true },
    edad: { type: 'number', required: false },
};

const dependencyWithoutValueValidationStructure = {
    referencia: { type: 'string', required: false },
    comentario: {
        type: 'string',
        required: true,
        dependsOn: 'referencia',
        dependency: true,
        dependencyValueValidation: false,
    },
};

describe('DependencyHelper', () => {
    describe('boolean type dependency', () => {
        it('should require campo_dependiente when campo_padre is true', () => {
            const errors = validateData(booleanDependencyStructure, { campo_padre: true });

            expect(hasFieldError(errors, 'campo_dependiente')).toBe(true);
        });

        it('should accept the payload when campo_padre is true and campo_dependiente is present', () => {
            const errors = validateData(booleanDependencyStructure, {
                campo_padre: true,
                campo_dependiente: 'valor',
            });

            expect(hasError(errors)).toBe(false);
        });

        it('should not require campo_dependiente when campo_padre is false', () => {
            const errors = validateData(booleanDependencyStructure, { campo_padre: false });

            expect(hasFieldError(errors, 'campo_dependiente')).toBe(false);
        });

        it('should not require campo_dependiente when campo_padre is absent from payload', () => {
            const errors = validateData(booleanDependencyStructure, {});

            expect(hasFieldError(errors, 'campo_dependiente')).toBe(false);
        });

        it('should reject the boolean value of campo_padre as string "true" (strict type)', () => {
            // The dependencyValue 'true' is coerced to boolean true via JSON.parse,
            // so the literal string "true" will not trigger the dependency.
            const errors = validateData(booleanDependencyStructure, { campo_padre: false });

            expect(hasFieldError(errors, 'campo_dependiente')).toBe(false);
        });
    });

    describe('string type dependency', () => {
        it('should require notas when estado is "activo"', () => {
            const errors = validateData(stringDependencyStructure, { estado: 'activo' });

            expect(hasFieldError(errors, 'notas')).toBe(true);
        });

        it('should accept the payload when estado is "activo" and notas is present', () => {
            const errors = validateData(stringDependencyStructure, {
                estado: 'activo',
                notas: 'texto de notas',
            });

            expect(hasError(errors)).toBe(false);
        });

        it('should not require notas when estado is "inactivo"', () => {
            const errors = validateData(stringDependencyStructure, { estado: 'inactivo' });

            expect(hasFieldError(errors, 'notas')).toBe(false);
        });

        it('should not require notas when estado is empty', () => {
            const errors = validateData(stringDependencyStructure, { estado: '' });

            expect(hasFieldError(errors, 'notas')).toBe(false);
        });

        it('should not require notas when estado is absent from payload', () => {
            const errors = validateData(stringDependencyStructure, {});

            expect(hasFieldError(errors, 'notas')).toBe(false);
        });
    });

    describe('number type dependency', () => {
        it('should require descripcion when prioridad is 1', () => {
            const errors = validateData(numberDependencyStructure, { prioridad: 1 });

            expect(hasFieldError(errors, 'descripcion')).toBe(true);
        });

        it('should accept the payload when prioridad is 1 and descripcion is present', () => {
            const errors = validateData(numberDependencyStructure, {
                prioridad: 1,
                descripcion: 42,
            });

            expect(hasError(errors)).toBe(false);
        });

        it('should not require descripcion when prioridad is a value other than 1', () => {
            const errors = validateData(numberDependencyStructure, { prioridad: 2 });

            expect(hasFieldError(errors, 'descripcion')).toBe(false);
        });

        it('should not require descripcion when prioridad is absent from payload', () => {
            const errors = validateData(numberDependencyStructure, {});

            expect(hasFieldError(errors, 'descripcion')).toBe(false);
        });

        it('should not require descripcion when prioridad is 0', () => {
            const errors = validateData(numberDependencyStructure, { prioridad: 0 });

            expect(hasFieldError(errors, 'descripcion')).toBe(false);
        });
    });

    describe('dependencyValue with multiple values (A,B,C)', () => {
        it('should require detalle when tipo is "A"', () => {
            const errors = validateData(multiValueDependencyStructure, { tipo: 'A' });

            expect(hasFieldError(errors, 'detalle')).toBe(true);
        });

        it('should require detalle when tipo is "B"', () => {
            const errors = validateData(multiValueDependencyStructure, { tipo: 'B' });

            expect(hasFieldError(errors, 'detalle')).toBe(true);
        });

        it('should require detalle when tipo is "C"', () => {
            const errors = validateData(multiValueDependencyStructure, { tipo: 'C' });

            expect(hasFieldError(errors, 'detalle')).toBe(true);
        });

        it('should not require detalle when tipo is "D" (outside of A,B,C)', () => {
            const errors = validateData(multiValueDependencyStructure, { tipo: 'D' });

            expect(hasFieldError(errors, 'detalle')).toBe(false);
        });

        it('should accept the payload when tipo is "A" and detalle is present', () => {
            const errors = validateData(multiValueDependencyStructure, {
                tipo: 'A',
                detalle: 'valor',
            });

            expect(hasError(errors)).toBe(false);
        });

        it('should not require detalle when tipo is absent from payload', () => {
            const errors = validateData(multiValueDependencyStructure, {});

            expect(hasFieldError(errors, 'detalle')).toBe(false);
        });
    });

    describe('required field without dependency', () => {
        it('should require nombre when absent', () => {
            const errors = validateData(simpleRequiredStructure, {});

            expect(hasFieldError(errors, 'nombre')).toBe(true);
        });

        it('should accept the payload when nombre is present', () => {
            const errors = validateData(simpleRequiredStructure, { nombre: 'Juan' });

            expect(hasError(errors)).toBe(false);
        });

        it('should not require edad when it is optional', () => {
            const errors = validateData(simpleRequiredStructure, { nombre: 'Juan' });

            expect(hasFieldError(errors, 'edad')).toBe(false);
        });
    });

    describe('dependencyValueValidation set to false (simple presence)', () => {
        it('should require comentario when referencia has a value', () => {
            const errors = validateData(dependencyWithoutValueValidationStructure, {
                referencia: 'REF-001',
            });

            expect(hasFieldError(errors, 'comentario')).toBe(true);
        });

        it('should not require comentario when referencia is absent', () => {
            const errors = validateData(dependencyWithoutValueValidationStructure, {});

            expect(hasFieldError(errors, 'comentario')).toBe(false);
        });

        it('should accept when referencia has a value and comentario is present', () => {
            const errors = validateData(dependencyWithoutValueValidationStructure, {
                referencia: 'REF-001',
                comentario: 'Texto de comentario',
            });

            expect(hasError(errors)).toBe(false);
        });
    });

    describe('dependent field with non-required (optional) parent field', () => {
        const structure = {
            flag: { type: 'boolean', required: false },
            valor_extra: {
                type: 'string',
                required: true,
                dependsOn: 'flag',
                dependency: true,
                dependencyValue: 'true',
                dependencyValueValidation: true,
            },
        };

        it('should require valor_extra when flag is true (parent optional but sent)', () => {
            const errors = validateData(structure, { flag: true });

            expect(hasFieldError(errors, 'valor_extra')).toBe(true);
        });

        it('should not require valor_extra when flag is false', () => {
            const errors = validateData(structure, { flag: false });

            expect(hasFieldError(errors, 'valor_extra')).toBe(false);
        });

        it('should not require valor_extra when flag is not sent', () => {
            const errors = validateData(structure, {});

            expect(hasFieldError(errors, 'valor_extra')).toBe(false);
        });
    });

    describe('ui.is_visible false', () => {
        it('should not require field when required is true and ui.is_visible is false', () => {
            const structure = {
                visible: { type: 'string', required: true },
                hidden: {
                    type: 'string',
                    required: true,
                    ui: { is_visible: false },
                },
            };

            const errors = validateData(structure, { visible: 'ok' });

            expect(hasFieldError(errors, 'hidden')).toBe(false);
        });

        it('should still require field when ui.is_visible is true', () => {
            const structure = {
                campo: {
                    type: 'string',
                    required: true,
                    ui: { is_visible: true },
                },
            };

            const errors = validateData(structure, {});

            expect(hasFieldError(errors, 'campo')).toBe(true);
        });

        it('should not require dependent field when ui.is_visible is false even if dependency matches', () => {
            const structure = {
                estado: { type: 'string', required: true },
                notas: {
                    type: 'string',
                    required: true,
                    dependsOn: 'estado',
                    dependency: true,
                    dependencyValue: 'activo',
                    dependencyValueValidation: true,
                    ui: { is_visible: false },
                },
            };

            const errors = validateData(structure, { estado: 'activo' });

            expect(hasFieldError(errors, 'notas')).toBe(false);
        });
    });

    describe('ui.label', () => {
        it('should show ui.label in the required error message instead of the field key', () => {
            const structure = {
                nombre_interno: {
                    type: 'string',
                    required: true,
                    ui: { label: 'Nombre completo' },
                },
            };

            const schema = SchemaBuilder.build(structure);
            const result = schema.validate({}, { abortEarly: true });

            expect(result.error).toBeDefined();
            expect(result.error.details[0].message).toContain('Nombre completo');
            expect(result.error.details[0].message.includes('nombre_interno')).toBe(false);
        });

        it('should show ui.label when a conditional required field is missing', () => {
            const structure = {
                estado: { type: 'string', required: true },
                detalle: {
                    type: 'string',
                    required: true,
                    dependsOn: 'estado',
                    dependency: true,
                    dependencyValue: 'activo',
                    dependencyValueValidation: true,
                    ui: { label: 'Detalle del caso' },
                },
            };

            const schema = SchemaBuilder.build(structure);
            const result = schema.validate({ estado: 'activo' }, { abortEarly: true });

            expect(result.error).toBeDefined();
            expect(result.error.details[0].message).toContain('Detalle del caso');
            expect(result.error.details[0].message.includes('detalle')).toBe(false);
        });

        it('should ignore empty or whitespace-only ui.label', () => {
            const structure = {
                x: {
                    type: 'string',
                    required: true,
                    ui: { label: '   ' },
                },
            };

            const schema = SchemaBuilder.build(structure);
            const result = schema.validate({}, { abortEarly: true });

            expect(result.error).toBeDefined();
            expect(result.error.details[0].message).toContain('x');
        });
    });

    describe('ALL validations are conditional for dependent fields', () => {
        const structure = {
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

        it('should NOT apply min/max when parent is absent', () => {
            // codigo='AB' tiene length < 5, pero como tipo no está, no debe fallar
            const errors = validateData(structure, { codigo: 'AB' });
            expect(hasFieldError(errors, 'codigo')).toBe(false);
        });

        it('should NOT apply min/max when parent has wrong value', () => {
            const errors = validateData(structure, { tipo: 'normal', codigo: 'AB' });
            expect(hasFieldError(errors, 'codigo')).toBe(false);
        });

        it('should APPLY min/max when parent has correct value', () => {
            const errors = validateData(structure, { tipo: 'especial', codigo: 'AB' });
            expect(hasFieldError(errors, 'codigo')).toBe(true);
        });

        it('should ACCEPT when parent has correct value and field meets validations', () => {
            const errors = validateData(structure, { tipo: 'especial', codigo: 'ABCDE' });
            expect(hasError(errors)).toBe(false);
        });
    });

    describe('pattern validations are conditional for dependent fields', () => {
        const structure = {
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

        it('should NOT validate email format when flag is false', () => {
            const errors = validateData(structure, { flag: false, email_contacto: 'no-es-email' });
            expect(hasFieldError(errors, 'email_contacto')).toBe(false);
        });

        it('should validate email format when flag is true', () => {
            const errors = validateData(structure, { flag: true, email_contacto: 'no-es-email' });
            expect(hasFieldError(errors, 'email_contacto')).toBe(true);
        });
    });

    describe('number validations are conditional for dependent fields', () => {
        const structure = {
            activar: { type: 'boolean', required: false },
            cantidad: {
                type: 'number',
                required: true,
                min: 1,
                max: 100,
                dependsOn: 'activar',
                dependency: true,
                dependencyValue: 'true',
                dependencyValueValidation: true,
            },
        };

        it('should NOT apply min/max when activar is false', () => {
            const errors = validateData(structure, { activar: false, cantidad: -5 });
            expect(hasFieldError(errors, 'cantidad')).toBe(false);
        });

        it('should APPLY min/max when activar is true', () => {
            const errors = validateData(structure, { activar: true, cantidad: -5 });
            expect(hasFieldError(errors, 'cantidad')).toBe(true);
        });
    });

    describe('SchemaBuilder.buildPartial', () => {
        it('should include parent field when dependent is in partialKeys', () => {
            const ds = {
                tipo: { type: 'string', required: false },
                detalle: {
                    type: 'string',
                    required: true,
                    dependsOn: 'tipo',
                    dependency: true,
                },
            };
            const partial = SchemaBuilder.buildPartial(ds, ['detalle']);
            expect(partial).toHaveProperty('tipo');
            expect(partial).toHaveProperty('detalle');
        });
    });
});

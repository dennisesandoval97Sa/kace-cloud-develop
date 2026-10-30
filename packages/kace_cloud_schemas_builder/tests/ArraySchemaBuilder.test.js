import SchemaBuilder from '../src/SchemaBuilder';

const ITEM_STRUCTURE = {
    label: { type: 'string', required: false, empty: true },
    value: { type: 'string', required: false, empty: true },
};

function buildAndValidate(dataStructure, data, options = {}) {
    const schema = SchemaBuilder.build(dataStructure);
    return schema.validate(data, { abortEarly: false, ...options });
}

function pathsInError(result) {
    return result.error?.details?.map((d) => d.path.join('.')) ?? [];
}

function messagesInError(result) {
    return result.error?.details?.map((d) => d.message) ?? [];
}

const tipoDeEventoStructure = {
    evento_catastrofico: { type: 'boolean', required: false, default: false },
    tipo_de_evento: {
        type: 'array',
        required: true,
        dependency: true,
        dependsOn: 'evento_catastrofico',
        dependencyValue: 'true',
        dependencyValueValidation: true,
        data_structure: ITEM_STRUCTURE,
    },
};

const motivoDeGuardianStructure = {
    guardian: { type: 'boolean', required: false, default: false },
    motivo_de_guardian: {
        type: 'array',
        required: true,
        dependency: true,
        dependsOn: 'guardian',
        dependencyValue: 'true',
        dependencyValueValidation: true,
        data_structure: ITEM_STRUCTURE,
    },
};

const presenceDependencyStructure = {
    referencia: { type: 'string', required: false, empty: true },
    items_relacionados: {
        type: 'array',
        required: true,
        dependency: true,
        dependsOn: 'referencia',
        dependencyValueValidation: false,
        data_structure: ITEM_STRUCTURE,
    },
};

// Mirrors the real triaje fields that caused the production bug.
const triajeStructure = {
    linea: { type: 'string', required: true, empty: false },
    evento_catastrofico: { type: 'boolean', required: false, default: false },
    tipo_de_evento: {
        type: 'array',
        required: true,
        dependency: true,
        dependsOn: 'evento_catastrofico',
        dependencyValue: 'true',
        dependencyValueValidation: true,
        data_structure: ITEM_STRUCTURE,
    },
    guardian: { type: 'boolean', required: false, default: false },
    motivo_de_guardian: {
        type: 'array',
        required: true,
        dependency: true,
        dependsOn: 'guardian',
        dependencyValue: 'true',
        dependencyValueValidation: true,
        data_structure: ITEM_STRUCTURE,
    },
};

describe('ArraySchemaBuilder - dependency handling', () => {
    describe('dependencyValueValidation: true — condition NOT met → array should be optional', () => {
        it('does NOT require tipo_de_evento when evento_catastrofico is false and array is empty', () => {
            const result = buildAndValidate(tipoDeEventoStructure, {
                evento_catastrofico: false,
                tipo_de_evento: [],
            });
            expect(result.error).toBeUndefined();
        });

        it('does NOT require tipo_de_evento when evento_catastrofico is absent', () => {
            const result = buildAndValidate(tipoDeEventoStructure, {});
            expect(result.error).toBeUndefined();
        });

        it('does NOT require tipo_de_evento when evento_catastrofico is false and array is absent', () => {
            const result = buildAndValidate(tipoDeEventoStructure, {
                evento_catastrofico: false,
            });
            expect(result.error).toBeUndefined();
        });
    });

    describe('dependencyValueValidation: true — condition MET → array should be required', () => {
        it('REQUIRES tipo_de_evento when evento_catastrofico is true and array is empty', () => {
            const result = buildAndValidate(tipoDeEventoStructure, {
                evento_catastrofico: true,
                tipo_de_evento: [],
            });
            expect(result.error).toBeDefined();
            expect(messagesInError(result)).toContain('required');
        });

        it('REQUIRES tipo_de_evento when evento_catastrofico is true and array is absent', () => {
            const result = buildAndValidate(tipoDeEventoStructure, {
                evento_catastrofico: true,
            });
            expect(result.error).toBeDefined();
        });

        it('passes when evento_catastrofico is true and tipo_de_evento has items', () => {
            const result = buildAndValidate(tipoDeEventoStructure, {
                evento_catastrofico: true,
                tipo_de_evento: [{ label: 'Terremoto', value: 'terremoto' }],
            });
            expect(result.error).toBeUndefined();
        });
    });

    describe('motivo_de_guardian — boolean parent dependency', () => {
        it('does NOT require motivo_de_guardian when guardian is false and array is empty', () => {
            const result = buildAndValidate(motivoDeGuardianStructure, {
                guardian: false,
                motivo_de_guardian: [],
            });
            expect(result.error).toBeUndefined();
        });

        it('REQUIRES motivo_de_guardian when guardian is true and array is empty', () => {
            const result = buildAndValidate(motivoDeGuardianStructure, {
                guardian: true,
                motivo_de_guardian: [],
            });
            expect(result.error).toBeDefined();
            expect(messagesInError(result)).toContain('required');
        });

        it('passes when guardian is true and motivo_de_guardian has items', () => {
            const result = buildAndValidate(motivoDeGuardianStructure, {
                guardian: true,
                motivo_de_guardian: [{ label: 'Motivo 1', value: 'motivo_1' }],
            });
            expect(result.error).toBeUndefined();
        });
    });

    describe('dependencyValueValidation: false — presence-based dependency', () => {
        it('does NOT require items_relacionados when referencia is absent', () => {
            const result = buildAndValidate(presenceDependencyStructure, {});
            expect(result.error).toBeUndefined();
        });

        it('does NOT require items_relacionados when referencia is empty string', () => {
            const result = buildAndValidate(presenceDependencyStructure, {
                referencia: '',
                items_relacionados: [],
            });
            expect(result.error).toBeUndefined();
        });

        it('REQUIRES items_relacionados when referencia has a value and array is empty', () => {
            const result = buildAndValidate(presenceDependencyStructure, {
                referencia: 'REF-001',
                items_relacionados: [],
            });
            expect(result.error).toBeDefined();
        });

        it('passes when referencia has a value and items_relacionados has items', () => {
            const result = buildAndValidate(presenceDependencyStructure, {
                referencia: 'REF-001',
                items_relacionados: [{ label: 'Item 1', value: 'item_1' }],
            });
            expect(result.error).toBeUndefined();
        });
    });

    describe('integration — full triaje payload (the original bug)', () => {
        it('passes with the exact payload that triggered the production error (both boolean parents false)', () => {
            const result = buildAndValidate(triajeStructure, {
                linea: 'RESPONSABILIDAD CIVIL',
                evento_catastrofico: false,
                tipo_de_evento: [],
                guardian: false,
                motivo_de_guardian: [],
            });
            expect(result.error).toBeUndefined();
        });

        it('produces TWO array errors when both conditions ARE met but arrays remain empty', () => {
            const result = buildAndValidate(
                triajeStructure,
                {
                    linea: 'RESPONSABILIDAD CIVIL',
                    evento_catastrofico: true,
                    tipo_de_evento: [],
                    guardian: true,
                    motivo_de_guardian: [],
                },
                { abortEarly: false }
            );
            expect(result.error).toBeDefined();
            expect(pathsInError(result)).toContain('tipo_de_evento');
            expect(pathsInError(result)).toContain('motivo_de_guardian');
            expect(result.error.details).toHaveLength(2);
        });

        it('passes when both conditions are met and arrays have items', () => {
            const result = buildAndValidate(triajeStructure, {
                linea: 'RESPONSABILIDAD CIVIL',
                evento_catastrofico: true,
                tipo_de_evento: [{ label: 'Terremoto', value: 'terremoto' }],
                guardian: true,
                motivo_de_guardian: [{ label: 'Motivo 1', value: 'motivo_1' }],
            });
            expect(result.error).toBeUndefined();
        });

        it('ui.is_visible false makes the array optional regardless of dependency condition', () => {
            const structure = {
                ...triajeStructure,
                tipo_de_evento: {
                    ...triajeStructure.tipo_de_evento,
                    ui: { is_visible: false },
                },
            };
            const result = buildAndValidate(structure, {
                linea: 'RESPONSABILIDAD CIVIL',
                evento_catastrofico: true,
                tipo_de_evento: [],
                guardian: false,
                motivo_de_guardian: [],
            });
            expect(result.error).toBeUndefined();
        });
    });

    describe('backward compatibility — non-dependent required arrays still work', () => {
        it('still requires a non-dependent required array when empty', () => {
            const structure = {
                servicios_a_prestar: {
                    type: 'array',
                    required: true,
                    dependency: false,
                    data_structure: ITEM_STRUCTURE,
                },
            };
            const result = buildAndValidate(structure, { servicios_a_prestar: [] });
            expect(result.error).toBeDefined();
            expect(messagesInError(result)).toContain('required');
        });

        it('still passes a non-dependent required array with items', () => {
            const structure = {
                servicios_a_prestar: {
                    type: 'array',
                    required: true,
                    dependency: false,
                    data_structure: ITEM_STRUCTURE,
                },
            };
            const result = buildAndValidate(structure, {
                servicios_a_prestar: [{ label: 'Servicio 1', value: 'srv_1' }],
            });
            expect(result.error).toBeUndefined();
        });

        it('optional array (required: false) passes with empty array', () => {
            const structure = {
                items: {
                    type: 'array',
                    required: false,
                    data_structure: ITEM_STRUCTURE,
                },
            };
            const result = buildAndValidate(structure, { items: [] });
            expect(result.error).toBeUndefined();
        });
    });
});

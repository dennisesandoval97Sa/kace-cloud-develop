import { VOTableName } from '../../../src/aux_definitions/domain/VOTableName.js';

describe('VOTableName', () => {
    it('debería aceptar un nombre de tabla válido de hasta 20 caracteres', () => {
        const value = 'aux_nombre_tabla_12345';
        const vo = new VOTableName(value);
        expect(vo.value).toBe(value);
    });

    it('debería lanzar error si el nombre de tabla supera los 20 caracteres', () => {
        const value = 'aux_nombre_tabla_muy_largo_que_excede_los_45_caracteres';
        expect(() => new VOTableName(value)).toThrow();
    });

    it('debería lanzar error si el nombre de tabla es nulo y no es nullable', () => {
        expect(() => new VOTableName(null)).toThrow();
    });

    it('debería lanzar un error si el nombre de tabla es nulo y es nullable', () => {
        expect(() => new VOTableName(null, true)).toThrow();
    });
});

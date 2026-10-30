import { v4 as uuidv4 } from 'uuid';
import { Board } from '../../src/boards/domain/Board.js';
import { BoardResponse } from '../../src/boards/application/BoardResponse.js';

/**
 * Unit tests for BoardResponse.toJson(), in particular the criteria-flattening
 * logic that unwraps single-key nested JSON for `aux_*`/`data` criteria items
 * (lines 17-29). Uses the real `Board` domain entity (via `Board.create`) rather
 * than a plain object double, since `toJson()` reaches into several nested
 * ValueObjects (`this.#board.id.value`, `.name.value`, etc.) that only a real
 * aggregate provides.
 */
describe('BoardResponse', () => {
    const buildBoard = (criteriaItems) =>
        Board.create({
            id: uuidv4(),
            name: 'test board',
            description: 'desc',
            primary_entity: 'cases',
            icon_class: 'BellOff',
            onescript_form_id: uuidv4(),
            created_at: new Date('2026-01-01T00:00:00.000Z'),
            created_by: uuidv4(),
            updated_at: new Date('2026-01-02T00:00:00.000Z'),
            updated_by: uuidv4(),
            criteria: { items: criteriaItems },
        });

    it('devuelve un objeto vacio cuando no hay board', () => {
        // Arrange
        const response = new BoardResponse(null);

        // Act
        const json = response.toJson();

        // Assert
        expect(json).toEqual({});
    });

    it('no toca item.value cuando el field no incluye "aux_"', () => {
        // Arrange
        const board = buildBoard([
            { entity: 'cases', field: 'estado.data', operator: 'eq', value: JSON.stringify({ a: 'x' }) },
        ]);

        // Act
        const json = new BoardResponse(board).toJson();

        // Assert: sigue siendo el string JSON crudo, no se parseo/aplano
        expect(json.data.criteria.items[0].value).toBe(JSON.stringify({ a: 'x' }));
    });

    it('no toca item.value cuando el field incluye "aux_" pero no "data"', () => {
        // Arrange
        const board = buildBoard([
            { entity: 'aux_x', field: 'aux_x.nombre', operator: 'eq', value: JSON.stringify({ a: 'x' }) },
        ]);

        // Act
        const json = new BoardResponse(board).toJson();

        // Assert
        expect(json.data.criteria.items[0].value).toBe(JSON.stringify({ a: 'x' }));
    });

    it('descarta el envoltorio de un solo nivel repetidamente hasta llegar a un valor primitivo', () => {
        // Arrange: {a: {b: {c: 'hoja'}}} tiene una sola clave en cada nivel -> el while
        // desciende 3 veces hasta el string primitivo.
        const board = buildBoard([
            {
                entity: 'aux_x',
                field: 'aux_x.data',
                operator: 'eq',
                value: JSON.stringify({ a: { b: { c: 'hoja' } } }),
            },
        ]);

        // Act
        const json = new BoardResponse(board).toJson();

        // Assert
        expect(json.data.criteria.items[0].value).toBe('hoja');
    });

    it('no desciende (rompe el while) cuando el objeto de primer nivel tiene mas de una clave', () => {
        // Arrange
        const board = buildBoard([
            {
                entity: 'aux_x',
                field: 'aux_x.data',
                operator: 'eq',
                value: JSON.stringify({ a: 1, b: 2 }),
            },
        ]);

        // Act
        const json = new BoardResponse(board).toJson();

        // Assert: se queda en el objeto de dos claves, sin descender
        expect(json.data.criteria.items[0].value).toEqual({ a: 1, b: 2 });
    });

    it('deja el valor sin cambios cuando el JSON parseado ya es un primitivo (el while nunca entra)', () => {
        // Arrange
        const board = buildBoard([
            { entity: 'aux_x', field: 'aux_x.data', operator: 'eq', value: JSON.stringify('ya-es-string') },
        ]);

        // Act
        const json = new BoardResponse(board).toJson();

        // Assert
        expect(json.data.criteria.items[0].value).toBe('ya-es-string');
    });

    it('deja el valor en null cuando el JSON parseado es null (typeof null es "object" pero el while lo excluye)', () => {
        // Arrange
        const board = buildBoard([
            { entity: 'aux_x', field: 'aux_x.data', operator: 'eq', value: JSON.stringify(null) },
        ]);

        // Act
        const json = new BoardResponse(board).toJson();

        // Assert
        expect(json.data.criteria.items[0].value).toBeNull();
    });

    it('serializa los campos planos del board ademas de la lista de criteria', () => {
        // Arrange
        const board = buildBoard([]);

        // Act
        const json = new BoardResponse(board).toJson();

        // Assert
        expect(json.data.name).toBe('test board');
        expect(json.data.primary_entity).toBe('cases');
        expect(json.data.criteria.items).toEqual([]);
    });
});

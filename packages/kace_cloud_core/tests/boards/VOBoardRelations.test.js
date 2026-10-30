import { VOBoardRelations } from '../../src/boards/domain/VOBoardRelations.js';

/**
 * `nullable` defaults to `false` in the constructor, but every production
 * caller (Board.js) passes it explicitly as `true`, so the default-parameter
 * branch is otherwise never exercised.
 */
describe('VOBoardRelations', () => {
    it('usa nullable=false por defecto y rechaza un valor vacio', () => {
        expect(() => new VOBoardRelations(null)).toThrow();
    });

    it('acepta un valor no vacio sin pasar nullable', () => {
        const relations = new VOBoardRelations([{ related_entity: 'users' }]);
        expect(relations.value).toEqual([{ related_entity: 'users' }]);
    });
});

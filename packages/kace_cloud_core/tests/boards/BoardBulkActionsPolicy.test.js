import { BoardBulkActionsPolicy } from '../../src/boards/domain/BoardBulkActionsPolicy.js';
import { Board } from '../../src/boards/domain/Board.js';
import { ValidationFailError } from '../../src/shared/index.js';
import { BOARD_BULK_ACTIONS_INCOMPATIBLE } from '@kace/error-codes';
import BoardsMother from './domain/BoardsMother.js';

describe('BoardBulkActionsPolicy', () => {
    it('allows bulk actions when board is compatible', () => {
        const dto = BoardsMother.dto({
            can_admin_bulk_actions: true,
            can_agent_bulk_actions: false,
            havings: [],
        });
        expect(() => BoardBulkActionsPolicy.validate(dto)).not.toThrow();
    });

    it('rejects bulk actions when primary_entity is not cases', () => {
        const dto = BoardsMother.dto({
            primary_entity: 'clients',
            can_admin_bulk_actions: true,
            havings: [],
        });
        expect(() => BoardBulkActionsPolicy.validate(dto)).toThrow(ValidationFailError);

        try {
            BoardBulkActionsPolicy.validate(dto);
        } catch (error) {
            expect(error.publicErrorCode).toBe(BOARD_BULK_ACTIONS_INCOMPATIBLE);
        }
    });

    it('allows bulk actions when primary_entity is a cases-like view', () => {
        const dtoEn = BoardsMother.dto({
            primary_entity: 'boards_cases_open',
            can_admin_bulk_actions: true,
            havings: [],
        });
        const dtoEs = BoardsMother.dto({
            primary_entity: 'boards_casos_abiertos',
            can_agent_bulk_actions: true,
            havings: [],
        });
        expect(() => BoardBulkActionsPolicy.validate(dtoEn)).not.toThrow();
        expect(() => BoardBulkActionsPolicy.validate(dtoEs)).not.toThrow();
    });

    it('rejects bulk actions when a board view is not cases-like', () => {
        const dto = BoardsMother.dto({
            primary_entity: 'boards_clientes',
            can_admin_bulk_actions: true,
            havings: [],
        });
        expect(() => BoardBulkActionsPolicy.validate(dto)).toThrow(ValidationFailError);
    });

    it('rejects bulk actions when a column has group_by', () => {
        const base = BoardsMother.dto({
            can_admin_bulk_actions: true,
            havings: [],
        });
        const columns = base.columns.map((column, index) => (index === 0 ? { ...column, group_by: true } : column));
        expect(() => BoardBulkActionsPolicy.validate({ ...base, columns })).toThrow(ValidationFailError);
    });

    it('rejects bulk actions when havings is non-empty', () => {
        const dto = BoardsMother.dto({
            can_admin_bulk_actions: true,
            havings: [
                {
                    entity: 'cases',
                    field: 'id',
                    function: 'count',
                    operator: 'eq',
                    value: 1,
                    type: 'having',
                },
            ],
        });
        expect(() => BoardBulkActionsPolicy.validate(dto)).toThrow(ValidationFailError);
    });

    it('does not throw on partial update dto when merged state stays compatible', () => {
        const board = Board.create(
            BoardsMother.dto({
                can_admin_bulk_actions: true,
                can_agent_bulk_actions: false,
                havings: [],
            })
        );
        expect(() =>
            BoardBulkActionsPolicy.validateForUpdate(board, {
                name: 'only name',
            })
        ).not.toThrow();
    });

    // Los 5 tests de abajo reemplazan uno solo que solo afirmaba `.not.toThrow()` con un
    // dto totalmente compatible (primary_entity 'cases', columns/havings vacios): con esos
    // valores el resultado es "no lanza" sin importar CUAL de las 5 ramas del merge
    // (dto.x !== undefined ? dto.x : board.x.value) se usara realmente, asi que un mutante
    // que ignorara el dto y usara siempre el valor del board (p.ej. `columns:
    // board.columns.value`) seguia pasando los 9 tests del archivo. Revisado y confirmado
    // por mutacion (ver el informe de la oleada). Cada test de abajo aisla UNA rama del
    // merge: fija las otras 4 en un valor donde board y dto coinciden (así su resultado no
    // importa) y hace que la rama bajo prueba sea la UNICA que puede decidir si se lanza o
    // no, para que revertirla a "usar siempre board" invierta el resultado observable.
    describe('validateForUpdate - cada rama del merge dto/board se verifica por separado', () => {
        const compatibleBoard = () =>
            Board.create(
                BoardsMother.dto({
                    primary_entity: 'cases',
                    can_admin_bulk_actions: false,
                    can_agent_bulk_actions: false,
                    havings: [],
                })
            );

        const incompatibleFlagsOffBoard = () =>
            Board.create(
                BoardsMother.dto({
                    primary_entity: 'clients',
                    can_admin_bulk_actions: false,
                    can_agent_bulk_actions: false,
                    havings: [],
                })
            );

        it('usa dto.primary_entity (no board.primary_entity.value): compatible vs "clients" del dto lanza', () => {
            const board = compatibleBoard();
            expect(() =>
                BoardBulkActionsPolicy.validateForUpdate(board, {
                    primary_entity: 'clients',
                    columns: [],
                    havings: [],
                    can_admin_bulk_actions: true,
                })
            ).toThrow(ValidationFailError);
        });

        it('usa dto.columns (no board.columns.value): una columna con group_by en el dto lanza aunque el board este limpio', () => {
            const board = compatibleBoard();
            const columnsWithGroupBy = board.columns.value.map((column, index) =>
                index === 0 ? { ...column, group_by: true } : column
            );
            expect(() =>
                BoardBulkActionsPolicy.validateForUpdate(board, {
                    primary_entity: 'cases',
                    columns: columnsWithGroupBy,
                    havings: [],
                    can_admin_bulk_actions: true,
                })
            ).toThrow(ValidationFailError);
        });

        it('usa dto.havings (no board.havings.value): un having no vacio en el dto lanza aunque el board no tenga havings', () => {
            const board = compatibleBoard();
            expect(() =>
                BoardBulkActionsPolicy.validateForUpdate(board, {
                    primary_entity: 'cases',
                    columns: [],
                    havings: [
                        {
                            entity: 'cases',
                            type: 'having',
                            field: 'id',
                            value: 1,
                            function: 'count',
                            operator: 'eq',
                        },
                    ],
                    can_admin_bulk_actions: true,
                })
            ).toThrow(ValidationFailError);
        });

        it('usa dto.can_admin_bulk_actions (no board.can_admin_bulk_actions.value): true en el dto lanza sobre un board incompatible con flags en false', () => {
            const board = incompatibleFlagsOffBoard();
            expect(() =>
                BoardBulkActionsPolicy.validateForUpdate(board, {
                    columns: [],
                    havings: [],
                    can_admin_bulk_actions: true,
                })
            ).toThrow(ValidationFailError);
        });

        it('usa dto.can_agent_bulk_actions (no board.can_agent_bulk_actions.value): true en el dto lanza sobre un board incompatible con flags en false', () => {
            const board = incompatibleFlagsOffBoard();
            expect(() =>
                BoardBulkActionsPolicy.validateForUpdate(board, {
                    columns: [],
                    havings: [],
                    can_agent_bulk_actions: true,
                })
            ).toThrow(ValidationFailError);
        });
    });

    it('evaluates merged state on partial update when toggling bulk flags', () => {
        const board = Board.create(
            BoardsMother.dto({
                primary_entity: 'clients',
                can_admin_bulk_actions: false,
                can_agent_bulk_actions: false,
                havings: [],
            })
        );
        expect(() =>
            BoardBulkActionsPolicy.validateForUpdate(board, {
                can_admin_bulk_actions: true,
            })
        ).toThrow(ValidationFailError);
    });
});

import { Board } from '../../src/boards/domain/Board.js';
import { QUICK_ANS_FILTER_DEFAULT_VALUE } from '../../src/boards/domain/QuickAnsFilterDefaults.js';
import BoardsMother from './domain/BoardsMother.js';

const baseColumn = {
    entity: 'cases',
    field: 'sla',
    position: 0,
    data_type: 'STRING',
};

describe('Board.columns setter reconciles quick_ans_filter', () => {
    const buildBoard = (filter) =>
        Board.create({
            ...BoardsMother.dto({
                columns: [{ ...baseColumn, alias: 'sla_status', is_ans: true }],
            }),
            quick_ans_filter: filter,
        });

    it('resets filter when the referenced column is removed', () => {
        const board = buildBoard({
            enabled: true,
            ans_column_alias: 'sla_status',
            labels: { 1: 'a', 2: 'b', 3: 'c' },
            use_default_colors: true,
            colors: { 1: '', 2: '', 3: '' },
        });
        board.columns = [{ ...baseColumn, alias: 'other_col', is_ans: false }];
        expect(board.quick_ans_filter.value).toEqual(QUICK_ANS_FILTER_DEFAULT_VALUE);
        expect(board.changedAttributes.quick_ans_filter).toEqual(QUICK_ANS_FILTER_DEFAULT_VALUE);
    });

    it('resets filter when the referenced column loses is_ans flag', () => {
        const board = buildBoard({
            enabled: true,
            ans_column_alias: 'sla_status',
            labels: { 1: 'a', 2: 'b', 3: 'c' },
            use_default_colors: true,
            colors: { 1: '', 2: '', 3: '' },
        });
        board.columns = [{ ...baseColumn, alias: 'sla_status', is_ans: false }];
        expect(board.quick_ans_filter.value).toEqual(QUICK_ANS_FILTER_DEFAULT_VALUE);
    });

    it('keeps the filter when the referenced column still exists with is_ans=true', () => {
        const filter = {
            enabled: true,
            ans_column_alias: 'sla_status',
            labels: { 1: 'a', 2: 'b', 3: 'c' },
            use_default_colors: true,
            colors: { 1: '', 2: '', 3: '' },
        };
        const board = buildBoard(filter);
        board.columns = [
            { ...baseColumn, alias: 'sla_status', is_ans: true },
            { ...baseColumn, field: 'name', alias: 'name_col', is_ans: false, position: 1 },
        ];
        expect(board.quick_ans_filter.value.enabled).toBe(true);
        expect(board.quick_ans_filter.value.ans_column_alias).toBe('sla_status');
    });

    it('does nothing when filter is disabled', () => {
        const board = buildBoard({
            enabled: false,
            ans_column_alias: 'sla_status',
            labels: { 1: '', 2: '', 3: '' },
            use_default_colors: true,
            colors: { 1: '', 2: '', 3: '' },
        });
        board.columns = [{ ...baseColumn, alias: 'other', is_ans: true }];
        expect(board.quick_ans_filter.value.enabled).toBe(false);
        expect(board.changedAttributes.quick_ans_filter).toBeUndefined();
    });
});

import { VOBoardQuickAnsFilter } from '../../src/boards/domain/VOBoardQuickAnsFilter.js';
import { QUICK_ANS_FILTER_DEFAULT_VALUE } from '../../src/boards/domain/QuickAnsFilterDefaults.js';

describe('VOBoardQuickAnsFilter', () => {
    it('returns default value when constructed with null', () => {
        const vo = new VOBoardQuickAnsFilter(null);
        expect(vo.value).toEqual(QUICK_ANS_FILTER_DEFAULT_VALUE);
    });

    it('returns default value when constructed with undefined', () => {
        const vo = new VOBoardQuickAnsFilter(undefined);
        expect(vo.value).toEqual(QUICK_ANS_FILTER_DEFAULT_VALUE);
    });

    it('parses a JSON string value', () => {
        const vo = new VOBoardQuickAnsFilter(JSON.stringify({ enabled: false }));
        expect(vo.value.enabled).toBe(false);
    });

    it('rejects unknown top-level keys', () => {
        expect(() => new VOBoardQuickAnsFilter({ foo: 'bar' })).toThrow(/unknown key/i);
    });

    it('rejects non-boolean enabled', () => {
        expect(() => new VOBoardQuickAnsFilter({ enabled: 'yes' })).toThrow(/enabled/);
    });

    it('rejects unknown level keys in labels', () => {
        expect(() => new VOBoardQuickAnsFilter({ labels: { 4: 'x' } })).toThrow(/labels/);
    });

    it('rejects non-string label values', () => {
        expect(() => new VOBoardQuickAnsFilter({ labels: { 1: 123 } })).toThrow(/labels\.1/);
    });

    it('rejects array as labels', () => {
        expect(() => new VOBoardQuickAnsFilter({ labels: ['a', 'b'] })).toThrow(/labels/);
    });

    it('forces colors empty when use_default_colors=true', () => {
        const vo = new VOBoardQuickAnsFilter({
            enabled: true,
            ans_column_alias: 'sla',
            use_default_colors: true,
            colors: { 1: '#ffffff', 2: '#000000', 3: '#aabbcc' },
            labels: { 1: 'a', 2: 'b', 3: 'c' },
        });
        expect(vo.value.colors).toEqual({ 1: '', 2: '', 3: '' });
    });

    it('keeps colors when use_default_colors=false', () => {
        const vo = new VOBoardQuickAnsFilter({
            enabled: true,
            ans_column_alias: 'sla',
            use_default_colors: false,
            colors: { 1: '#ffffff', 2: '#000000', 3: '#aabbcc' },
            labels: { 1: 'a', 2: 'b', 3: 'c' },
        });
        expect(vo.value.colors).toEqual({ 1: '#ffffff', 2: '#000000', 3: '#aabbcc' });
    });
});

import { DataStructureLabelService } from '../../src/schemas/domain/DataStructureLabelService.js';

describe('DataStructureLabelService', () => {
    it('does not replace ui.label when it is an empty string', () => {
        const dataStructure = {
            campo_number: {
                type: 'number',
                required: false,
                ui: { label: '', input_type: 'currency' },
            },
        };
        DataStructureLabelService.assignDefaultLabels(dataStructure);
        expect(dataStructure.campo_number.ui.label).toBe('');
    });

    it('sets ui.label to empty string when label is missing on ui', () => {
        const dataStructure = {
            suma_total: {
                type: 'calculated',
                ui: { input_type: 'number' },
            },
        };
        DataStructureLabelService.assignDefaultLabels(dataStructure);
        expect(dataStructure.suma_total.ui.label).toBe('');
    });

    it('creates ui with empty label when ui was absent', () => {
        const dataStructure = {
            valor1: { type: 'string', required: true },
        };
        DataStructureLabelService.assignDefaultLabels(dataStructure);
        expect(dataStructure.valor1.ui).toEqual({ label: '' });
    });
});

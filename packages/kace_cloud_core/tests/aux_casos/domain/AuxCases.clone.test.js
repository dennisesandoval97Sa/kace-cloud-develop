import { v4 as uuidv4 } from 'uuid';
import { AuxCases } from '../../../src/aux_casos/index.js';
import { AuxCasesMother } from './AuxCasesMother.js';

describe('AuxCases.clone', () => {
    it('copies the data into a new aux case bound to the cloned case', () => {
        const original = AuxCases.create(AuxCasesMother.dto({ created_at: new Date('2020-01-01T00:00:00Z') }));
        const id = uuidv4();
        const casoId = uuidv4();
        const createdBy = uuidv4();
        const cloneStartedAt = Date.now();

        const clone = original.clone(id, casoId, createdBy);

        expect(clone.id.value).toBe(id);
        expect(clone.caso_id.value).toBe(casoId);
        expect(clone.created_by.value).toBe(createdBy);
        expect(Date.parse(clone.created_at.value)).toBeGreaterThanOrEqual(cloneStartedAt);
        expect(clone.created_at.value).not.toEqual(original.created_at.value);
        expect(clone.data.value).toEqual(original.data.value);
    });

    it('does not share the data reference with the original', () => {
        const original = AuxCases.create(AuxCasesMother.dto());

        const clone = original.clone(uuidv4(), uuidv4(), uuidv4());
        clone.data.value.progreso.inicio = false;

        expect(original.data.value.progreso.inicio).toBe(true);
    });

    it('leaves out the values of unique fields', () => {
        const original = AuxCases.create(AuxCasesMother.dto());
        const dataStructure = { numero_pedido: { type: 'string', unique: true } };

        const clone = original.clone(uuidv4(), uuidv4(), uuidv4(), dataStructure);

        expect(clone.data.value).not.toHaveProperty('numero_pedido');
        expect(clone.data.value.canal_contacto).toBe(original.data.value.canal_contacto);
        expect(original.data.value.numero_pedido).toBe('123456');
    });
});

import { knexConfig } from '../../../knexfile.js';
import { CaseFinder, KnexCaseRepository } from '../../../../src/cases';
import CasesMother from '../../../cases/domain/CasesMother';

describe('CaseFinder — oversized aux trimming', () => {
    const repository = new KnexCaseRepository(knexConfig);
    const userWithId = (id) => ({ id: { value: id } });

    it('truncates an oversized aux field and keeps the case readable', async () => {
        const kase = await CasesMother.createCaseWithRelations(repository);
        const novedades = Array.from({ length: 60000 }, (_, i) => ({ n: i, msg: 'novedad '.repeat(10) }));
        const bigAux = { asistencia_movilidad: { novedades_asistencia_movilidad: novedades }, placa: 'ABC123' };
        await repository
            .connection('aux_cases')
            .where({ caso_id: kase.id.value })
            .update({ data: JSON.stringify(bigAux) });

        const response = await new CaseFinder(
            repository,
            userWithId(kase.responsable_id.value)
        ).executeWithAllRelations(kase.id.value);
        const data = response.toJson().data;

        expect(data.id).toBe(kase.id.value);
        expect(data.aux_case.data.asistencia_movilidad.novedades_asistencia_movilidad._truncated).toBe(true);
        expect(data.aux_case.data.placa).toBe('ABC123');
        expect(data.aux_case._truncated[0].path).toBe('asistencia_movilidad.novedades_asistencia_movilidad');
    });

    it('leaves a normal-sized aux untouched (no _truncated marker)', async () => {
        const kase = await CasesMother.createCaseWithRelations(repository);
        await repository
            .connection('aux_cases')
            .where({ caso_id: kase.id.value })
            .update({ data: JSON.stringify({ placa: 'XYZ' }) });

        const response = await new CaseFinder(
            repository,
            userWithId(kase.responsable_id.value)
        ).executeWithAllRelations(kase.id.value);
        const data = response.toJson().data;

        expect(data.aux_case._truncated).toBeUndefined();
    });
});

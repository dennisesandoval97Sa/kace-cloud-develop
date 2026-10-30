import { jest } from '@jest/globals';
import { CaseFolioResolver } from '../../src/cases/application/folio/CaseFolioResolver.js';
import { FolioConfiguration } from '../../src/folio-configurations/domain/FolioConfiguration.js';
import { FolioSegmentError } from '../../src/folio-configurations/domain/FolioSegmentError.js';
import { FolioConfigurationMother } from './domain/FolioConfigurationMother.js';

const SEGMENTS = [
    { type: 'literal', value: 'RAD-' },
    { type: 'field', path: 'aux_cases.f.canal' },
    { type: 'literal', value: '-' },
    { type: 'sequence', length: 4, pad_char: '0' },
];

/**
 * In-memory counter. `taken(folio, inTransaction)` says whether a folio already exists; the
 * second argument tells the probe and skipTaken (committed reads) from the check the
 * resolver makes inside the case transaction.
 */
function buildResolver({ taken = () => false, overflowPolicy = 'fail' } = {}) {
    const configuration = FolioConfiguration.create(
        FolioConfigurationMother.dto({ segments: SEGMENTS, start_value: 1, overflow_policy: overflowPolicy })
    );
    let counter = 0;
    const sequenceRepository = {
        currentValue: jest.fn(async () => (counter === 0 ? null : counter)),
        skipTaken: jest.fn(async ({ render }) => {
            const before = counter;
            while (taken(render(counter + 1), false)) counter += 1;
            return counter - before;
        }),
        reserveNext: jest.fn(async () => {
            counter += 1;
            return counter;
        }),
        isFolioTaken: jest.fn(async (folio, trx) => taken(folio, Boolean(trx))),
    };
    const configurationRepository = {
        findByClassificationId: jest.fn(async () => ({ configuration, classification: {} })),
    };
    return { resolver: new CaseFolioResolver(configurationRepository, sequenceRepository), sequenceRepository };
}

const execute = (resolver, canal = 'W') =>
    resolver.execute({ classificationId: 'cls', caseDto: {}, auxData: { f: { canal } }, trx: {} });

describe('CaseFolioResolver', () => {
    it('sin folios ocupados reserva directamente, sin bloquear el contador para saltar', async () => {
        const { resolver, sequenceRepository } = buildResolver();

        await expect(execute(resolver)).resolves.toBe('RAD-W-0001');
        expect(sequenceRepository.skipTaken).not.toHaveBeenCalled();
        expect(sequenceRepository.reserveNext).toHaveBeenCalledTimes(1);
    });

    it('salta en una transacción propia una racha de folios ocupados más larga que los intentos', async () => {
        const occupied = new Set(Array.from({ length: 8 }, (_, i) => `RAD-W-000${i + 1}`));
        const { resolver, sequenceRepository } = buildResolver({ taken: (folio) => occupied.has(folio) });

        await expect(execute(resolver)).resolves.toBe('RAD-W-0009');
        expect(sequenceRepository.skipTaken).toHaveBeenCalledTimes(1);
        expect(sequenceRepository.reserveNext).toHaveBeenCalledTimes(1);
    });

    it('el render que recibe skipTaken devuelve null al desbordar la máscara', async () => {
        const { resolver, sequenceRepository } = buildResolver({ taken: (folio) => folio === 'RAD-W-0001' });

        await execute(resolver);
        const { render } = sequenceRepository.skipTaken.mock.calls[0][0];

        expect(render(10000)).toBeNull();
        expect(render(12)).toBe('RAD-W-0012');
    });

    it('dentro de la transacción salta el folio que otra creación ocupó entretanto', async () => {
        const { resolver, sequenceRepository } = buildResolver({
            taken: (folio, inTransaction) => inTransaction && folio === 'RAD-W-0001',
        });

        await expect(execute(resolver)).resolves.toBe('RAD-W-0002');
        expect(sequenceRepository.reserveNext).toHaveBeenCalledTimes(2);
    });

    it('responde 409 cuando agota los intentos dentro de la transacción', async () => {
        const { resolver, sequenceRepository } = buildResolver({ taken: (_, inTransaction) => inTransaction });

        const error = await execute(resolver).catch((caught) => caught);

        expect(error.statusCode).toBe(409);
        expect(sequenceRepository.reserveNext).toHaveBeenCalledTimes(5);
    });

    it('rechaza un folio más ancho que la columna sin reservar consecutivo', async () => {
        const { resolver, sequenceRepository } = buildResolver();

        await expect(execute(resolver, 'x'.repeat(95))).rejects.toThrow(FolioSegmentError);
        expect(sequenceRepository.reserveNext).not.toHaveBeenCalled();
        expect(sequenceRepository.skipTaken).not.toHaveBeenCalled();
    });

    it('con overflow_policy "grow" cuenta el ancho al que puede crecer el consecutivo', async () => {
        // 'RAD-' + 88 + '-' + 4 cabe en 100; con los 10 dígitos que puede alcanzar el contador, no.
        const fail = buildResolver();
        const grow = buildResolver({ overflowPolicy: 'grow' });

        await expect(execute(fail.resolver, 'x'.repeat(88))).resolves.toBe(`RAD-${'x'.repeat(88)}-0001`);
        await expect(execute(grow.resolver, 'x'.repeat(88))).rejects.toThrow(FolioSegmentError);
        expect(grow.sequenceRepository.reserveNext).not.toHaveBeenCalled();
    });
});

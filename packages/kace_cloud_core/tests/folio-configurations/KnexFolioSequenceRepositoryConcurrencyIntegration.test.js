import Knex from 'knex';
import { buildWriterConfig } from '../knexfile.js';
import { KnexFolioSequenceRepository } from '../../src/folio-configurations/infrastructure/KnexFolioSequenceRepository.js';
import { CaseFolioResolver } from '../../src/cases/application/folio/CaseFolioResolver.js';
import { FolioConfiguration } from '../../src/folio-configurations/domain/FolioConfiguration.js';
import { FolioConfigurationMother } from './domain/FolioConfigurationMother.js';

/**
 * The whole no-duplicates guarantee rests on this file. It runs against the real Postgres
 * database of this test file and with a pool wider than one connection, otherwise the
 * transactions would queue at the pool instead of at the row and the test would pass
 * without proving anything. Hence its own pool instead of the shared `knexConfig` (max 5).
 */
const writerConfig = buildWriterConfig();
const knexConfig = Knex({ ...writerConfig, pool: { min: 2, max: 20 } });
knexConfig.config = { ...writerConfig, pool: { min: 2, max: 20 } };

const CONFIG_ID = 'cfg-concurrency-0000000000000000001';

afterAll(async () => {
    await knexConfig.destroy();
});

describe('KnexFolioSequenceRepository — reserva concurrente del consecutivo', () => {
    const repository = new KnexFolioSequenceRepository(knexConfig);

    beforeEach(async () => {
        await knexConfig.raw('TRUNCATE TABLE public.folio_sequences CASCADE');
    });

    it('reparte números distintos y contiguos a 50 transacciones simultáneas', async () => {
        const total = 50;
        const startValue = 50;

        const reserved = await Promise.all(
            Array.from({ length: total }, () =>
                knexConfig.transaction((trx) =>
                    repository.reserveNext({ configId: CONFIG_ID, scopeKey: '', startValue, trx })
                )
            )
        );

        expect(new Set(reserved).size).toBe(total);
        expect([...reserved].sort((a, b) => a - b)).toEqual(Array.from({ length: total }, (_, i) => startValue + i));
    });

    it('el primer número entregado es exactamente el start_value configurado', async () => {
        const first = await knexConfig.transaction((trx) =>
            repository.reserveNext({ configId: CONFIG_ID, scopeKey: '', startValue: 50, trx })
        );

        expect(first).toBe(50);
    });

    it('devuelve el número al hacer rollback, sin dejar huecos', async () => {
        await knexConfig.transaction((trx) =>
            repository.reserveNext({ configId: CONFIG_ID, scopeKey: '', startValue: 50, trx })
        );
        const before = await repository.peek(CONFIG_ID, '');

        await expect(
            knexConfig.transaction(async (trx) => {
                await repository.reserveNext({ configId: CONFIG_ID, scopeKey: '', startValue: 50, trx });
                throw new Error('fallo posterior a la reserva');
            })
        ).rejects.toThrow('fallo posterior a la reserva');

        expect(await repository.peek(CONFIG_ID, '')).toBe(before);

        const next = await knexConfig.transaction((trx) =>
            repository.reserveNext({ configId: CONFIG_ID, scopeKey: '', startValue: 50, trx })
        );
        expect(next).toBe(before + 1);
    });

    it('mantiene contadores independientes por scope_key', async () => {
        const a = await knexConfig.transaction((trx) =>
            repository.reserveNext({ configId: CONFIG_ID, scopeKey: '2026', startValue: 1, trx })
        );
        const b = await knexConfig.transaction((trx) =>
            repository.reserveNext({ configId: CONFIG_ID, scopeKey: '2027', startValue: 1, trx })
        );

        expect(a).toBe(1);
        expect(b).toBe(1);
    });

    it('peek no consume consecutivo', async () => {
        await knexConfig.transaction((trx) =>
            repository.reserveNext({ configId: CONFIG_ID, scopeKey: '', startValue: 50, trx })
        );

        expect(await repository.peek(CONFIG_ID, '')).toBe(50);
        expect(await repository.peek(CONFIG_ID, '')).toBe(50);
    });

    it('peek devuelve null cuando el contador aún no existe', async () => {
        expect(await repository.peek('cfg-inexistente', '')).toBeNull();
    });

    it('devuelve el lock_timeout de la transacción del caso a su valor tras reservar', async () => {
        const after = await knexConfig.transaction(async (trx) => {
            await trx.raw("SELECT set_config('lock_timeout', '7s', true)");
            await repository.reserveNext({ configId: CONFIG_ID, scopeKey: '', startValue: 1, trx });
            const { rows } = await trx.raw('SHOW lock_timeout');
            return rows[0].lock_timeout;
        });

        expect(after).toBe('7s');
    });

    /*
     * La fila todavía no existe: la segunda transacción se queda esperando en la siembra
     * (INSERT ... ON CONFLICT) a que la primera confirme. El lock_timeout tiene que regir ya
     * ahí, o la espera no tiene tope y nunca se devuelve el 409.
     */
    it('responde 409 dentro del lock_timeout cuando otra transacción retiene el contador', async () => {
        let releaseFirst;
        const holding = new Promise((resolve) => {
            releaseFirst = resolve;
        });
        let firstReserved;
        const reservedSignal = new Promise((resolve) => {
            firstReserved = resolve;
        });

        const first = knexConfig.transaction(async (trx) => {
            await repository.reserveNext({ configId: CONFIG_ID, scopeKey: '', startValue: 1, trx });
            firstReserved();
            await holding;
        });

        await reservedSignal;
        const startedAt = Date.now();
        const second = knexConfig.transaction((trx) =>
            repository.reserveNext({ configId: CONFIG_ID, scopeKey: '', startValue: 1, trx })
        );

        const error = await second.catch((caught) => caught);
        expect(error.statusCode).toBe(409);
        expect(Date.now() - startedAt).toBeLessThan(5000);

        releaseFirst();
        await first;
    });
});

/**
 * Folios already on a case, without building the cases: what skipTaken and the resolver
 * need from `cases` is whether a folio exists.
 */
class SequenceRepositoryWithTakenFolios extends KnexFolioSequenceRepository {
    constructor(config, taken) {
        super(config);
        this.taken = taken;
    }

    async isFolioTaken(folio) {
        return this.taken.has(folio);
    }
}

describe('Salto confirmado de folios ocupados', () => {
    const SKIP_CONFIG_ID = 'cfg-skip-taken-000000000000000000001';
    const render = (value) => `RAD-${String(value).padStart(4, '0')}`;
    /** Ocho seguidos: más que los 5 intentos que el resolver hace dentro de su transacción. */
    const taken = new Set(Array.from({ length: 8 }, (_, i) => render(i + 1)));
    const repository = new SequenceRepositoryWithTakenFolios(knexConfig, taken);

    beforeEach(async () => {
        await knexConfig.raw('TRUNCATE TABLE public.folio_sequences CASCADE');
    });

    it('confirma el salto: un rollback posterior del caso no lo deshace', async () => {
        const skipped = await repository.skipTaken({ configId: SKIP_CONFIG_ID, scopeKey: '', startValue: 1, render });
        expect(skipped).toBe(8);

        await expect(
            knexConfig.transaction(async (trx) => {
                await repository.reserveNext({ configId: SKIP_CONFIG_ID, scopeKey: '', startValue: 1, trx });
                throw new Error('fallo del caso');
            })
        ).rejects.toThrow('fallo del caso');

        expect(await repository.currentValue(SKIP_CONFIG_ID, '')).toBe(8);
    });

    it('deja de saltar cuando el consecutivo ya no cabe en la máscara', async () => {
        const skipped = await repository.skipTaken({
            configId: SKIP_CONFIG_ID,
            scopeKey: '',
            startValue: 1,
            render: (value) => (value > 3 ? null : render(value)),
        });

        expect(skipped).toBe(3);
    });

    it('con más de 5 folios ocupados seguidos, creaciones sucesivas obtienen folio aunque una haga rollback', async () => {
        const configuration = FolioConfiguration.create(
            FolioConfigurationMother.dto({
                segments: [
                    { type: 'literal', value: 'RAD-' },
                    { type: 'sequence', length: 4, pad_char: '0' },
                ],
                start_value: 1,
            })
        );
        const resolver = new CaseFolioResolver(
            { findByClassificationId: async () => ({ configuration, classification: {} }) },
            repository
        );
        const execute = (trx) => resolver.execute({ classificationId: 'cls', caseDto: {}, auxData: {}, trx });

        await expect(
            knexConfig.transaction(async (trx) => {
                expect(await execute(trx)).toBe('RAD-0009');
                throw new Error('fallo del caso');
            })
        ).rejects.toThrow('fallo del caso');

        expect(await knexConfig.transaction((trx) => execute(trx))).toBe('RAD-0009');
    });
});

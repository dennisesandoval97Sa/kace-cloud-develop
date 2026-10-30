import { FolioConfiguration } from '../../src/folio-configurations/domain/FolioConfiguration.js';
import { FolioUniquenessPolicy } from '../../src/folio-configurations/domain/FolioUniquenessPolicy.js';
import { SegmentRenderer } from '../../src/folio-configurations/domain/segments/SegmentRenderer.js';
import { FolioConfigurationMother } from './domain/FolioConfigurationMother.js';

const literal = (value) => ({ type: 'literal', value });
const date = (format) => ({ type: 'date', format });
const field = (path = 'aux_cases.f.x') => ({ type: 'field', path });
const sequence = (length = 3, pad_char = '0') => ({ type: 'sequence', length, pad_char });

const DATES = [
    { Y: '2026', M: '01', D: '05' },
    { Y: '2027', M: '01', D: '05' },
    { Y: '2026', M: '02', D: '05' },
    { Y: '2026', M: '01', D: '06' },
    { Y: '2026', M: '11', D: '15' },
];
const NUMBERS = [0, 1, 5, 10, 12, 23, 34, 99, 100, 995, 1000, 9995];
const FIELD_VALUES = ['1', '12', '5', '05', 'A', '-', 'A-1', '2026', '26', 'A26', '27A', 'A12', '34-'];

const renderDate = (format, { Y, M, D }) =>
    ({
        YYYY: Y,
        YY: Y.slice(2),
        MM: M,
        M: String(Number(M)),
        DD: D,
        D: String(Number(D)),
        YYYYMM: Y + M,
        YYMM: Y.slice(2) + M,
        YYYYMMDD: Y + M + D,
        YYMMDD: Y.slice(2) + M + D,
        MMDD: M + D,
    })[format] ?? '00';

/** Every (scope, n, field values) a configuration can issue, with the folio it renders. */
function issuances({ segments, reset_policy, overflow_policy }) {
    const paths = [...new Set(segments.filter((segment) => segment.type === 'field').map((segment) => segment.path))];
    const fieldCombos = paths.reduce(
        (combos, path) => combos.flatMap((combo) => FIELD_VALUES.map((value) => ({ ...combo, [path]: value }))),
        [{}]
    );
    const sequenceIndex = segments.findIndex((segment) => segment.type === 'sequence');
    const result = [];

    for (const dates of DATES) {
        for (const fields of fieldCombos) {
            const parts = segments.map((segment) => {
                if (segment.type === 'literal') return segment.value;
                if (segment.type === 'date') return renderDate(segment.format, dates);
                if (segment.type === 'field') return fields[segment.path];
                return null;
            });
            const prefix = parts.slice(0, sequenceIndex).join('');
            const scope = {
                never: '',
                yearly: dates.Y,
                monthly: `${dates.Y}-${dates.M}`,
                daily: `${dates.Y}-${dates.M}-${dates.D}`,
                prefix,
            }[reset_policy];

            for (const n of NUMBERS) {
                let text;
                try {
                    text = SegmentRenderer.formatSequence(segments[sequenceIndex], sequenceIndex, n, overflow_policy);
                } catch {
                    continue;
                }
                const folio = parts.map((part, index) => (index === sequenceIndex ? text : part)).join('');
                result.push({ folio, issuance: `${scope}#${n}` });
            }
        }
    }
    return result;
}

/** A folio rendered by two different (counter scope, n) pairs, or null. */
function findCollision(config) {
    const seen = new Map();
    for (const { folio, issuance } of issuances(config)) {
        const previous = seen.get(folio);
        if (previous !== undefined && previous !== issuance) return { folio, previous, issuance };
        seen.set(folio, issuance);
    }
    return null;
}

const config = (segments, reset_policy = 'never', overflow_policy = 'fail') => ({
    segments,
    reset_policy,
    overflow_policy,
    start_value: 0,
});

const build = (draft) => FolioConfiguration.create(FolioConfigurationMother.dto(draft));

describe('FolioUniquenessPolicy', () => {
    /*
     * Las cuatro fuentes de colisión del review de folio-1-api. Cada configuración colisiona
     * de verdad (se comprueba renderizando), así que estos tests fallan sin la validación.
     */
    describe.each([
        ['pad_char con un dígito distinto de 0', config([literal('R-'), sequence(4, '9')]), /pad_char/],
        ['reinicio anual sin año en el folio', config([literal('RAD-'), sequence(3)], 'yearly'), /reset_policy/],
        ['reinicio diario con solo año y mes', config([date('YYYYMM'), sequence(3)], 'daily'), /reset_policy/],
        [
            'año entre campos, sin posición fija',
            config([field('aux_cases.f.x'), date('YY'), field('aux_cases.f.y'), sequence(3)], 'yearly'),
            /reset_policy/,
        ],
        ['consecutivo grow pegado a un campo', config([sequence(2), field()], 'never', 'grow'), /overflow_policy/],
        [
            'campos a ambos lados del consecutivo',
            config([literal('X'), field('aux_cases.f.x'), sequence(2), field('aux_cases.f.y')]),
            /segments/,
        ],
    ])('rechaza: %s', (_, draft, message) => {
        it('la configuración de verdad colisiona', () => {
            expect(findCollision(draft)).not.toBeNull();
        });

        it('al crear', () => {
            expect(() => build(draft)).toThrow(message);
        });

        it('al actualizar una configuración válida', () => {
            const configuration = build(config([literal('OK-'), sequence(3)]));
            expect(() => configuration.update(draft)).toThrow(message);
        });
    });

    it.each([
        ['el ejemplo del enunciado', config([literal('5'), date('YY'), field(), sequence(4)])],
        [
            'prefijo fijo con año y reinicio anual',
            config([literal('PQR-'), date('YYYY'), literal('-'), sequence(3)], 'yearly'),
        ],
        ['año al principio y campo delante del consecutivo', config([date('YY'), field(), sequence(3)], 'yearly')],
        ['fecha completa y reinicio diario', config([date('YYYYMMDD'), field(), sequence(3)], 'daily')],
        ['año y mes por separado', config([literal('R'), date('YYYY'), date('MM'), sequence(3)], 'monthly')],
        ['grow delimitado por un texto fijo', config([field(), literal('-'), sequence(2)], 'never', 'grow')],
        ['grow al final con prefijo fijo', config([literal('R'), sequence(2)], 'never', 'grow')],
        ['reinicio por prefijo con un campo delante', config([field(), literal('-'), sequence(3)], 'prefix')],
        ['relleno con un carácter no numérico', config([literal('R'), sequence(3, '*')])],
    ])('acepta y nunca colisiona: %s', (_, draft) => {
        expect(() => build(draft)).not.toThrow();
        expect(findCollision(draft)).toBeNull();
    });
});

/** Folios a layout renders, at every consecutive width it has issued with. */
function renderedFolios({ segments, overflowPolicy = 'fail', minIssuedLength = null }) {
    const sequence = segments.find((segment) => segment.type === 'sequence');
    const folios = new Set();
    for (let width = minIssuedLength ?? sequence.length; width <= sequence.length; width += 1) {
        const atWidth = segments.map((segment) => (segment === sequence ? { ...segment, length: width } : segment));
        issuances(config(atWidth, 'never', overflowPolicy)).forEach(({ folio }) => folios.add(folio));
    }
    return folios;
}

const layout = (segments, extra = {}) => ({ segments, ...extra });

describe('FolioUniquenessPolicy.overlaps — entre configuraciones', () => {
    /*
     * Casos b–d del review de la ronda 4 de folio-1-api, y sus vecinos que no chocan. Cada fila
     * se comprueba renderizando: hay un folio común si y solo si overlaps dice que sí.
     */
    it.each([
        [
            'b: RAD- + 4 dígitos frente a RAD-0 + 3',
            layout([literal('RAD-'), sequence(4)]),
            layout([literal('RAD-0'), sequence(3)]),
            true,
        ],
        [
            'c: año YYYY frente al literal 2026',
            layout([date('YYYY'), literal('-'), sequence(4)]),
            layout([literal('2026-'), sequence(4)]),
            true,
        ],
        [
            'grow que alcanza el ancho de la otra',
            layout([literal('R-'), sequence(3)], { overflowPolicy: 'grow' }),
            layout([literal('R-'), sequence(4)]),
            true,
        ],
        [
            'una que ya emitió con un consecutivo más estrecho',
            layout([literal('X-'), sequence(4)], { minIssuedLength: 3 }),
            layout([literal('X-'), sequence(3)]),
            true,
        ],
        [
            'M sin cero frente a dos dígitos',
            layout([literal('M'), date('M'), sequence(3)]),
            layout([literal('M1'), sequence(4)]),
            true,
        ],
        ['literales distintos', layout([literal('A-'), sequence(3)]), layout([literal('B-'), sequence(3)]), false],
        [
            'mismo prefijo y distinto ancho fijo',
            layout([literal('RAD-'), sequence(4)]),
            layout([literal('RAD-'), sequence(3)]),
            false,
        ],
        [
            'la misma, si nunca emitió con el consecutivo estrecho',
            layout([literal('X-'), sequence(4)]),
            layout([literal('X-'), sequence(3)]),
            false,
        ],
        ['año frente a texto', layout([date('YY'), sequence(3)]), layout([literal('AB'), sequence(3)]), false],
        [
            'relleno no numérico frente a un dígito fijo',
            layout([literal('R'), sequence(3, '*')]),
            layout([literal('R*1'), sequence(1)]),
            true,
        ],
    ])('%s → %s', (_, a, b, expected) => {
        const left = renderedFolios(a);
        const shared = [...renderedFolios(b)].some((folio) => left.has(folio));

        expect(shared).toBe(expected);
        expect(FolioUniquenessPolicy.overlaps(a, b)).toBe(expected);
        expect(FolioUniquenessPolicy.overlaps(b, a)).toBe(expected);
    });

    describe('con campos, que pueden renderizar cualquier cosa', () => {
        it('detecta la gemela con la misma estructura', () => {
            expect(
                FolioUniquenessPolicy.overlaps(
                    layout([field('aux_cases.a.b'), literal('-'), sequence(3)]),
                    layout([field('cases.external_code'), literal('-'), sequence(3)])
                )
            ).toBe(true);
        });

        it('trata igual dos literales partidos que uno entero', () => {
            expect(
                FolioUniquenessPolicy.overlaps(
                    layout([literal('RA'), literal('D-'), field(), sequence(4)]),
                    layout([literal('RAD-'), field(), sequence(4)])
                )
            ).toBe(true);
        });

        it('deja pasar un literal distinto: lo cubre el salto de folios ocupados', () => {
            expect(
                FolioUniquenessPolicy.overlaps(
                    layout([literal('A-'), field(), sequence(3)]),
                    layout([literal('B-'), field(), sequence(3)])
                )
            ).toBe(false);
        });
    });
});

describe('FolioConfiguration — invariantes por create y por update', () => {
    const valid = () => build(config([literal('OK-'), sequence(3)]));

    it.each([
        [
            'prefix sin nada delante del consecutivo',
            { segments: [sequence(3), literal('-X')], reset_policy: 'prefix' },
            /prefix/,
        ],
        ['start_value que no cabe en el consecutivo', { start_value: 5000 }, /start_value/],
        ['start_value por encima de int4', { start_value: 5e9 }, /start_value/],
        ['consecutivo de más de 9 dígitos', { segments: [literal('R'), sequence(10)] }, /length/],
        [
            'ruta de clients, que no se carga al crear',
            { segments: [field('clients.nombres'), literal('-'), sequence(3)] },
            /ruta/,
        ],
        ['ruta de estados', { segments: [field('estados.nombre'), literal('-'), sequence(3)] }, /ruta/],
        ['formato de trimestre (Q)', { segments: [date('Q'), sequence(3)] }, /formato/],
        ['formato de día del año (DDD)', { segments: [date('DDD'), sequence(3)] }, /formato/],
        ['formato de semana (WW)', { segments: [date('WW'), sequence(3)] }, /formato/],
    ])('rechaza %s', (_, changes, message) => {
        expect(() => build({ ...config([literal('OK-'), sequence(3)]), ...changes })).toThrow(message);
        expect(() => valid().update(changes)).toThrow(message);
    });

    it('rechaza reducir el consecutivo por debajo del start_value aunque solo cambien los segmentos', () => {
        const configuration = build({ ...config([literal('OK-'), sequence(4)]), start_value: 500 });
        expect(() => configuration.update({ segments: [literal('OK-'), sequence(2)] })).toThrow(/start_value/);
    });

    it('acepta cambiar a la vez segmentos y política, aunque cada cambio suelto no valga', () => {
        const configuration = build(config([literal('OK-'), sequence(3)]));
        expect(() =>
            configuration.update({ reset_policy: 'yearly', segments: [date('YYYY'), literal('-'), sequence(3)] })
        ).not.toThrow();
        expect(configuration.reset_policy).toBe('yearly');
    });
});

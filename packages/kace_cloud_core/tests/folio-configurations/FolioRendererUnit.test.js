import { FolioRenderer } from '../../src/folio-configurations/domain/FolioRenderer.js';
import { SegmentRenderer } from '../../src/folio-configurations/domain/segments/SegmentRenderer.js';
import { ScopeKeyResolver } from '../../src/folio-configurations/domain/ScopeKeyResolver.js';
import { FolioSegmentError } from '../../src/folio-configurations/domain/FolioSegmentError.js';
import { FolioCaseContextBuilder } from '../../src/folio-configurations/domain/FolioCaseContextBuilder.js';
import { FolioConfiguration } from '../../src/folio-configurations/domain/FolioConfiguration.js';
import { FolioConfigurationMother } from './domain/FolioConfigurationMother.js';
import createDayjsInstance from '../../src/shared/factories/DayjsFactory.js';

/** Renders a full folio without touching the database, feeding the sequence by hand. */
function render(segments, context, sequenceValue, overflowPolicy = 'fail') {
    const { prefix, suffix, sequenceSegment, sequenceIndex } = FolioRenderer.renderStatic(segments, context);
    const text = SegmentRenderer.formatSequence(sequenceSegment, sequenceIndex, sequenceValue, overflowPolicy);
    return FolioRenderer.assemble(prefix, text, suffix);
}

describe('FolioRenderer', () => {
    const currentYear = createDayjsInstance({})().format('YY');

    describe('el ejemplo del enunciado', () => {
        it('produce 5261000000050 con el consecutivo en 50', () => {
            const { segments } = FolioConfigurationMother.dto();
            const folio = render(segments, FolioConfigurationMother.context(), 50);

            expect(folio).toBe(`5${currentYear}1000000050`);
            // Con el año en curso (26) el folio es exactamente el pedido.
            if (currentYear === '26') expect(folio).toBe('5261000000050');
        });

        it('conserva el ancho al llegar a 100: se quita un cero solo', () => {
            const { segments } = FolioConfigurationMother.dto();
            const context = FolioConfigurationMother.context();

            expect(render(segments, context, 50)).toHaveLength(13);
            expect(render(segments, context, 100)).toHaveLength(13);
            expect(render(segments, context, 100)).toBe(`5${currentYear}1000000100`);
            expect(render(segments, context, 999999999)).toBe(`5${currentYear}1999999999`);
        });
    });

    describe('segmento field', () => {
        const context = FolioConfigurationMother.context();

        it.each([
            ['cases.external_code', 'EXT-001'],
            ['cases.reference', '42'],
            ['clasificaciones.nivel1', 'Soporte'],
            ['aux_cases.asistencia_movilidad.placa', 'ABC123'],
            ['aux_cases.asistencia_movilidad.monitoreo_proveedor_hidden.canal', '1'],
        ])('resuelve la ruta %s', (path, expected) => {
            expect(SegmentRenderer.render({ type: 'field', path }, 0, context)).toBe(expected);
        });

        it('atraviesa arrays como lo hace el motor de reglas de acciones', () => {
            const withArray = FolioConfigurationMother.context({
                aux_cases: { formulario: { items: [{ otro: 'x' }, { codigo: 'Z9' }] } },
            });

            expect(
                SegmentRenderer.render({ type: 'field', path: 'aux_cases.formulario.items.codigo' }, 0, withArray)
            ).toBe('Z9');
        });

        it('falla nombrando el segmento y la ruta cuando el valor está vacío', () => {
            const empty = FolioConfigurationMother.context({ aux_cases: { asistencia_movilidad: { canal: '' } } });
            const segment = { type: 'field', path: 'aux_cases.asistencia_movilidad.canal' };

            expect(() => SegmentRenderer.render(segment, 2, empty)).toThrow(FolioSegmentError);
            expect(() => SegmentRenderer.render(segment, 2, empty)).toThrow(
                /segmento 3 \(field\).*aux_cases\.asistencia_movilidad\.canal/
            );
        });

        it('falla cuando la ruta no existe', () => {
            expect(() => SegmentRenderer.render({ type: 'field', path: 'aux_cases.no.existe' }, 0, context)).toThrow(
                FolioSegmentError
            );
        });
    });

    describe('desbordamiento del consecutivo', () => {
        const segment = { type: 'sequence', length: 9 };

        it('falla en vez de truncar, porque truncar duplicaría folios', () => {
            expect(() => SegmentRenderer.formatSequence(segment, 3, 1_000_000_000, 'fail')).toThrow(FolioSegmentError);
            expect(() => SegmentRenderer.formatSequence(segment, 3, 1_000_000_000, 'fail')).toThrow(
                /desbordó el ancho/
            );
        });

        it('con overflow_policy "grow" alarga el folio en vez de fallar', () => {
            expect(SegmentRenderer.formatSequence(segment, 3, 1_000_000_000, 'grow')).toBe('1000000000');
        });
    });

    describe('renderStatic', () => {
        it('separa prefijo y sufijo por el consecutivo', () => {
            const segments = [
                { type: 'literal', value: 'A' },
                { type: 'sequence', length: 4 },
                { type: 'literal', value: 'Z' },
            ];

            const { prefix, suffix, sequenceIndex } = FolioRenderer.renderStatic(segments, {});

            expect({ prefix, suffix, sequenceIndex }).toEqual({ prefix: 'A', suffix: 'Z', sequenceIndex: 1 });
            expect(render(segments, {}, 7)).toBe('A0007Z');
        });

        it('resuelve los segmentos estáticos antes de tocar el contador', () => {
            // renderStatic es lo único que corre antes de reservar; si lanza aquí, el
            // consecutivo nunca se consume.
            const segments = [
                { type: 'field', path: 'aux_cases.no.existe' },
                { type: 'sequence', length: 4 },
            ];

            expect(() => FolioRenderer.renderStatic(segments, FolioConfigurationMother.context())).toThrow(
                FolioSegmentError
            );
        });

        it('falla si la configuración no tiene consecutivo', () => {
            expect(() => FolioRenderer.renderStatic([{ type: 'literal', value: 'A' }], {})).toThrow(FolioSegmentError);
        });
    });

    describe('segmento date', () => {
        it('rechaza formatos fuera de la lista blanca', () => {
            expect(() => SegmentRenderer.render({ type: 'date', format: '[año]YYYY' }, 0, {})).toThrow(
                FolioSegmentError
            );
        });
    });

    describe('ScopeKeyResolver', () => {
        it('never no separa contadores', () => {
            expect(ScopeKeyResolver.resolve('never', '5261')).toBe('');
        });

        it('prefix usa el folio renderizado hasta el consecutivo', () => {
            expect(ScopeKeyResolver.resolve('prefix', '5261')).toBe('5261');
        });

        it.each([
            ['yearly', /^\d{4}$/],
            ['monthly', /^\d{4}-\d{2}$/],
            ['daily', /^\d{4}-\d{2}-\d{2}$/],
        ])('%s produce una clave con la forma esperada', (policy, shape) => {
            expect(ScopeKeyResolver.resolve(policy, '')).toMatch(shape);
        });

        it('usa el mismo reloj que el segmento de fecha', () => {
            // Si divergieran, la noche del cambio de año el folio diría un año y el
            // contador arrancaría el scope de otro.
            expect(ScopeKeyResolver.resolve('yearly', '')).toBe(createDayjsInstance({})().format('YYYY'));
        });
    });

    describe('FolioCaseContextBuilder', () => {
        it('expone las mismas claves que getCaseContextById', () => {
            const context = FolioCaseContextBuilder.build({ caseDto: { id: 'x' }, auxData: { f: {} } });

            expect(Object.keys(context).sort()).toEqual(
                ['aux_cases', 'aux_clients', 'cases', 'clasificaciones', 'clients', 'estados'].sort()
            );
        });

        it('expone la fila de la clasificación tal cual, para resolver clasificaciones.*', () => {
            const context = FolioCaseContextBuilder.build({
                caseDto: {},
                classification: { id: 'c1', nivel1: 'A', nivel2: 'B', nivel3: null },
            });

            expect(context.clasificaciones).toEqual({ id: 'c1', nivel1: 'A', nivel2: 'B', nivel3: null });
        });
    });

    describe('rutas que RuleValidator reescribe', () => {
        // getFieldValue traduce clasificaciones.description -> clasificaciones.id y
        // cases.estadoActual -> estados.id. En una regla da igual (compara por id); en un
        // folio metería un UUID en el radicado o fallaría siempre, así que no se pueden guardar.
        const build = (segments) => () => FolioConfiguration.create(FolioConfigurationMother.dto({ segments }));

        it.each(['clasificaciones.description', 'cases.estadoActual'])('rechaza la ruta %s', (path) => {
            expect(
                build([
                    { type: 'field', path },
                    { type: 'sequence', length: 4 },
                ])
            ).toThrow(/no se puede usar en un folio/);
        });
    });
});

describe('FolioConfiguration', () => {
    // The Joi allows descripcion to be '' or null, and actionPreview builds a draft without
    // one at all. ValueObjectString rejects every falsy value unless built as nullable, so an
    // empty description used to blow up as a 500 instead of saving as NULL.
    it.each([
        ['ausente', undefined],
        ['vacía', ''],
        ['nula', null],
    ])('acepta una descripción %s y la guarda como null', (_caso, descripcion) => {
        const configuration = FolioConfiguration.create(FolioConfigurationMother.dto({ descripcion }));

        expect(configuration.descripcion.value).toBeNull();
    });

    it('conserva una descripción con contenido', () => {
        const configuration = FolioConfiguration.create(FolioConfigurationMother.dto({ descripcion: 'Radicado SAC' }));

        expect(configuration.descripcion.value).toBe('Radicado SAC');
    });

    it('permite borrar la descripción de una configuración existente', () => {
        const configuration = FolioConfiguration.create(FolioConfigurationMother.dto({ descripcion: 'Radicado SAC' }));

        configuration.descripcion = '';

        expect(configuration.descripcion.value).toBeNull();
        expect(configuration.changedAttributes.descripcion).toBeNull();
    });

    // Mirrors the draft actionPreview builds for an unsaved configuration. Three 500s hid
    // here, each masking the next: a descripcion the preview payload never carries, and the
    // created_by / created_at that AggregateRoot demands and only actionCreate was setting.
    it('reproduce el borrador que arma actionPreview', () => {
        expect(() =>
            FolioConfiguration.create({
                id: '00000000-0000-4000-8000-000000000000',
                nombre: 'preview',
                segments: [{ type: 'sequence', length: 6, pad_char: '0' }],
                reset_policy: 'never',
                start_value: 1,
                overflow_policy: 'fail',
                status: 1,
                created_at: new Date(),
                created_by: '8a09ba2c-0231-4cc3-b02d-5b90054d6f90',
            })
        ).not.toThrow();
    });
});

describe('modo previa (placeholders)', () => {
    const PREVIEW = { placeholders: true };
    const sequence = { type: 'sequence', length: 6, pad_char: '0' };
    const fieldSegments = [{ type: 'field', path: 'aux_cases.triaje.canal' }, sequence];

    it('marca el campo ausente con el último tramo de la ruta', () => {
        const { prefix } = FolioRenderer.renderStatic(fieldSegments, {}, PREVIEW);

        expect(prefix).toBe('‹canal›');
    });

    it('usa el valor real cuando el contexto sí lo trae', () => {
        const context = { aux_cases: { triaje: { canal: '7' } } };

        expect(FolioRenderer.renderStatic(fieldSegments, context, PREVIEW).prefix).toBe('7');
    });

    it('sigue fallando con una configuración rota: campo sin ruta', () => {
        expect(() => FolioRenderer.renderStatic([{ type: 'field' }, sequence], {}, PREVIEW)).toThrow(
            /no tiene ruta configurada/
        );
    });

    it('sigue fallando con una configuración rota: formato de fecha no permitido', () => {
        const segments = [{ type: 'date', format: 'YYYY-MM-DD' }, sequence];

        expect(() => FolioRenderer.renderStatic(segments, {}, PREVIEW)).toThrow(/formato no permitido/);
    });

    // La garantía del camino de creación: sin opciones, un valor ausente sigue siendo 400
    // y el consecutivo no llega a reservarse.
    it('sin opciones sigue lanzando ante un campo sin valor', () => {
        expect(() => FolioRenderer.renderStatic(fieldSegments, {})).toThrow(
            /no encuentra ningún valor en la ruta "aux_cases.triaje.canal"/
        );
    });
});

describe('FolioSegmentError', () => {
    it('publica el motivo y el segmento, que en producción no viajan en el mensaje del 400', () => {
        const error = new FolioSegmentError(1, 'field', 'no encuentra ningún valor en la ruta "aux_cases.f.canal"');

        expect(FolioSegmentError.exposesPublicData).toBe(true);
        expect(error.statusCode).toBe(400);
        expect(error.toPublicData()).toEqual({
            detail: 'No se pudo generar el folio: el segmento 2 (field) no encuentra ningún valor en la ruta "aux_cases.f.canal"',
            segment_index: 1,
            segment_type: 'field',
        });
    });
});

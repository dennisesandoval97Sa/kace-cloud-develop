/**
 * JoiDateTimezoneLimit.test.js
 *
 * PROPÓSITO: Documentación ejecutable de las limitaciones de Joi.date() con zonas horarias.
 *
 * Estos tests NO validan lógica de negocio del proyecto. Su función es demostrar
 * de forma irrefutable por qué Joi.date() es insuficiente para manejar timezones
 * y justificar la decisión de usar Joi.string() + regex + dayjs en DateSchemaBuilder.
 *
 * Ref estándar: ECMAScript spec §20.4 (Date Objects) — el objeto Date de JavaScript
 * es siempre UTC internamente. Ref Joi: https://joi.dev/api/?v=17.x#date
 */

import Joi from 'joi';

describe('Joi.date() — limitaciones con zonas horarias (documentación ejecutable)', () => {
    // ─────────────────────────────────────────────────────────────────────────
    // LIMITACIÓN 1: Joi.date() pierde la información del offset original
    // ─────────────────────────────────────────────────────────────────────────
    describe('Limitación 1: el offset original se pierde al parsear', () => {
        it('convierte "2025-12-25T10:30:00-05:00" a un Date UTC, descartando -05:00', () => {
            const schema = Joi.date();
            const { value } = schema.validate('2025-12-25T10:30:00-05:00');

            // El valor retornado es un objeto Date, no el string original
            expect(value).toBeInstanceOf(Date);

            // Al serializar a ISO string el resultado es UTC — el offset -05:00 desapareció
            expect(value.toISOString()).toBe('2025-12-25T15:30:00.000Z');

            // La información original "-05:00" es irrecuperable desde el valor retornado
            expect(value.toISOString()).not.toContain('-05:00');
        });

        it('convierte "2025-12-25T10:30:00+00:00" y "2025-12-25T05:30:00-05:00" al mismo Date (distintos strings, mismo instante)', () => {
            const schema = Joi.date();
            const { value: v1 } = schema.validate('2025-12-25T10:30:00+00:00');
            const { value: v2 } = schema.validate('2025-12-25T05:30:00-05:00');

            // Ambos representan el mismo instante UTC — Joi los trata como equivalentes
            expect(v1.getTime()).toBe(v2.getTime());

            // Pero los strings originales eran distintos: no se puede saber cuál fue el input
            expect('2025-12-25T10:30:00+00:00').not.toBe('2025-12-25T05:30:00-05:00');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // LIMITACIÓN 2: Joi.date() no puede exigir que el input tenga timezone
    // ─────────────────────────────────────────────────────────────────────────
    describe('Limitación 2: no es posible exigir que el input incluya timezone explícita', () => {
        it('acepta indistintamente strings con y sin timezone', () => {
            const schema = Joi.date();

            // Con timezone: válido
            const withTz = schema.validate('2025-12-25T10:30:00-05:00');
            expect(withTz.error).toBeUndefined();

            // Sin timezone: también válido — Joi no distingue entre ambos formatos
            const withoutTz = schema.validate('2025-12-25T10:30:00');
            expect(withoutTz.error).toBeUndefined();
        });

        it('Joi.date().iso() tampoco rechaza strings sin timezone', () => {
            // .iso() solo exige formato ISO 8601, pero no exige que tenga offset
            const schema = Joi.date().iso();

            const result = schema.validate('2025-12-25T10:30:00'); // sin Z ni offset
            expect(result.error).toBeUndefined();
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // LIMITACIÓN 3: Joi.date() no puede rechazar strings que TIENEN timezone
    // ─────────────────────────────────────────────────────────────────────────
    describe('Limitación 3: no es posible rechazar strings que incluyen timezone', () => {
        it('acepta "2025-12-25T10:30:00Z" aunque se quisiera solo aceptar sin timezone', () => {
            // No existe un modificador en Joi.date() para rechazar strings con offset
            const schema = Joi.date();
            const result = schema.validate('2025-12-25T10:30:00Z');
            expect(result.error).toBeUndefined();
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // LIMITACIÓN 4: custom() en Joi.date() recibe Date, no el string original
    // ─────────────────────────────────────────────────────────────────────────
    describe('Limitación 4: el validador custom() ya no tiene acceso al string original', () => {
        it('recibe un objeto Date en custom(), haciendo imposible verificar si tenía offset', () => {
            const offsetsCapturados = [];

            const schema = Joi.date().custom((value) => {
                // `value` aquí ya es un Date object, no el string original
                // No hay forma de saber si el input era "T10:30:00-05:00" o "T15:30:00Z"
                offsetsCapturados.push(typeof value);
                return value;
            });

            schema.validate('2025-12-25T10:30:00-05:00');
            schema.validate('2025-12-25T10:30:00');

            // En ambos casos custom() recibe 'object' (Date), nunca 'string'
            expect(offsetsCapturados).toEqual(['object', 'object']);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // CONCLUSIÓN: Joi.string() + regex sí puede hacer lo que Joi.date() no puede
    // ─────────────────────────────────────────────────────────────────────────
    describe('Solución adoptada: Joi.string() + regex conserva el control total', () => {
        const ISO_WITH_TZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})$/;
        const ISO_WITHOUT_TZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?$/;

        it('ISO_WITH_TZ acepta strings con timezone y rechaza strings sin ella', () => {
            const schema = Joi.string().pattern(ISO_WITH_TZ, 'ISO 8601 with timezone');

            expect(schema.validate('2025-12-25T10:30:00-05:00').error).toBeUndefined();
            expect(schema.validate('2025-12-25T10:30:00Z').error).toBeUndefined();
            expect(schema.validate('2025-12-25T10:30:00.000-05:00').error).toBeUndefined();
            expect(schema.validate('2025-12-25T10:30:00').error).toBeDefined(); // sin TZ → rechaza
        });

        it('ISO_WITHOUT_TZ acepta strings sin timezone y rechaza strings con ella', () => {
            const schema = Joi.string().pattern(ISO_WITHOUT_TZ, 'ISO 8601 without timezone');

            expect(schema.validate('2025-12-25T10:30:00').error).toBeUndefined();
            expect(schema.validate('2025-12-25T10:30:00.000').error).toBeUndefined();
            expect(schema.validate('2025-12-25T10:30:00Z').error).toBeDefined(); // con Z → rechaza
            expect(schema.validate('2025-12-25T10:30:00-05:00').error).toBeDefined(); // con offset → rechaza
        });

        it('custom() sobre Joi.string() recibe el string original intacto', () => {
            const valoresRecibidos = [];
            const schema = Joi.string()
                .pattern(ISO_WITH_TZ, 'ISO 8601 with timezone')
                .custom((value) => {
                    valoresRecibidos.push(value);
                    return value;
                });

            schema.validate('2025-12-25T10:30:00-05:00');

            // El string llega intacto al validador custom — el offset es recuperable
            expect(valoresRecibidos[0]).toBe('2025-12-25T10:30:00-05:00');
            expect(valoresRecibidos[0]).toContain('-05:00');
        });
    });
});

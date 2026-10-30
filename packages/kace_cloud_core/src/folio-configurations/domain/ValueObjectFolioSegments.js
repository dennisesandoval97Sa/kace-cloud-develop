import { ValidationFailError } from '../../shared/errors/ValidationFailError.js';
import {
    DATE_FORMATS,
    MAX_FOLIO_LENGTH,
    MAX_SEQUENCE_LENGTH,
    RESOLVABLE_ROOTS,
    SEGMENT_TYPES,
    UNRESOLVABLE_PATHS,
} from './segments/segmentCatalog.js';

/**
 * The ordered list of segments that makes up a folio.
 *
 * Invariants live here rather than only in the API's Joi schema so they hold for every
 * caller, and so a configuration that would fail at case-creation time is rejected when
 * it is saved instead.
 */
export class ValueObjectFolioSegments {
    /** @type {Array<Object>} */
    #value;

    constructor(field, value) {
        this.field = field;

        if (!Array.isArray(value) || value.length === 0) {
            throw new ValidationFailError(`${field}: debe ser una lista con al menos un segmento`, field);
        }

        value.forEach((segment, index) => ValueObjectFolioSegments.#validateSegment(segment, index, field));

        const sequences = value.filter((segment) => segment.type === 'sequence');
        if (sequences.length !== 1) {
            throw new ValidationFailError(
                `${field}: debe haber exactamente un segmento de tipo "sequence", hay ${sequences.length}`,
                field
            );
        }

        ValueObjectFolioSegments.#validateMaxLength(value, field);

        this.#value = value;
    }

    get value() {
        return this.#value;
    }

    static #validateSegment(segment, index, field) {
        const position = `${field}[${index}]`;

        if (!segment || typeof segment !== 'object') {
            throw new ValidationFailError(`${position}: cada segmento debe ser un objeto`, field);
        }

        if (!SEGMENT_TYPES.includes(segment.type)) {
            throw new ValidationFailError(
                `${position}: tipo "${segment.type}" no válido. Permitidos: ${SEGMENT_TYPES.join(', ')}`,
                field
            );
        }

        switch (segment.type) {
            case 'literal':
                if (typeof segment.value !== 'string' || segment.value.length === 0) {
                    throw new ValidationFailError(`${position}: un literal necesita un "value" no vacío`, field);
                }
                break;
            case 'date':
                if (!DATE_FORMATS.includes(segment.format)) {
                    throw new ValidationFailError(
                        `${position}: formato "${segment.format}" no permitido. Permitidos: ${DATE_FORMATS.join(', ')}`,
                        field
                    );
                }
                break;
            case 'field':
                if (typeof segment.path !== 'string' || segment.path.length === 0) {
                    throw new ValidationFailError(`${position}: un campo necesita una "path" no vacía`, field);
                }
                ValueObjectFolioSegments.#validatePath(segment.path, position, field);
                break;
            case 'sequence':
                ValueObjectFolioSegments.#validateSequence(segment, position, field);
                break;
        }
    }

    /**
     * Only the roots populated at creation time resolve (see FolioCaseContextBuilder); any
     * other root, and the UNRESOLVABLE_PATHS of segmentCatalog.js, would fail every case.
     */
    static #validatePath(path, position, field) {
        const root = path.split('.')[0];
        if (!RESOLVABLE_ROOTS.includes(root)) {
            throw new ValidationFailError(
                `${position}: la ruta "${path}" no se puede usar en un folio. Orígenes permitidos: ${RESOLVABLE_ROOTS.join(', ')}`,
                field
            );
        }

        if (UNRESOLVABLE_PATHS.includes(path)) {
            throw new ValidationFailError(
                `${position}: la ruta "${path}" no se puede usar en un folio porque no resuelve a un valor legible`,
                field
            );
        }
    }

    static #validateSequence(segment, position, field) {
        if (!Number.isInteger(segment.length) || segment.length < 1 || segment.length > MAX_SEQUENCE_LENGTH) {
            throw new ValidationFailError(
                `${position}: "length" debe ser un entero entre 1 y ${MAX_SEQUENCE_LENGTH}`,
                field
            );
        }

        if (segment.pad_char !== undefined && String(segment.pad_char).length !== 1) {
            throw new ValidationFailError(`${position}: "pad_char" debe ser un único carácter`, field);
        }

        // A padding digit other than 0 makes two numbers render alike: with '9' and width 4,
        // 5 and 9995 both become "9995".
        if (/[1-9]/.test(String(segment.pad_char ?? ''))) {
            throw new ValidationFailError(`${position}: "pad_char" no puede ser un dígito distinto de 0`, field);
        }
    }

    /**
     * Lower bound on the rendered width: literals, date formats and the sequence mask are
     * known statically. Dynamic field segments can only make it longer, so if the known
     * part already overflows the column the configuration can never produce a valid folio.
     */
    static #validateMaxLength(segments, field) {
        const known = segments.reduce((total, segment) => {
            if (segment.type === 'literal') return total + segment.value.length;
            if (segment.type === 'date') return total + segment.format.length;
            if (segment.type === 'sequence') return total + segment.length;
            return total;
        }, 0);

        if (known > MAX_FOLIO_LENGTH) {
            throw new ValidationFailError(
                `${field}: la longitud mínima del folio (${known}) supera los ${MAX_FOLIO_LENGTH} caracteres de la columna`,
                field
            );
        }
    }
}

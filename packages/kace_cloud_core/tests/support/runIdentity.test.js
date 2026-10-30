import { createRunId, runIdTimestamp, RUN_ID_LENGTH } from './runIdentity.js';

describe('runIdentity', () => {
    // El identificador viaja dentro del nombre de una base de datos de postgres,
    // asi que solo puede llevar caracteres validos y tiene que ser corto: el
    // limite es 63 y el nombre completo es "kace_t_" + runId + "_" + 12 de hash.
    it('produce un identificador de longitud fija y solo alfanumerico en minuscula', () => {
        const id = createRunId(1786000000000);

        expect(id).toHaveLength(RUN_ID_LENGTH);
        expect(id).toMatch(/^[0-9a-z]+$/);
    });

    // El instante va codificado DENTRO del identificador porque `pg_database` no
    // guarda fecha de creacion: es la unica forma de saber la edad de una base
    // huerfana mirando solo su nombre.
    it('permite recuperar el instante de creacion del propio identificador', () => {
        const now = 1786000000000;

        expect(runIdTimestamp(createRunId(now))).toBe(now);
    });

    // Un instante real (de 1972 en adelante) ya ocupa los 8 caracteres en base
    // 36, asi que el relleno solo se ejerce con instantes cortos. Sin este caso
    // el relleno no lo cubre nadie: se puede cambiar el caracter de relleno por
    // uno invalido en un nombre de base de datos y la suite sigue verde.
    it('rellena los instantes cortos sin sacar el identificador del charset', () => {
        const id = createRunId(1000);

        expect(id).toHaveLength(RUN_ID_LENGTH);
        expect(id).toMatch(/^[0-9a-z]+$/);
        expect(runIdTimestamp(id)).toBe(1000);
    });

    it('devuelve null para un identificador que no tiene la forma esperada', () => {
        expect(runIdTimestamp('no-es-un-id')).toBeNull();
    });

    it('dos identificadores del mismo milisegundo son distintos', () => {
        const now = 1786000000000;

        expect(createRunId(now)).not.toBe(createRunId(now));
    });
});

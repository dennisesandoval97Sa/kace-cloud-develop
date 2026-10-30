import { JsonExtractSelectTranslator } from '../../../src/shared/criteria/JsonExtractSelectTranslator.js';
import { InvalidArgumentError } from '../../../src/shared/errors/InvalidArgumentError.js';

describe('JsonExtractSelectTranslator', () => {
    it('deja intacta una expresion que no usa json_extract', () => {
        const expr = 'aux_cases.data as aux_cases_data';

        expect(JsonExtractSelectTranslator.translate(expr)).toBe(expr);
    });

    it('traduce una ruta simple a sql parametrizado, con el jsonpath ligado como binding', () => {
        const result = JsonExtractSelectTranslator.translate(
            "json_extract(aux_cases.data, '$.name') as aux_cases_name"
        );

        expect(result).toEqual({
            sql: 'jsonb_path_query_first(aux_cases.data, ?) as aux_cases_name',
            bindings: ['$."name"'],
        });
    });

    it('traduce una ruta anidada a sql parametrizado, con el jsonpath ligado como binding', () => {
        const result = JsonExtractSelectTranslator.translate(
            "json_extract(aux_cases.data, '$.profile.contact.name') as aux_cases_data"
        );

        expect(result).toEqual({
            sql: 'jsonb_path_query_first(aux_cases.data, ?) as aux_cases_data',
            bindings: ['$."profile"."contact"."name"'],
        });
    });

    it('traduce indices de array a sql parametrizado, con el jsonpath ligado como binding', () => {
        const result = JsonExtractSelectTranslator.translate("json_extract(aux_cases.data, '$.genre[0]') as g");

        expect(result).toEqual({
            sql: 'jsonb_path_query_first(aux_cases.data, ?) as g',
            bindings: ['$."genre"[0]'],
        });
    });

    it('acepta la expresion sin alias', () => {
        const result = JsonExtractSelectTranslator.translate("json_extract(aux_cases.data, '$.name')");

        expect(result).toEqual({
            sql: 'jsonb_path_query_first(aux_cases.data, ?)',
            bindings: ['$."name"'],
        });
    });

    it('rechaza una expresion json_extract que no encaja con la forma esperada', () => {
        expect(() =>
            JsonExtractSelectTranslator.translate("json_extract(aux_cases.data, '$.name'); drop table cases")
        ).toThrow(InvalidArgumentError);
    });

    it('rechaza una ruta con caracteres fuera del juego permitido', () => {
        expect(() => JsonExtractSelectTranslator.translate(`json_extract(aux_cases.data, '$."a b"')`)).toThrow(
            InvalidArgumentError
        );
    });
});

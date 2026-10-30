import {
    normalizeResponseValue,
    parseAllowedOrigins,
    parsePublicData,
    parseResponseData,
    parseResponseHeaders,
    parseResponseMessage,
    parseResponseMetadata,
    parseResponseStatusCode,
} from '../../src/http_responses/ResponseBoundary.js';

describe('ResponseBoundary', () => {
    it('parses the response constructor contract without coercion', () => {
        expect(parseResponseMessage('Created')).toBe('Created');
        expect(parseResponseStatusCode(201, 'Response')).toBe(201);
        expect(parseResponseData({ id: 'case-id' }, 'Response')).toEqual({ id: 'case-id' });
        expect(parseResponseMetadata({ page: 1 }, 'Response')).toEqual({ page: 1 });
        expect(parseResponseHeaders({ Location: '/cases/case-id' }, 'Response')).toEqual({
            Location: '/cases/case-id',
        });
        expect(parsePublicData({ interaction_id: 'interaction-id' }, 'Response')).toEqual({
            interaction_id: 'interaction-id',
        });
    });

    it('rejects values that only become valid through coercion', () => {
        expect(() => parseResponseMessage(1)).toThrow('Invalid message');
        expect(() => parseResponseStatusCode('201', 'Response')).toThrow('Response - Invalid status code: 201');
        expect(() => parseResponseData('private-data', 'Response')).toThrow(
            'Response - Invalid value for "data" private-data'
        );
        expect(() => parseResponseData(false, 'Response')).toThrow('Response - Invalid value for "data" false');
        expect(() => parseResponseMetadata('private-metadata', 'Response')).toThrow('Response - Invalid metadata');
        expect(() => parseResponseMetadata([], 'Response')).toThrow('Response - Invalid metadata');
        expect(() => parseResponseHeaders('X-Test: value', 'Response')).toThrow('Response - Invalid headers');
        expect(() => parseResponseHeaders([], 'Response')).toThrow('Response - Invalid headers');
        expect(() => parsePublicData(['not', 'a', 'record'], 'Response')).toThrow('Response - Invalid public data');
    });

    it('normalizes renderable values into explicit variants', () => {
        expect(normalizeResponseValue('message')).toEqual({ kind: 'string', value: 'message' });
        expect(normalizeResponseValue({ message: 'detail' })).toEqual({
            kind: 'record',
            value: { message: 'detail' },
        });
        expect(normalizeResponseValue(123)).toEqual({ kind: 'other', value: 123 });
    });

    it('parses comma-separated origins and fails closed for invalid input', () => {
        expect(parseAllowedOrigins(' https://admin.appsmx.net, http://localhost ')).toEqual([
            'https://admin.appsmx.net',
            'http://localhost',
        ]);
        expect(parseAllowedOrigins({ value: 'https://admin.appsmx.net' })).toEqual(['*']);
        expect(parseAllowedOrigins('   ')).toEqual(['*']);
    });
});

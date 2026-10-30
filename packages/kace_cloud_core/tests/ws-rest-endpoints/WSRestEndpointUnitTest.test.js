import {
    WSRestEndpoint,
    WSRestEndpointResponse,
    WSRestEndpointCollectionResponse,
    SecretReferenceExtractor,
} from '../../src/ws-rest-endpoints';
import { v4 as uuidv4 } from 'uuid';
import WSRestEndpointMother from './domain/WSRestEndpointMother';
import { ValueObjectHttpRequestType } from '../../src/ws-rest-endpoints/domain/value-objects/ValueObjectHttpRequestType';
import { ValueObjectHttpMethod } from '../../src/ws-rest-endpoints/domain/value-objects/ValueObjectHttpMethod';
describe('WSRestEndpoint Entity', () => {
    const dto = WSRestEndpointMother.dto();
    it('should create a WSRestEndpoint with valid data', () => {
        const endpoint = WSRestEndpoint.create(dto);
        expect(endpoint.id.value).toBe(dto.id);
        expect(endpoint.type.value).toBe(dto.type);
        expect(endpoint.description.value).toBe(dto.description);
        expect(endpoint.url.value).toBe(dto.url);
        expect(endpoint.method.value).toBe(dto.method);
        expect(endpoint.headers.value).toEqual(dto.headers);
        expect(endpoint.body.value).toBe(dto.body);
        expect(endpoint.is_dynamic_body.value).toBe(dto.is_dynamic_body);
        expect(endpoint.is_active.value).toBe(dto.is_active);
        expect(endpoint.created_by.value).toBe(dto.created_by);
        expect(endpoint.created_at.value).toBe(dto.created_at);
        expect(endpoint.is_dynamic_header.value).toBe(dto.is_dynamic_header);
        expect(endpoint.filter_input.value).toBe(dto.filter_input);
        expect(endpoint.context_position.value).toBe(dto.context_position);
        expect(endpoint.on_success.value).toBe(dto.on_success);
        expect(endpoint.on_error.value).toBe(dto.on_error);
        expect(endpoint.attempts.value).toBe(dto.attempts);
    });
    it('should update WSRestEndpoint data', () => {
        const wsRestEndpoint = WSRestEndpoint.create(dto);
        const newData = {
            description: 'Updated Description',
            url: 'https://api.example.com/updated-endpoint',
            method: 'POST',
            headers: { headers: { Authorization: 'Bearer token' } },
            body: { body: { key: 'value' } },
            is_dynamic_body: false,
            is_active: false,
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
            is_dynamic_header: false,
            authorization_id: '857c197c-26dd-4dbf-821d-4ec16e7deba7',
            filter_input: { filter_input: ['data', 'status', 'message'] },
            context_position: 'step_1',
            on_success: {
                on_success: {
                    200: 'e110b6de-10a5-11f0-ad62-0050569f2da3',
                    201: 'ef55f4ee-10a5-11f0-ad62-0050569f2da3',
                },
            },
            on_error: {
                on_error: { 400: 'ef6c6889-10a5-11f0-ad62-0050569f2da3', 500: 'ef806d1d-10a5-11f0-ad62-0050569f2da3' },
            },
            attempts: 1,
        };
        wsRestEndpoint.update(newData);
        expect(wsRestEndpoint.description.value).toBe(newData.description);
        expect(wsRestEndpoint.url.value).toBe(newData.url);
        expect(wsRestEndpoint.method.value).toBe(newData.method);
        expect(wsRestEndpoint.headers.value).toEqual(newData.headers);
        expect(wsRestEndpoint.body.value).toEqual(newData.body);
        expect(wsRestEndpoint.is_dynamic_body.value).toBe(newData.is_dynamic_body);
        expect(wsRestEndpoint.is_active.value).toBe(newData.is_active);
        expect(wsRestEndpoint.updated_at.value).toBe(newData.updated_at);
        expect(wsRestEndpoint.updated_by.value).toBe(newData.updated_by);
        expect(wsRestEndpoint.is_dynamic_header.value).toBe(newData.is_dynamic_header);
        expect(wsRestEndpoint.filter_input.value).toEqual(newData.filter_input);
        expect(wsRestEndpoint.context_position.value).toEqual(newData.context_position);
        expect(wsRestEndpoint.on_success.value).toEqual(newData.on_success);
        expect(wsRestEndpoint.on_error.value).toEqual(newData.on_error);
        expect(wsRestEndpoint.attempts.value).toEqual(newData.attempts);
    });
    it('should throw an error with invalid UUID', () => {
        const invalidData = { ...dto, id: 'invalid-uuid' };
        expect(() => WSRestEndpoint.create(invalidData)).toThrow('Invalid value invalid-uuid for object uuid');
    });
    it('does not update properties when values are the same', () => {
        const wsRestEndpoint = WSRestEndpoint.create(dto);
        const sameData = { ...dto };
        wsRestEndpoint.update(sameData);
        expect(wsRestEndpoint.changedAttributes).toEqual({});
    });
    it('marks a WSRestEndpoint instance as deleted', () => {
        const wsRestEndpoint = WSRestEndpoint.create(dto);
        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };
        wsRestEndpoint.delete(deleteDto);
        expect(wsRestEndpoint.deleted_at.value).toBe(deleteDto.deleted_at);
        expect(wsRestEndpoint.deleted_by.value).toBe(deleteDto.deleted_by);
    });
    it('keeps unmarked deleted fields as null', () => {
        const wsRestEndpoint = WSRestEndpoint.create(dto);
        wsRestEndpoint.deleted_at = null;
        wsRestEndpoint.deleted_by = undefined;
        expect(wsRestEndpoint.deleted_at.value).toBeNull();
        expect(wsRestEndpoint.deleted_by.value).toBeUndefined();
    });
    it('flushes changes in WSRestEndpoint instance', () => {
        const wsRestEndpoint = WSRestEndpoint.create(dto);
        const updateDto = {
            type: 'consumption',
            description: 'Updated Description',
            url: 'https://api.example.com/updated-endpoint',
            method: 'GET',
            headers: { headers: { Authorization: 'Bearer token' } },
            body: { body: { key: 'value' } },
            is_dynamic_body: true,
            is_active: false,
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
            authorization_id: 'a516e3fc-6b2f-4cc3-8d83-08ff82c2c4db',
            is_dynamic_header: true,
            filter_input: { filter_input: ['data', 'status', 'message'] },
            context_position: 'step_2',
        };
        wsRestEndpoint.update(updateDto);
        wsRestEndpoint.flushChanges();
        expect(wsRestEndpoint.changedAttributes).toEqual({});
    });
    describe('WSRestEndpoint Inputs', () => {
        it('should throw an error with empty Filter Input', () => {
            const emptyFilterInput = { ...dto, filter_input: {} };
            expect(() => WSRestEndpoint.create(emptyFilterInput)).toThrow(
                'The "filter input" property must be an array'
            );
        });
        it('should throw an error with invalid Context Position', () => {
            const emptyContextPositiontNode = { ...dto, context_position: 1 };
            expect(() => WSRestEndpoint.create(emptyContextPositiontNode)).toThrow(
                'context_position: The value must be a string'
            );
        });
        it('should throw an error with empty Context position', () => {
            const emptyContextPosition = { ...dto, context_position: '' };
            expect(() => WSRestEndpoint.create(emptyContextPosition)).toThrow(
                'context_position: The value cannot be null'
            );
        });
        it('should throw an invalid on_success Input', () => {
            const onSuccessInput = { ...dto, on_success: { on_success: 'ef55f4ee-10a5-11f0-ad62-0050569f2da3' } };
            expect(() => WSRestEndpoint.create(onSuccessInput)).toThrow('on_success: The property must be an Object');
        });
        it('should throw an invalid on_error Input', () => {
            const onErrorInput = { ...dto, on_error: { on_error: 'ef55f4ee-10a5-11f0-ad62-0050569f2da3' } };
            expect(() => WSRestEndpoint.create(onErrorInput)).toThrow('on_error: The property must be an Object');
        });
    });
});

describe('WSRestEndpoint Response Tests', () => {
    it('converts WSRestEndpoint object to JSON representation', () => {
        const wsRestEndpoint = WSRestEndpoint.create(WSRestEndpointMother.dto());
        const wsRestEndpointResponse = new WSRestEndpointResponse(wsRestEndpoint);
        const json = wsRestEndpointResponse.toJson();
        expect(json).toEqual({
            data: {
                id: wsRestEndpoint.id.value,
                description: wsRestEndpoint.description.value,
                type: wsRestEndpoint.type.value,
                url: wsRestEndpoint.url.value,
                method: wsRestEndpoint.method.value,
                headers: wsRestEndpoint.headers.value,
                body: wsRestEndpoint.body.value,
                is_dynamic_body: wsRestEndpoint.is_dynamic_body.value,
                is_active: wsRestEndpoint.is_active.value,
                created_at: wsRestEndpoint.created_at.value,
                created_by: wsRestEndpoint.created_by.value,
                updated_at: wsRestEndpoint.updated_at.value,
                updated_by: wsRestEndpoint.updated_by.value,
                authorization_id: wsRestEndpoint.authorization_id.value,
                is_dynamic_header: wsRestEndpoint.is_dynamic_header.value,
                filter_input: wsRestEndpoint.filter_input.value,
                body_type: wsRestEndpoint.body_type.value,
                context_position: wsRestEndpoint.context_position.value,
                on_success: wsRestEndpoint.on_success.value,
                on_error: wsRestEndpoint.on_error.value,
                attempts: wsRestEndpoint.attempts.value,
                initial_context: wsRestEndpoint.initial_context.value,
                cache_expires_in_path: null,
                cache_default_ttl_seconds: null,
            },
        });
    });
    it('returns an empty object if WSRestEndpoint is not provided', () => {
        const wsRestEndpointResponse = new WSRestEndpointResponse(null);
        const json = wsRestEndpointResponse.toJson();
        expect(json).toEqual({});
    });
});
describe('WSRestEndpoint Collection Response Tests', () => {
    it('converts WSRestEndpoint collection to JSON representation', () => {
        const wsRestEndpointCollection = [
            WSRestEndpoint.create(WSRestEndpointMother.dto()),
            WSRestEndpoint.create(WSRestEndpointMother.dto()),
        ];
        const wsRestEndpointCollectionResponse = new WSRestEndpointCollectionResponse(
            wsRestEndpointCollection,
            wsRestEndpointCollection.length
        );
        const json = wsRestEndpointCollectionResponse.toJson();
        expect(json).toEqual({
            data: {
                items: wsRestEndpointCollection.map(
                    (wsRestEndpoint) => new WSRestEndpointResponse(wsRestEndpoint).toJson().data
                ),
            },
            metadata: {
                count: wsRestEndpointCollection.length,
            },
        });
    });
});
describe('ValueObjectHttpRequestType Tests', () => {
    it('should create an instance with a valid request type', () => {
        const validValue = 'authorization';
        const valueObject = new ValueObjectHttpRequestType('requestType', validValue);
        expect(valueObject).toBeInstanceOf(ValueObjectHttpRequestType);
    });
    it('should throw an error if the request type is null, undefined, or empty', () => {
        const invalidValues = [null, undefined, ''];
        invalidValues.forEach((value) => {
            expect(() => new ValueObjectHttpRequestType('requestType', value)).toThrow('The value cannot be null');
        });
    });
    it('should throw an error if the request type is not a valid HTTP method', () => {
        const invalidValue = 'INVALID_TYPE';
        expect(() => new ValueObjectHttpRequestType('requestType', invalidValue)).toThrow(
            'requestType: The value is not a valid HTTP request type'
        );
    });
    it('should not throw an error if the request type is a valid HTTP method', () => {
        const validValue = 'consumption';
        expect(() => new ValueObjectHttpRequestType('requestType', validValue)).not.toThrow();
    });
});
describe('ValueObjectHttpMethod Tests', () => {
    it('should create an instance with a valid HTTP method', () => {
        const validValue = 'POST';
        const valueObject = new ValueObjectHttpMethod('httpMethod', validValue);
        expect(valueObject).toBeInstanceOf(ValueObjectHttpMethod);
    });
    it('should throw an error if the HTTP method is null, undefined, or empty', () => {
        const invalidValues = [null, undefined, ''];
        invalidValues.forEach((value) => {
            expect(() => new ValueObjectHttpMethod('httpMethod', value)).toThrow('The value cannot be null');
        });
    });
    it('should throw an error if the HTTP method is not a valid HTTP method', () => {
        const invalidValue = 'INVALID_METHOD';
        expect(() => new ValueObjectHttpMethod('httpMethod', invalidValue)).toThrow(
            'httpMethod: The value is not a valid HTTP method'
        );
    });
    it('should not throw an error if the HTTP method is a valid HTTP method', () => {
        const validValue = 'PUT';
        expect(() => new ValueObjectHttpMethod('httpMethod', validValue)).not.toThrow();
    });

    it('should create a WSRestEndpoint and replace null body, headers, on_success and on_error ith defaults', () => {
        const dtoWithNulls = {
            ...WSRestEndpointMother.dto(),
            body: null,
            headers: null,
            on_success: null,
            on_error: null,
        };

        const endpoint = WSRestEndpoint.create(dtoWithNulls);

        expect(endpoint.body.value).toEqual({ body: {} });
        expect(endpoint.headers.value).toEqual({ headers: {} });
    });
});

describe('SecretReferenceExtractor', () => {
    it('returns empty array when no SECRET_ references exist', () => {
        const dto = {
            url: 'https://api.example.com/cases',
            is_dynamic_header: 1,
            headers: {
                headers: {
                    'x-tenant-id': 'normal_value',
                },
            },
        };

        const result = SecretReferenceExtractor.extract(dto);

        expect(result).toEqual([]);
    });

    it('extracts a single SECRET_ from url', () => {
        const dto = {
            url: 'https://SECRET_API_URL/cases',
        };

        const result = SecretReferenceExtractor.extract(dto);

        expect(result).toEqual(['API_URL']);
    });

    it('extracts multiple SECRET_ from same url', () => {
        const dto = {
            url: 'https://SECRET_API_URL/cases/SECRET_ENDPOINT',
        };

        const result = SecretReferenceExtractor.extract(dto);

        expect(result).toEqual(expect.arrayContaining(['API_URL', 'ENDPOINT']));
        expect(result.length).toBe(2);
    });

    it('does NOT extract from headers when is_dynamic_header is false', () => {
        const dto = {
            is_dynamic_header: 0,
            headers: {
                headers: {
                    'x-tenant-id': 'SECRET_TENANT',
                },
            },
        };

        const result = SecretReferenceExtractor.extract(dto);

        expect(result).toEqual([]);
    });

    it('extracts SECRET_ from headers when is_dynamic_header is true', () => {
        const dto = {
            is_dynamic_header: 1,
            headers: {
                headers: {
                    'x-tenant-id': 'SECRET_TENANT',
                    'x-client': 'SECRET_FINGERPRINT',
                },
            },
        };

        const result = SecretReferenceExtractor.extract(dto);

        expect(result).toEqual(expect.arrayContaining(['TENANT', 'FINGERPRINT']));
        expect(result.length).toBe(2);
    });

    it('does NOT extract from body when is_dynamic_body is false', () => {
        const dto = {
            is_dynamic_body: 0,
            body: {
                body: {
                    user: {
                        token: 'SECRET_API_TOKEN',
                    },
                },
            },
        };

        const result = SecretReferenceExtractor.extract(dto);

        expect(result).toEqual([]);
    });

    it('extracts SECRET_ from body recursively when is_dynamic_body is true', () => {
        const dto = {
            is_dynamic_body: 1,
            body: {
                body: {
                    user: {
                        token: 'SECRET_API_TOKEN',
                    },
                    nested: {
                        deep: {
                            value: 'SECRET_DEEP_VALUE',
                        },
                    },
                },
            },
        };

        const result = SecretReferenceExtractor.extract(dto);

        expect(result).toEqual(expect.arrayContaining(['API_TOKEN', 'DEEP_VALUE']));
        expect(result.length).toBe(2);
    });

    it('extracts correctly combining url and dynamic body only', () => {
        const dto = {
            url: 'https://SECRET_API_URL/cases',
            is_dynamic_body: 1,
            is_dynamic_header: 0,
            body: {
                body: {
                    token: 'SECRET_BODY_TOKEN',
                },
            },
            headers: {
                headers: {
                    'x-tenant-id': 'SECRET_TENANT',
                },
            },
        };

        const result = SecretReferenceExtractor.extract(dto);

        expect(result).toEqual(expect.arrayContaining(['API_URL', 'BODY_TOKEN']));
        expect(result).not.toContain('TENANT');
        expect(result.length).toBe(2);
    });

    it('does not duplicate references across url, headers, and body', () => {
        const dto = {
            url: 'https://SECRET_API_URL',
            is_dynamic_body: 1,
            is_dynamic_header: 1,
            body: {
                body: {
                    token: 'SECRET_API_URL',
                },
            },
            headers: {
                headers: {
                    'x-tenant-id': 'SECRET_API_URL',
                },
            },
        };

        const result = SecretReferenceExtractor.extract(dto);

        expect(result).toEqual(['API_URL']);
        expect(result.length).toBe(1);
    });

    it('ignores lowercase secret_', () => {
        const dto = {
            url: 'https://secret_api_url/cases',
            is_dynamic_body: 1,
            body: {
                body: {
                    token: 'secret_token',
                },
            },
        };

        const result = SecretReferenceExtractor.extract(dto);

        expect(result).toEqual([]);
    });
});

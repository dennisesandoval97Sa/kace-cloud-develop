import { KnexLiteralRepository } from '@kace/core/src/literals';
import LiteralMother from '@kace/core/tests/literals/domain/LiteralMother';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';

describe('LiteralsController test', () => {
    const repository = new KnexLiteralRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/literals`
            : `http://127.0.0.1:60032`;

    afterAll(async () => {
        try {
            await repository.connection.destroy();
        } catch (error) {
            console.log(error);
        }
    });

    it('should create a Literal', async () => {
        const payload = LiteralMother.dto();

        //Se agrega por el tipo de validación que tiene de un único nombre y una entidad que exista
        await repository.connection('literales').delete({ nombre: payload.nombre });

        const response = await TestHelper.postRequest(baseUrl, payload);

        expect(response.status).toBe(201);
    });

    it('should return statusCode 400 when validation fails to create a Literal', async () => {
        const payload = {};

        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response).toHaveProperty('status', 400);
    });

    it('should fetch a Literal', async () => {
        const literal = await LiteralMother.createLiteral(repository);
        const dataExpected = {
            id: literal.id.value,
            tipo_literal: literal.tipo_literal.value,
            nombre: literal.nombre.value,
            is_active: literal.is_active.value,
            created_at: literal.created_at.value,
            created_by: literal.created_by.value,
            updated_at: null,
            updated_by: null,
        };

        const response = await TestHelper.getRequest(`${baseUrl}/${literal.id.value}`);

        expect(response.status).toBe(200);
        expect(response.data.data).toEqual(dataExpected);
    });

    it('should fetch all Literals', async () => {
        const literal1 = await LiteralMother.createLiteral(repository);
        const literal2 = await LiteralMother.createLiteral(repository);

        const response = await TestHelper.getRequest(baseUrl);

        expect(response.status).toBe(200);
        expect(response.data.data.items[0].id).toEqual(literal2.id.value);
        expect(response.data.data.items[1].id).toEqual(literal1.id.value);
    });

    it('should delete a Literal', async () => {
        const literal = await LiteralMother.createLiteral(repository);

        const response = await TestHelper.getRequest(`${baseUrl}/${literal.id.value}/delete`);

        expect(response.status).toBe(200);
    });

    it('should update a Literal', async () => {
        const literal = await LiteralMother.createLiteral(repository);
        const payload = {
            is_active: 0,
        };

        const response = await TestHelper.postRequest(`${baseUrl}/${literal.id.value}`, payload);

        expect(response.status).toBe(200);
    });

    it('should return notFound when the resource doesnt exist', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}/invalid`);
        expect(response).toHaveProperty('status', 403);
    });

    it('should fetch Literals as select options (value/label) from /list', async () => {
        const tipoLiteralTarget = uuidv4();
        const tipoLiteralOther = uuidv4();

        const L1 = await LiteralMother.createLiteral(repository, {
            tipo_literal: tipoLiteralTarget,
            nombre: 'L1-target',
        });

        const L2 = await LiteralMother.createLiteral(repository, {
            tipo_literal: tipoLiteralTarget,
            nombre: 'L2-target',
        });

        await LiteralMother.createLiteral(repository, {
            tipo_literal: tipoLiteralOther,
            nombre: 'L3-other',
        });
        await LiteralMother.createLiteral(repository, {
            tipo_literal: tipoLiteralOther,
            nombre: 'L4-other',
        });

        const response = await TestHelper.getRequest(`${baseUrl}/${tipoLiteralTarget}/list`);

        expect(response.status).toBe(200);
        expect(response.data).toBeDefined();
        expect(response.data.data).toBeDefined();
        expect(Array.isArray(response.data.data.items)).toBe(true);

        const items = response.data.data.items;
        expect(items.length).toBe(2);

        expect(items[0]).toMatchObject({
            value: L2.id.value,
            label: L2.nombre.value,
        });

        expect(items[1]).toMatchObject({
            value: L1.id.value,
            label: L1.nombre.value,
        });

        const allowedKeys = ['value', 'label'];
        const hasOnlyAllowedKeys = Object.keys(items[0]).every((k) => allowedKeys.includes(k));
        expect(hasOnlyAllowedKeys).toBe(true);
    });
});

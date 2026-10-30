import { KnexBannersRepository } from '@kace/core/src/banners';
import BannerMother from '@kace/core/tests/banner/domain/BannerMother';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';

describe('BannerController test', () => {
    const repository = new KnexBannersRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/banners`
            : 'http://127.0.0.1:60007';

    beforeEach(async () => {
        await repository.connection.raw(`TRUNCATE TABLE ${repository.tableName} CASCADE`);
    });

    afterAll(async () => {
        try {
            repository.connection.destroy();
        } catch (error) {
            console.log(error);
        }
    });

    it('should create a Banner', async () => {
        const payload = BannerMother.dto();
        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response.status).toBe(201);
    });

    it('return statusCode 400 when validation fails to create a Banner', async () => {
        const payload = {};
        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response).toHaveProperty('status', 400);
    });

    it('should fetch a Banner', async () => {
        const banner = await BannerMother.createBanner(repository);
        const dataExpected = {
            id: banner.id.value,
            descripcion: banner.descripcion.value,
            propiedades: banner.propiedades.value,
            fecha_inicio: banner.fecha_inicio.value,
            fecha_fin: banner.fecha_fin.value,
            especificaciones: banner.especificaciones.value,
            status: banner.status.value,
            created_at: banner.created_at.value,
            updated_at: banner.updated_at.value,
            created_by: banner.created_by.value,
            updated_by: null,
        };

        const response = await TestHelper.getRequest(`${baseUrl}/${banner.id.value}`);

        expect(response.status).toBe(200);
        expect(response.data.data).toEqual(dataExpected);
    });

    it('should fetch all Banners', async () => {
        const banner1 = await BannerMother.createRandomBanner(repository);
        const banner2 = await BannerMother.createRandomBanner(repository);

        const response = await TestHelper.getRequest(baseUrl);
        expect(response.status).toBe(200);
        expect(response.data.data.items[0].id).toEqual(banner2.id.value);
        expect(response.data.data.items[1].id).toEqual(banner1.id.value);
    });

    it('should fetch banners using search', async () => {
        const bannerCreated = await BannerMother.createRandomBanner(repository);

        const dtoCriteria = {
            filter: [
                {
                    field: 'status',
                    operator: 'eq',
                    value: '1',
                    type: 'AND',
                },
            ],
            relationship: null,
            limit: 1,
            offset: 0,
            order: { field: 'created_at', direction: 'desc' },
        };

        const response = await TestHelper.postRequest(`${baseUrl}/search`, dtoCriteria);
        expect(response.status).toBe(200);
        expect(response.data.data.items.length).toEqual(1);
    });

    it('should delete a Banner', async () => {
        const banner = await BannerMother.createBanner(repository);

        const response = await TestHelper.getRequest(`${baseUrl}/${banner.id.value}/delete`);
        expect(response.status).toBe(200);
    });

    it('should update a Banner', async () => {
        const banner = await BannerMother.createBanner(repository);
        const payload = {
            descripcion: 'updated',
        };

        const response = await TestHelper.postRequest(`${baseUrl}/${banner.id.value}`, payload);

        expect(response.status).toBe(200);
    });

    it('should return notFound when the resource does not exist', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}/invalid`);
        expect(response).toHaveProperty('status', 403);
    });
});

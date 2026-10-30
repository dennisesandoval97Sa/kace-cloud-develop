import { KnexBannersRepository } from '../../src/banners/index.js';
import BannerMother from './domain/BannerMother.js';
import {
    Banner,
    BannerCreator,
    BannerDeleter,
    BannerFinder,
    BannerResponse,
    BannersSearcher,
    BannerUpdater,
} from '../../src/banners/index.js';
import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import { BannersSearchCollectionResponse } from '../../src/banners/application/BannersSearchCollectionResponse.js';
import { BannerCounter } from '../../src/banners/index.js';
import { BannersCountResponse } from '../../src/banners/application/BannersCountResponse.js';
import { InvalidArgumentError } from '../../src/shared/errors/InvalidArgumentError.js';
import { CustomError } from '../../src/shared/errors/CustomError.js';
import {
    DEFAULT_SHARED_VISUAL_COLOR,
    DEFAULT_SHARED_VISUAL_ICON,
    SHARED_VISUAL_COLOR_ALLOWLIST,
    SHARED_VISUAL_ICON_ALLOWLIST,
} from '../../src/shared/visual-options/sharedVisualOptions.js';

describe('BannerCreator', () => {
    const repository = new KnexBannersRepository(knexConfig);

    it('should create a Banner', async () => {
        const dto = BannerMother.dto();
        const bannerCreator = new BannerCreator(repository);

        await bannerCreator.execute(dto);

        const result = await repository.connection('banners').select('*').where('id', dto.id);

        expect(result.length).toBe(1);
    });

    it('should throw an error when creating an existing banner', async () => {
        const banner = await BannerMother.createBanner(repository);
        const bannerCreator = new BannerCreator(repository);

        const dto = { ...BannerMother.dto(), id: banner.id.value };
        await expect(bannerCreator.execute(dto)).rejects.toThrow(
            new CustomError(`Banner with id ${dto.id} already exists`)
        );
    });

    it('can i get a existing banner', async () => {
        const banner = await BannerMother.createBanner(repository);
        const bannerFinder = new BannerFinder(repository);
        const bannerResult = await bannerFinder.execute(banner.id.value);

        expect(bannerResult).not.toBeNull();
        expect(bannerResult).toBeInstanceOf(BannerResponse);
    });

    it('can update a existing banner', async () => {
        const banner = await BannerMother.createBanner(repository);
        const bannerUpdater = new BannerUpdater(repository);

        const data = {
            descripcion: 'new name',
            propiedades: {
                color: SHARED_VISUAL_COLOR_ALLOWLIST[1],
                position: 'top-right',
                icon: SHARED_VISUAL_ICON_ALLOWLIST[0],
            },
            especificaciones: {
                groups: [uuidv4()],
            },
        };
        await bannerUpdater.execute(banner.id.value, data);

        const result = await repository.find(banner.id);
        expect(result).toBeInstanceOf(Banner);
        expect(result.descripcion.value).toBe('new name');
    });

    it('should throw an error when updating a non-existent banner', async () => {
        const nonExistentId = uuidv4();
        const bannerUpdater = new BannerUpdater(repository);

        const updateData = {
            descripcion: 'new description',
            propiedades: {
                color: '#FF0000',
                position: 'bottom-left',
                icon: 'warning',
            },
            especificaciones: {
                groups: [uuidv4()],
            },
        };

        await expect(bannerUpdater.execute(nonExistentId, updateData)).rejects.toThrow(
            new CustomError(`Banner with id ${nonExistentId} does not exist.`)
        );
    });

    it('searches for Banner instances with given criteria', async () => {
        for (let i = 0; i < 10; i++) {
            await BannerMother.createBanner(repository);
        }
        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const BannersSearch = new BannersSearcher(repository);

        const BannersResult = await BannersSearch.execute(dtoCriteria);
        expect(BannersResult).toBeInstanceOf(BannersSearchCollectionResponse);
        expect(Number(BannersResult.toJson().metadata.count)).toEqual(10);
    });

    it('searches for Banner instances with given criteria with filter', async () => {
        for (let i = 0; i < 10; i++) {
            await BannerMother.createRandomBanner(repository);
        }
        const dtoCriteria = {
            filter: [
                {
                    field: 'status',
                    operator: 'eq',
                    value: '1',
                    type: 'and',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const BannersSearch = new BannersSearcher(repository);

        const BannersResult = await BannersSearch.execute(dtoCriteria);
        expect(BannersResult).toBeInstanceOf(BannersSearchCollectionResponse);
    });

    it('counter for Banner instances with given criteria', async () => {
        // El `await` faltaba: las diez creaciones quedaban en vuelo y el contador
        // leia la tabla a medio sembrar, de ahi el "7" que devolvia postgres.
        for (let i = 0; i < 10; i++) {
            await BannerMother.createRandomBanner(repository);
        }

        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const bannerCount = new BannerCounter(repository);

        const bannerResult = await bannerCount.execute(dtoCriteria);
        expect(bannerResult).toBeInstanceOf(BannersCountResponse);
        expect(Number(bannerResult.toJson().count)).toEqual(10);
    });

    it('return null if not found a record', async () => {
        const bannerFinder = new BannerFinder(repository);

        await expect(bannerFinder.execute(uuidv4())).rejects.toThrow(CustomError);
    });

    it('can delete a existing banner', async () => {
        const banner = await BannerMother.createBanner(repository);
        const bannerDeleter = new BannerDeleter(repository);

        await bannerDeleter.execute(banner.id.value, {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        });

        const result = await repository.find(banner.id);
        expect(result).toBeNull();
    });

    it('should throw an error if banner to delete does not exist', async () => {
        const nonExistentId = uuidv4();
        const bannerDeleter = new BannerDeleter(repository);

        await expect(
            bannerDeleter.execute(nonExistentId, {
                deleted_at: new Date().toISOString(),
                deleted_by: uuidv4(),
            })
        ).rejects.toThrow(new CustomError(`Banner with id ${nonExistentId} does not exist.`, 404));
    });

    it('Should generate a default value when the color value is null', async () => {
        const dto = BannerMother.dto();
        const bannerCreator = new BannerCreator(repository);
        dto.propiedades.color = null;

        await bannerCreator.execute(dto);

        const bannerFinder = new BannerFinder(repository);
        const bannerResult = await bannerFinder.execute(dto.id);
        const banner = bannerResult.toJson();

        expect(banner.data.propiedades.color).toBe(DEFAULT_SHARED_VISUAL_COLOR);
    });

    it('should throw an error when color value is invalid', async () => {
        const dto = BannerMother.dto();
        const bannerCreator = new BannerCreator(repository);
        dto.propiedades.color = 'invalidColor';

        await expect(bannerCreator.execute(dto)).rejects.toThrow(
            new InvalidArgumentError('color: Invalid value invalidColor for object color')
        );
    });

    it('should throw an error when position value is null', async () => {
        const dto = BannerMother.dto();
        const bannerCreator = new BannerCreator(repository);
        dto.propiedades.position = null;

        await expect(bannerCreator.execute(dto)).rejects.toThrow(
            new InvalidArgumentError('Invalid position value: null')
        );
    });

    it('should throw an error when position value is invalid', async () => {
        const dto = BannerMother.dto();
        const bannerCreator = new BannerCreator(repository);
        dto.propiedades.position = 'invalidPosition';

        await expect(bannerCreator.execute(dto)).rejects.toThrow(
            new InvalidArgumentError('Invalid position value: invalidPosition')
        );
    });

    it('should generate a default value when icon value is null', async () => {
        const dto = BannerMother.dto();
        const bannerCreator = new BannerCreator(repository);
        dto.propiedades.icon = null;

        await bannerCreator.execute(dto);

        const bannerFinder = new BannerFinder(repository);
        const bannerResult = await bannerFinder.execute(dto.id);
        const banner = bannerResult.toJson();

        expect(banner.data.propiedades.icon).toBe(DEFAULT_SHARED_VISUAL_ICON);
    });

    it('should throw an error when icon value is invalid', async () => {
        const dto = BannerMother.dto();
        const bannerCreator = new BannerCreator(repository);
        dto.propiedades.icon = 2;

        await expect(bannerCreator.execute(dto)).rejects.toThrow(
            new InvalidArgumentError('icon: The value must be a string')
        );
    });

    it('should throw an error when creating a Banner with a duplicate title', async () => {
        const dto1 = BannerMother.dto();
        const dto2 = BannerMother.dto();
        dto2.descripcion = dto1.descripcion;

        const bannerCreator = new BannerCreator(repository);
        await bannerCreator.execute(dto1);

        await expect(bannerCreator.execute(dto2)).rejects.toThrow(
            new CustomError(`The following value(s) already exist: descripcion '${dto1.descripcion}'.`)
        );
    });

    it('should throw an error when updating a Banner to have a duplicate title', async () => {
        const banner1 = await BannerMother.createBanner(repository);
        const banner2 = await BannerMother.createBanner(repository);

        const bannerUpdater = new BannerUpdater(repository);
        await expect(
            bannerUpdater.execute(banner2.id.value, { descripcion: banner1.descripcion.value })
        ).rejects.toThrow(
            new CustomError(`The following value(s) already exist: descripcion '${banner1.descripcion.value}'.`)
        );
    });
});

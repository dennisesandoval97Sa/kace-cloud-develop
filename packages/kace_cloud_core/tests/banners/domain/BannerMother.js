import { v4 as uuidV4 } from 'uuid';
import { Banner, KnexBannersRepository } from '../../../src/banners/index.js';
import Chance from 'chance';
import { StatusEnum } from '../../../src/shared/index.js';
import {
    DEFAULT_SHARED_VISUAL_COLOR,
    DEFAULT_SHARED_VISUAL_ICON,
    SHARED_VISUAL_COLOR_ALLOWLIST,
    SHARED_VISUAL_ICON_ALLOWLIST,
} from '../../../src/shared/visual-options/sharedVisualOptions.js';

const BannerPositionEnum = {
    TOP_LEFT: 'top-left',
    TOP_CENTER: 'top-center',
    TOP_RIGHT: 'top-right',
    BOTTOM_LEFT: 'bottom-left',
    BOTTOM_CENTER: 'bottom-center',
    BOTTOM_RIGHT: 'bottom-right',
};

export default class BannerMother {
    /**
     * Generates a Data Transfer Object (DTO) for the `Banner` entity.
     *
     * @returns {Object} The DTO containing the properties for an `Banner` entity.
     */
    static dto() {
        return {
            id: uuidV4(),
            descripcion: 'Banner text example',
            propiedades: {
                color: DEFAULT_SHARED_VISUAL_COLOR,
                position: BannerPositionEnum.BOTTOM_LEFT,
                icon: DEFAULT_SHARED_VISUAL_ICON,
            },
            fecha_inicio: this.getDateWithOnlyDate(),
            fecha_fin: this.getDateWithOnlyDate(1),
            especificaciones: {
                users: null,
                groups: [uuidV4()],
                clients: null,
            },
            status: StatusEnum.ACTIVE.value,
            created_at: new Date().toISOString(),
            created_by: uuidV4(),
        };
    }

    /**
     * Generates a random Data Transfer Object (DTO) for the `Banner` entity.
     *
     * @returns {Object} The DTO containing random properties for an `Banner` entity.
     */
    static randomDto() {
        const chance = new Chance();
        return {
            id: uuidV4(),
            descripcion: chance.sentence({ words: 3 }),
            propiedades: {
                color: chance.pickone(SHARED_VISUAL_COLOR_ALLOWLIST),
                position: chance.pickone(Object.values(BannerPositionEnum)),
                icon: chance.pickone(SHARED_VISUAL_ICON_ALLOWLIST),
            },
            fecha_inicio: this.getDateWithOnlyDate(),
            fecha_fin: this.getDateWithOnlyDate(1),
            especificaciones: {
                users: null,
                groups: [uuidV4()],
                clients: null,
            },
            status: 1,
            created_at: new Date().toISOString(),
            created_by: uuidV4(),
        };
    }

    /**
     * Creates an `Banner` instance with random properties and saves it to the repository.
     *
     * @param {KnexBannersRepository} repository - The repository to save the `Banner` instance.
     * @returns {Banner} The created `Banner` instance.
     */
    static async createRandomBanner(repository) {
        const banner = Banner.create(BannerMother.randomDto());
        await repository.save(banner);
        return banner;
    }

    /**
     * Creates an `Banner` instance and saves it to the repository.
     *
     * @param {KnexBannersRepository} repository - The repository to save the `Banner` instance.
     * @returns {Banner} The created `Banner` instance.
     */
    static async createBanner(repository) {
        const banner = Banner.create(BannerMother.dto());
        await repository.save(banner);
        return banner;
    }

    static getDateWithOnlyDate(addDays = 0) {
        const today = new Date();
        today.setDate(today.getDate() + addDays);
        return today.toISOString().split('T')[0];
    }
}

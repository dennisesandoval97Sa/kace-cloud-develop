import { InvalidArgumentError } from '../../src/shared/errors/InvalidArgumentError.js';
import { Banner } from '../../src/banners/index.js';
import BannerMother from './domain/BannerMother.js';

describe('Banner visual allowlist validation', () => {
    it('creates a banner with allowlisted icon and color values', () => {
        const banner = Banner.create(BannerMother.dto());

        expect(banner.propiedades.value.icon).toBe(BannerMother.dto().propiedades.icon);
        expect(banner.propiedades.value.color).toBe(BannerMother.dto().propiedades.color);
    });

    it('rejects manipulated icon values on create', () => {
        expect(() =>
            Banner.create({ ...BannerMother.dto(), propiedades: { ...BannerMother.dto().propiedades, icon: 'check' } })
        ).toThrow(new InvalidArgumentError('icon: Unsupported visual icon check'));
    });

    it('rejects manipulated color values on update', () => {
        const banner = Banner.create(BannerMother.dto());

        expect(() => banner.update({ propiedades: { ...banner.propiedades.value, color: '#FFFFFF' } })).toThrow(
            new InvalidArgumentError('color: Unsupported visual color #FFFFFF')
        );
    });
});

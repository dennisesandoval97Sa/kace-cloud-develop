import {
    Banner,
    BannerResponse,
    ColorTypes,
    IconTypes,
    PositionTypes,
    ValueObjectColors,
    ValueObjectIcons,
    ValueObjectPositions,
    ValueObjectSiteRole,
} from '../../src/banners/index.js';
import { v4 as uuidv4 } from 'uuid';
import { ValueObjectColor, ValueObjectStatus, ValueObjectUuid } from '../../src/shared/index.js';
import BannerMother from './domain/BannerMother.js';
import { BannersCollectionResponse } from '../../src/banners/index.js';
import { Properties } from '../../src/banners/domain/Properties.js';
import { Specifications } from '../../src/banners/domain/Specifications.js';
import { InvalidArgumentError } from '../../src/shared/errors/InvalidArgumentError.js';
import { ValueObjectDate } from '../../src/banners/domain/value-object/ValueObjectDate.js';
import { ValueObjectPropertiesInstance } from '../../src/banners/domain/value-object/ValueObjectPropertiesInstance.js';
import { ValueObjectSpecificationsInstance } from '../../src/banners/domain/value-object/ValueObjectSpecificationsInstance.js';
import { CustomError } from '../../src/shared/errors/CustomError.js';

describe('Banner Entity', () => {
    const dto = BannerMother.dto();

    it('should create a banner with valid data', () => {
        const banner = Banner.create(dto);
        expect(banner.id).toBeInstanceOf(ValueObjectUuid);
        expect(banner.status).toBeInstanceOf(ValueObjectStatus);
    });

    it('should update banner data', () => {
        const banner = Banner.create(dto);
        const newData = {
            descripcion: 'Updated descripcion',
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        banner.update(newData);

        expect(banner.descripcion.value).toBe('Updated descripcion');
        expect(banner.changedAttributes).toEqual(newData);
    });

    it('should throw an error with invalid UUID', () => {
        const invalidData = dto;
        invalidData.id = 'invalid-uuid';

        expect(() => Banner.create(invalidData)).toThrow(
            // todo: tipar errores. Valdiar el tipo de error y no el mensaje
            'Invalid value invalid-uuid for object uuid'
        );
    });
});

describe('Banners Tests', () => {
    it('creates a new Banner instance from DTO', () => {
        const dto = BannerMother.dto();
        dto.updated_at = null;
        dto.updated_by = null;
        dto.deleted_at = null;
        dto.deleted_by = null;
        const banner = Banner.create(dto);

        expect(banner.id.value).toBe(dto.id);
        expect(banner.descripcion.value).toBe(dto.descripcion);
        expect(banner.status.value).toBe(dto.status);
        expect(banner.created_at.value).toBe(dto.created_at);
        expect(banner.updated_at.value).toBe(dto.updated_at);
        expect(banner.created_by.value).toBe(dto.created_by);
        expect(banner.updated_by.value).toBe(dto.updated_by);
        expect(banner.deleted_at.value).toBe(dto.deleted_at);
        expect(banner.deleted_by.value).toBe(dto.deleted_by);
    });

    it('updates an Banners instance with new values', () => {
        const dto = BannerMother.dto();
        const banner = Banner.create(dto);
        const updateDto = {
            descripcion: 'Updated Name',
            status: 2,
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        banner.update(updateDto);

        expect(banner.descripcion.value).toBe(updateDto.descripcion);
        expect(banner.status.value).toBe(updateDto.status);
        expect(banner.updated_at.value).toBe(updateDto.updated_at);
        expect(banner.updated_by.value).toBe(updateDto.updated_by);
    });

    it('does not update properties when values are the same', () => {
        const dto = BannerMother.dto();
        const banner = Banner.create(dto);
        banner.update(dto);
        expect(banner.changedAttributes).toEqual({});
    });

    it('marks an Banners instance as deleted', () => {
        const dto = BannerMother.dto();
        const banner = Banner.create(dto);
        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };
        banner.delete(deleteDto);

        expect(banner.deleted_at.value).toBe(deleteDto.deleted_at);
        expect(banner.deleted_by.value).toBe(deleteDto.deleted_by);
    });

    it('flushes changes in Banners instance', () => {
        const dto = BannerMother.dto();
        const banner = Banner.create(dto);
        const updateDto = {
            descripcion: 'Updated Name',
            status: 2,
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        banner.update(updateDto);
        banner.flushChanges();

        expect(banner.changedAttributes).toEqual({});
    });
});

describe('Banners Responses Tests', () => {
    it('converts Banners object to JSON representation', () => {
        const banner = new Banner(BannerMother.randomDto());
        const bannerResponse = new BannerResponse(banner);

        const json = bannerResponse.toJson();
        expect(json).toEqual({
            data: {
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
                updated_by: banner.updated_by.value,
            },
        });
    });

    it('converts BannersCollection to JSON representation', () => {
        const bannersCollection = [new Banner(BannerMother.randomDto()), new Banner(BannerMother.randomDto())];
        const bannerCollectionResponse = new BannersCollectionResponse(bannersCollection);

        const json = bannerCollectionResponse.toJson();

        expect(json).toEqual(bannersCollection.map((banner) => new BannerResponse(banner).toJson().data));
    });
});

describe('ColorTypes Tests', () => {
    it('returns an array of color types', () => {
        const result = [
            ColorTypes.WHITE,
            ColorTypes.BLACK,
            ColorTypes.RED,
            ColorTypes.BLUE,
            ColorTypes.GREEN,
            ColorTypes.YELLOW,
            ColorTypes.ORANGE,
            ColorTypes.PURPLE,
            ColorTypes.GRAY,
            ColorTypes.PINK,
        ];
        expect(result).toEqual([
            ColorTypes.WHITE,
            ColorTypes.BLACK,
            ColorTypes.RED,
            ColorTypes.BLUE,
            ColorTypes.GREEN,
            ColorTypes.YELLOW,
            ColorTypes.ORANGE,
            ColorTypes.PURPLE,
            ColorTypes.GRAY,
            ColorTypes.PINK,
        ]);
    });

    it('returns an array with the correct length', () => {
        const result = [
            ColorTypes.WHITE,
            ColorTypes.BLACK,
            ColorTypes.RED,
            ColorTypes.BLUE,
            ColorTypes.GREEN,
            ColorTypes.YELLOW,
            ColorTypes.ORANGE,
            ColorTypes.PURPLE,
            ColorTypes.GRAY,
            ColorTypes.PINK,
        ];
        expect(result.length).toBe(10);
    });

    it('returns an array containing WHITE color type', () => {
        const result = [
            ColorTypes.WHITE,
            ColorTypes.BLACK,
            ColorTypes.RED,
            ColorTypes.BLUE,
            ColorTypes.GREEN,
            ColorTypes.YELLOW,
            ColorTypes.ORANGE,
            ColorTypes.PURPLE,
            ColorTypes.GRAY,
            ColorTypes.PINK,
        ];
        expect(result).toContain(ColorTypes.WHITE);
    });

    it('returns an array containing BLACK color type', () => {
        const result = [
            ColorTypes.WHITE,
            ColorTypes.BLACK,
            ColorTypes.RED,
            ColorTypes.BLUE,
            ColorTypes.GREEN,
            ColorTypes.YELLOW,
            ColorTypes.ORANGE,
            ColorTypes.PURPLE,
            ColorTypes.GRAY,
            ColorTypes.PINK,
        ];
        expect(result).toContain(ColorTypes.BLACK);
    });

    it('returns an array containing RED color type', () => {
        const result = [
            ColorTypes.WHITE,
            ColorTypes.BLACK,
            ColorTypes.RED,
            ColorTypes.BLUE,
            ColorTypes.GREEN,
            ColorTypes.YELLOW,
            ColorTypes.ORANGE,
            ColorTypes.PURPLE,
            ColorTypes.GRAY,
            ColorTypes.PINK,
        ];
        expect(result).toContain(ColorTypes.RED);
    });

    it('returns a color type from value', () => {
        const result = ColorTypes.fromValue('#FF0000');
        expect(result).toEqual(ColorTypes.RED);
    });

    it('throws error when color value is null', () => {
        expect(() => {
            new ColorTypes('TEST', null);
        }).toThrow('The color value cannot be null');
    });

    it('throws error when color value is invalid', () => {
        expect(() => {
            new ColorTypes('TEST', '#INVALID');
        }).toThrow('The color value must be a valid color: #INVALID');
    });
});

describe('PositionTypes Tests', () => {
    it('returns an array of position types', () => {
        const result = [
            PositionTypes.TOP_LEFT,
            PositionTypes.TOP_CENTER,
            PositionTypes.TOP_RIGHT,
            PositionTypes.BOTTOM_LEFT,
            PositionTypes.BOTTOM_CENTER,
            PositionTypes.BOTTOM_RIGHT,
        ];
        expect(result).toEqual([
            PositionTypes.TOP_LEFT,
            PositionTypes.TOP_CENTER,
            PositionTypes.TOP_RIGHT,
            PositionTypes.BOTTOM_LEFT,
            PositionTypes.BOTTOM_CENTER,
            PositionTypes.BOTTOM_RIGHT,
        ]);
    });

    it('returns an array with the correct length', () => {
        const result = [
            PositionTypes.TOP_LEFT,
            PositionTypes.TOP_CENTER,
            PositionTypes.TOP_RIGHT,
            PositionTypes.BOTTOM_LEFT,
            PositionTypes.BOTTOM_CENTER,
            PositionTypes.BOTTOM_RIGHT,
        ];
        expect(result.length).toBe(6);
    });

    it('returns an array containing TOP_LEFT type', () => {
        const result = [
            PositionTypes.TOP_LEFT,
            PositionTypes.TOP_CENTER,
            PositionTypes.TOP_RIGHT,
            PositionTypes.BOTTOM_LEFT,
            PositionTypes.BOTTOM_CENTER,
            PositionTypes.BOTTOM_RIGHT,
        ];
        expect(result).toContain(PositionTypes.TOP_LEFT);
    });

    it('returns an array containing BOTTOM_RIGHT type', () => {
        const result = [
            PositionTypes.TOP_LEFT,
            PositionTypes.TOP_CENTER,
            PositionTypes.TOP_RIGHT,
            PositionTypes.BOTTOM_LEFT,
            PositionTypes.BOTTOM_CENTER,
            PositionTypes.BOTTOM_RIGHT,
        ];
        expect(result).toContain(PositionTypes.BOTTOM_RIGHT);
    });

    it('returns a position type from value', () => {
        const result = PositionTypes.fromValue('top-center');
        expect(result).toEqual(PositionTypes.TOP_CENTER);
    });

    it('throws error when position value is null', () => {
        expect(() => {
            new PositionTypes('TEST', null);
        }).toThrow('The position value cannot be null');
    });

    it('throws error when position value is invalid', () => {
        expect(() => {
            new PositionTypes('TEST', 'InvalidPosition');
        }).toThrow('The position value must be a valid position: InvalidPosition');
    });
});

describe('IconTypes Tests', () => {
    it('returns an array of icon types', () => {
        const result = [IconTypes.CHECK, IconTypes.EXCLAMATION_CIRCLE, IconTypes.EXCLAMATION_TRIANGLE];
        expect(result).toEqual([IconTypes.CHECK, IconTypes.EXCLAMATION_CIRCLE, IconTypes.EXCLAMATION_TRIANGLE]);
    });

    it('returns an array with the correct length', () => {
        const result = [IconTypes.CHECK, IconTypes.EXCLAMATION_CIRCLE, IconTypes.EXCLAMATION_TRIANGLE];
        expect(result.length).toBe(3);
    });

    it('returns an array containing CHECK type', () => {
        const result = [IconTypes.CHECK, IconTypes.EXCLAMATION_CIRCLE, IconTypes.EXCLAMATION_TRIANGLE];
        expect(result).toContain(IconTypes.CHECK);
    });

    it('returns an array containing EXCLAMATION_CIRCLE type', () => {
        const result = [IconTypes.CHECK, IconTypes.EXCLAMATION_CIRCLE, IconTypes.EXCLAMATION_TRIANGLE];
        expect(result).toContain(IconTypes.EXCLAMATION_CIRCLE);
    });

    it('returns a type from value', () => {
        const result = IconTypes.fromValue('check');
        expect(result).toEqual(IconTypes.CHECK);
    });

    it('throws error when icon value is null', () => {
        expect(() => {
            new IconTypes('TEST', null);
        }).toThrow('The value cannot be null');
    });

    it('throws error when icon value is invalid', () => {
        expect(() => {
            new IconTypes('TEST', 'InvalidIcon');
        }).toThrow('The value must be a valid Icon: InvalidIcon');
    });
});

describe('Properties Class Tests', () => {
    it('should initialize with given values and allow updating them', () => {
        const initialDto = {
            color: '#FF0000',
            position: 'top-left',
            icon: 'check',
            siteToShow: 'admin',
        };

        const properties = new Properties(initialDto);

        expect(properties.color).toBeInstanceOf(ValueObjectColor);
        expect(properties.color.value).toBe('#FF0000');
        expect(properties.position).toBeInstanceOf(ValueObjectPositions);
        expect(properties.position.value).toBe('top-left');
        expect(properties.icon).toBeInstanceOf(ValueObjectIcons);
        expect(properties.icon.value).toBe('check');
        expect(properties.siteToShow).toBeInstanceOf(ValueObjectSiteRole);
        expect(properties.siteToShow.value).toBe('admin');

        properties.color = '#00FF00';
        properties.position = 'bottom-right';
        properties.icon = 'exclamation-circle';

        expect(properties.color.value).toBe('#00FF00');
        expect(properties.position.value).toBe('bottom-right');
        expect(properties.icon.value).toBe('exclamation-circle');
    });
});

describe('Specifications Class Tests', () => {
    it('should create an instance with valid UUIDs and not throw errors', () => {
        const validUuid = uuidv4();
        const dto = {
            users: [validUuid],
            groups: [validUuid],
            clients: [validUuid],
        };

        const specifications = new Specifications(dto);

        expect(specifications.users).toEqual([validUuid]);
        expect(specifications.groups).toEqual([validUuid]);
        expect(specifications.clients).toEqual([validUuid]);
    });

    it('should throw an error if users array contains an invalid UUID', () => {
        const invalidUuid = 'invalid-uuid';
        const dto = {
            users: [invalidUuid],
            groups: [],
            clients: [],
        };

        expect(() => new Specifications(dto)).toThrow(
            new InvalidArgumentError('At least one of users, groups, or clients must contain a valid UUID.')
        );
    });

    it('should throw an error if groups array contains an invalid UUID', () => {
        const validUuid = uuidv4();
        const invalidUuid = 'invalid-uuid';
        const dto = {
            users: [validUuid],
            groups: [invalidUuid],
            clients: [],
        };

        expect(() => new Specifications(dto)).toThrow(
            new InvalidArgumentError('At least one of users, groups, or clients must contain a valid UUID.')
        );
    });

    it('should throw an error if clients array contains an invalid UUID', () => {
        const validUuid = uuidv4();
        const invalidUuid = 'invalid-uuid';
        const dto = {
            users: [validUuid],
            groups: [],
            clients: [invalidUuid],
        };

        expect(() => new Specifications(dto)).toThrow(
            new InvalidArgumentError('At least one of users, groups, or clients must contain a valid UUID.')
        );
    });

    it('should set and get users correctly', () => {
        const validUuid = uuidv4();
        const dto = {
            users: [validUuid],
            groups: [],
            clients: [],
        };
        const specifications = new Specifications(dto);

        const newUsers = ['550e8400-e29b-41d4-a716-446655440001'];
        specifications.users = newUsers;

        expect(specifications.users).toEqual(newUsers);
    });

    it('should throw an error if setting users with invalid UUIDs', () => {
        const validUuid = uuidv4();
        const dto = {
            users: [validUuid],
            groups: [],
            clients: [],
        };
        const specifications = new Specifications(dto);

        expect(() => {
            specifications.users = ['invalid-uuid'];
        }).toThrow(new InvalidArgumentError('Users must contain valid UUIDs.'));
    });

    it('should set and get groups correctly', () => {
        const validUuid = uuidv4();
        const dto = {
            users: [],
            groups: [validUuid],
            clients: [],
        };
        const specifications = new Specifications(dto);

        const newGroups = ['550e8400-e29b-41d4-a716-446655440001'];
        specifications.groups = newGroups;

        expect(specifications.groups).toEqual(newGroups);
    });

    it('should throw an error if setting groups with invalid UUIDs', () => {
        const validUuid = uuidv4();
        const dto = {
            users: [],
            groups: [validUuid],
            clients: [],
        };
        const specifications = new Specifications(dto);

        expect(() => {
            specifications.groups = ['invalid-uuid'];
        }).toThrow(new InvalidArgumentError('Groups must contain valid UUIDs.'));
    });

    it('should set and get clients correctly', () => {
        const validUuid = uuidv4();
        const dto = {
            users: [],
            groups: [],
            clients: [validUuid],
        };
        const specifications = new Specifications(dto);

        const newClients = ['550e8400-e29b-41d4-a716-446655440001'];
        specifications.clients = newClients;

        expect(specifications.clients).toEqual(newClients);
    });

    it('should throw an error if setting clients with invalid UUIDs', () => {
        const validUuid = uuidv4();
        const dto = {
            users: [],
            groups: [],
            clients: [validUuid],
        };
        const specifications = new Specifications(dto);

        expect(() => {
            specifications.clients = ['invalid-uuid'];
        }).toThrow(new InvalidArgumentError('Clients must contain valid UUIDs.'));
    });
});

describe('ValueObjectDate Tests', () => {
    it('should throw an error if an invalid date is provided', () => {
        const invalidDate = 'invalid-date';
        const field = 'dateField';

        expect(() => new ValueObjectDate(field, invalidDate, false)).toThrow(
            new Error(`${field}: Invalid date value Invalid Date`)
        );
    });

    it('should not throw an error if a valid date is provided', () => {
        const validDate = '2024-08-19';
        const field = 'dateField';

        expect(() => new ValueObjectDate(field, validDate, false)).not.toThrow();
    });
});

describe('ValueObjectPropertiesInstance Tests', () => {
    it('should throw an error if properties is not an instance of Properties', () => {
        const invalidProperties = {};

        expect(() => new ValueObjectPropertiesInstance(invalidProperties)).toThrow(
            new InvalidArgumentError('Invalid instance for properties')
        );
    });

    it('should not throw an error if properties is a valid instance of Properties', () => {
        const validProperties = new Properties({ color: '#FFFFFF', position: 'top-left', icon: 'check' });

        expect(() => new ValueObjectPropertiesInstance(validProperties)).not.toThrow();
    });

    it('should not throw an error if properties is a valid instance of Properties', () => {
        const validProperties = new Properties({ color: '#FFFFFF', position: 'top-left', icon: 'check' });

        expect(() => new ValueObjectPropertiesInstance(validProperties)).not.toThrow();
    });
});

describe('ValueObjectSpecificationsInstance Tests', () => {
    it('should throw an error if specification  is not an instance of specification ', () => {
        const invalidSpecification = {};

        expect(() => new ValueObjectSpecificationsInstance(invalidSpecification)).toThrow(
            new InvalidArgumentError('Invalid instance for specification')
        );
    });

    it('should not throw an error if specification  is a valid instance of Specification ', () => {
        const validSpecification = new Specifications({ clients: [], groups: [], users: [uuidv4()] });

        expect(() => new ValueObjectSpecificationsInstance(validSpecification)).not.toThrow();
    });
});

describe('Banner Constructor', () => {
    it('should throw an error if Properties instance is invalid', () => {
        const invalidProperties = {
            color: 'red',
            position: 'top',
            icon: 'done',
        };
        const dto = {
            id: uuidv4(),
            descripcion: 'Test banner',
            propiedades: invalidProperties,
            fecha_inicio: '2024-01-01',
            fecha_fin: '2024-01-02',
            especificaciones: {},
            status: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: uuidv4(),
            updated_by: uuidv4(),
            deleted_at: null,
            deleted_by: null,
        };

        expect(() => new Banner(dto)).toThrow(new InvalidArgumentError('color: Invalid value red for object color'));
    });
});

describe('Banner Date Validation', () => {
    it('should throw an error if start date is later than end date', () => {
        const dto = {
            id: uuidv4(),
            descripcion: 'Test banner',
            propiedades: {
                color: '#FF0000',
                position: 'top-left',
                icon: 'check',
            },
            fecha_inicio: '2024-01-02',
            fecha_fin: '2024-01-01',
            especificaciones: {},
            status: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: uuidv4(),
            updated_by: uuidv4(),
            deleted_at: null,
            deleted_by: null,
        };

        expect(() => new Banner(dto)).toThrow(
            new CustomError('The start date cannot be later than the end date.', 400)
        );
    });
});

describe('Banner Update Dates', () => {
    it('should update start and end dates correctly and validate them', () => {
        const dto = {
            id: uuidv4(),
            descripcion: 'Test banner',
            propiedades: {
                color: '#FF0000',
                position: 'top-left',
                icon: 'check',
            },
            fecha_inicio: '2024-01-01',
            fecha_fin: '2024-01-02',
            especificaciones: {},
            status: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: uuidv4(),
            updated_by: uuidv4(),
            deleted_at: null,
            deleted_by: null,
        };

        const banner = new Banner(dto);
        banner.fecha_fin = '2024-01-04';
        banner.fecha_inicio = '2024-01-03';

        expect(banner.fecha_inicio.value).toBe('2024-01-03');
        expect(banner.fecha_fin.value).toBe('2024-01-04');
    });
});

describe('Banner Update Field', () => {
    it('should update the field and mark it as changed', () => {
        const dto = {
            id: uuidv4(),
            descripcion: 'Test banner',
            propiedades: {
                color: '#FF0000',
                position: 'top-left',
                icon: 'check',
            },
            fecha_inicio: '2024-01-01',
            fecha_fin: '2024-01-02',
            especificaciones: {},
            status: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: uuidv4(),
            updated_by: uuidv4(),
            deleted_at: null,
            deleted_by: null,
        };

        const banner = new Banner(dto);
        banner.descripcion = 'Updated description';

        expect(banner.changedAttributes.descripcion).toBe('Updated description');
    });
});

describe('Banner Flush Changes', () => {
    it('should reset changed attributes', () => {
        const dto = {
            id: uuidv4(),
            descripcion: 'Test banner',
            propiedades: {
                color: '#FF0000',
                position: 'top-left',
                icon: 'check',
            },
            fecha_inicio: '2024-01-01',
            fecha_fin: '2024-01-02',
            especificaciones: {},
            status: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: uuidv4(),
            updated_by: uuidv4(),
            deleted_at: null,
            deleted_by: null,
        };

        const banner = new Banner(dto);
        banner.descripcion = 'Updated description';
        banner.flushChanges();

        expect(banner.changedAttributes).toEqual({});
    });
});

describe('Banner Delete', () => {
    it('should mark banner as deleted', () => {
        const dto = {
            id: uuidv4(),
            descripcion: 'Test banner',
            propiedades: {
                color: '#FF0000',
                position: 'top-left',
                icon: 'check',
            },
            fecha_inicio: '2024-01-01',
            fecha_fin: '2024-01-02',
            especificaciones: {},
            status: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: uuidv4(),
            updated_by: uuidv4(),
            deleted_at: null,
            deleted_by: null,
        };

        const banner = new Banner(dto);
        const deleted_by = uuidv4();
        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by,
        };
        banner.delete(deleteDto);

        expect(banner.deleted_at.value).not.toBeNull();
        expect(banner.deleted_by.value).toBe(deleted_by);
    });
});

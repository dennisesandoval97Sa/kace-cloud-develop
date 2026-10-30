import { GeolocationResponse } from '../../src/geolocation/application/GeolocationResponse.js';
import { GeolocationCreator } from '../../src/geolocation/application/create/GeolocationCreator.js';
import { GeolocationFinder } from '../../src/geolocation/application/find/GeolocationFinder.js';
import { KnexGeolocationRepository } from '../../src/geolocation/infrastructure/persistence/KnexGeolocationRepository.js';
import { GeolocationsMother } from './domain/GeolocationsMother.js';
import { GeolocationUpdater } from '../../src/geolocation/application/update/GeolocationUpdater.js';
import { FindAllGeolocation } from '../../src/geolocation/application/find-all/FindAllGeolocation.js';
import { GeolocationCollectionResponse } from '../../src/geolocation/application/GeolocationCollectionResponse.js';
import UsersMother from '../users/domain/UsersMother.js';
import { KnexUsersRepository } from '../../src/users/infrastructure/KnexUsersRepository.js';
import { knexConfig } from '../knexfile.js';
import { ValidationFailError } from '../../src/shared/index.js';
import { GeolocationSearcher } from '../../src/geolocation/application/search/GeolocationSearcher.js';
import { GeolocationDeleter } from '../../src/geolocation/application/delete/GeolocationDeleter.js';
import { Geolocation } from '../../src/geolocation/domain/Geolocation.js';
import { v4 as uuidv4 } from 'uuid';

describe('Geolocation Integration Tests', () => {
    const geolocationRepository = new KnexGeolocationRepository(knexConfig);
    const userRepository = new KnexUsersRepository(geolocationRepository.connection);
    const INVALID_VALUE_UUID = 'id: Invalid value invalid-id for object uuid';

    it('should create a geolocation', async () => {
        const user = await UsersMother.createUser(userRepository);
        const geolocationDto = GeolocationsMother.dto(user.id.value);

        const geolocationCreator = new GeolocationCreator(geolocationRepository);
        await geolocationCreator.execute(geolocationDto);

        const geolocation = await geolocationRepository
            .connection('geolocation')
            .where({ id: geolocationDto.id })
            .first();

        expect(geolocation).not.toBeNull();
        expect(geolocation.id).toEqual(geolocationDto.id);
        expect(geolocation.user_id).toEqual(user.id.value);
    });

    it('should find a geolocation by id', async () => {
        const user = await UsersMother.createUser(userRepository);
        const geolocation = await GeolocationsMother.create(geolocationRepository, user.id.value);

        const geolocationFinder = new GeolocationFinder(geolocationRepository);
        const foundGeolocationResponse = await geolocationFinder.execute(geolocation.id.value);

        expect(foundGeolocationResponse).not.toBeNull();
        expect(foundGeolocationResponse).toBeInstanceOf(GeolocationResponse);

        const responseJson = foundGeolocationResponse.toJson();
        expect(responseJson.data.user_id).toEqual(user.id.value);
    });

    it('should find all geolocations', async () => {
        const user = await UsersMother.createUser(userRepository);
        await GeolocationsMother.create(geolocationRepository, user.id.value);
        await GeolocationsMother.create(geolocationRepository, user.id.value);

        const geolocationFinder = new FindAllGeolocation(geolocationRepository);
        const foundGeolocationsCollectionResponse = await geolocationFinder.execute();

        expect(foundGeolocationsCollectionResponse).not.toBeNull();
        expect(foundGeolocationsCollectionResponse).toBeInstanceOf(GeolocationCollectionResponse);

        const jsonResponse = foundGeolocationsCollectionResponse.toJson();
        expect(jsonResponse.data.items[0].user_id).toEqual(user.id.value);
    });

    it('should update a geolocation', async () => {
        const user = await UsersMother.createUser(userRepository);
        const geolocation = await GeolocationsMother.create(geolocationRepository, user.id.value);

        const valuesToUpdate = { action_type: 'Updated Action' };
        const geolocationUpdater = new GeolocationUpdater(geolocationRepository);
        await geolocationUpdater.execute(geolocation.id.value, valuesToUpdate);

        const updatedGeolocation = await geolocationRepository.find(geolocation.id);

        expect(updatedGeolocation).not.toBeNull();
        expect(updatedGeolocation.action_type.value).toEqual(valuesToUpdate.action_type);
        expect(updatedGeolocation.user_id.value).toEqual(user.id.value);
    });

    it('should throw an error when creating a geolocation with a duplicate id', async () => {
        const user = await UsersMother.createUser(userRepository);
        const geolocationDto = GeolocationsMother.dto(user.id.value);

        const geolocationCreator = new GeolocationCreator(geolocationRepository);
        await geolocationCreator.execute(geolocationDto);

        await expect(geolocationCreator.execute(geolocationDto)).rejects.toThrow(ValidationFailError);
    });

    it('Searches for geolocations instances with given criteria', async () => {
        const user = await UsersMother.createUser(userRepository);
        await GeolocationsMother.createMany(geolocationRepository, 5, user.id.value);

        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: {
                field: 'created_at',
                direction: 'asc',
            },
        };

        const geolocationCriteria = new GeolocationSearcher(geolocationRepository);
        const geolocationsCollectionResponse = await geolocationCriteria.execute(dtoCriteria);

        expect(geolocationsCollectionResponse).not.toBeNull();
        expect(geolocationsCollectionResponse).toBeInstanceOf(GeolocationCollectionResponse);
        expect(geolocationsCollectionResponse.toJson().data.items).toHaveLength(5);

        expect(new Date(geolocationsCollectionResponse.toJson().data.items[0].created_at).getTime()).toBeLessThan(
            new Date(geolocationsCollectionResponse.toJson().data.items[4].created_at).getTime()
        );
    });

    it('should delete a geolocation', async () => {
        const user = await UsersMother.createUser(userRepository);
        const geolocation = await GeolocationsMother.create(geolocationRepository, user.id.value);

        const geolocationDeleter = new GeolocationDeleter(geolocationRepository);

        await geolocationDeleter.execute(geolocation.id.value, {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        });

        const deletedGeolocation = await geolocationRepository.find(geolocation.id);

        expect(deletedGeolocation).toBeInstanceOf(Geolocation);
        expect(deletedGeolocation.deleted_at).not.toBeNull();
    });

    it('should not delete an already deleted geolocation', async () => {
        const user = await UsersMother.createUser(userRepository);
        const geolocation = await GeolocationsMother.create(geolocationRepository, user.id.value);

        const geolocationDeleter = new GeolocationDeleter(geolocationRepository);
        await geolocationDeleter.execute(geolocation.id.value, {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        });

        await expect(
            geolocationDeleter.execute(geolocation.id.value, {
                deleted_at: new Date().toISOString(),
                deleted_by: uuidv4(),
            })
        ).rejects.toThrow(ValidationFailError);
    });

    it('should not update a geolocation with an invalid ID', async () => {
        const user = await UsersMother.createUser(userRepository);
        const geolocation = await GeolocationsMother.create(geolocationRepository, user.id.value);

        const valuesToUpdate = { action_type: 'Updated Action' };
        const invalidId = INVALID_VALUE_UUID;

        const geolocationUpdater = new GeolocationUpdater(geolocationRepository);

        await expect(geolocationUpdater.execute(invalidId, valuesToUpdate)).rejects.toThrow(INVALID_VALUE_UUID);

        const notUpdatedGeolocation = await geolocationRepository.find(geolocation.id);
        expect(notUpdatedGeolocation).not.toBeNull();
        expect(notUpdatedGeolocation.action_type.value).not.toEqual(valuesToUpdate.action_type);
    });

    it('should not find a geolocation with an invalid ID', async () => {
        const invalidId = INVALID_VALUE_UUID;

        const geolocationFinder = new GeolocationFinder(geolocationRepository);

        await expect(geolocationFinder.execute(invalidId)).rejects.toThrow(INVALID_VALUE_UUID);
    });
});

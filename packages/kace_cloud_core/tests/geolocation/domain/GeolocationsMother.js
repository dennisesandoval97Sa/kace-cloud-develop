import { v4 as uuidv4 } from 'uuid';
import { Geolocation } from '../../../src/geolocation/domain/Geolocation.js';

export class GeolocationsMother {
    static dto(userId = uuidv4()) {
        return {
            id: uuidv4(),
            user_id: userId,
            action_type: 'Test Action',
            latitud: '40.7128',
            longitud: '-74.0060',
            ip4_address: '192.168.1.1',
            metadata: {
                key1: 'data1',
                key2: 'data1',
            },
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        };
    }

    static async create(repository, userId) {
        const geolocationDto = GeolocationsMother.dto(userId);
        const geolocation = Geolocation.create(geolocationDto);
        await repository.save(geolocation);
        return geolocation;
    }

    static async createMany(repository, quantity, userId) {
        const geolocations = [];
        for (let i = 0; i < quantity; i++) {
            geolocations.push(await GeolocationsMother.create(repository, userId));
        }
        return geolocations;
    }
}

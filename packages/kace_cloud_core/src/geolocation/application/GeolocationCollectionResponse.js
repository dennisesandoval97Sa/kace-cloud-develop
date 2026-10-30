import { GeolocationResponse } from './GeolocationResponse.js';

/**
 * Class representing a collection response for Geolocation objects.
 */
export class GeolocationCollectionResponse {
    /**
     * @type {Geolocation[]} is initialized in the constructor
     */
    #geolocations;

    /**
     * @type {number} is initialized in the constructor
     */
    #count;

    /**
     * @param {Geolocation[]} geolocations
     * @param {number} count
     */
    constructor(geolocations, count) {
        this.#geolocations = geolocations;
        this.#count = count;
    }

    /**
     * Converts the collection of Geolocation objects to a JSON representation.
     * @returns {Object} The JSON representation of the Geolocation collection.
     */
    toJson() {
        return {
            data: {
                items: this.#geolocations.map((geolocation) => new GeolocationResponse(geolocation).toJson().data),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}

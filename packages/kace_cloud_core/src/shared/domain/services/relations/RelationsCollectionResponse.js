/**
 * @fileoverview Response object for Relations application services.
 */
export class RelationsCollectionResponse {
    /** @type {Relations[]} */
    #relationsCollection;

    /**
     * @param {Relations[]} relationsCollection
     */
    constructor(relationsCollection) {
      this.#relationsCollection = relationsCollection;
    }

    /**
     * Converts the relations collection to a plain JSON response.
     *
     * @returns {Object} DTO with an array of relation items.
     */
    toJson() {
      return {
        data: {
          items: this.#relationsCollection.map(rel => ({
            entity: rel.entity.value,
            relation: rel.relation.value,
            join_condition: rel.join_condition.value,
            alias: rel.alias.value,
          })),
        },
      };
    }
  }

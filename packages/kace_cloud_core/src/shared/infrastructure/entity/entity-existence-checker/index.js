import { SchemaMetadataCache } from '../../persistence/SchemaMetadataCache.js';

export class EntityExistenceChecker {
    constructor(dbClient, entity) {
        this.entity = entity;
        this.dbClient = dbClient;
    }

    async tableExists() {
        return SchemaMetadataCache.tableExists(this.dbClient, this.entity);
    }

    async execute() {
        return this.tableExists();
    }
}

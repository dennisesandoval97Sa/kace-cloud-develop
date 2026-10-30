import { testPostgres, schema } from '../knexfile.js';
import Knex from 'knex';

const knex = Knex(testPostgres);

function dropSchema(knex, schemaName) {
    return knex.raw(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
}

dropSchema(knex, `test_${schema}`)
    .then(() => {
        // SONAR-EXC: NODEJS No expone logs porque es server-side
        console.log(`Schema test_${schema} dropped successfully.`);
        return knex.destroy();
    })
    .catch((error) => {
        // SONAR-EXC: NODEJS No expone logs porque es server-side
        console.error(`Error dropping schema test_${schema}:`, error);
    });

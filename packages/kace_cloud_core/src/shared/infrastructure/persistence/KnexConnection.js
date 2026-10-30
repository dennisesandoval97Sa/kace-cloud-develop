import Knex from 'knex';

let instance = null;

export const getKnexInstance = (knexConfig, force = false) => {
    if (!instance || force) {
        instance = Knex(knexConfig);
        instance.config = knexConfig;
    }
    return instance;
};

export const closeKnexConnection = async () => {
    if (instance) {
        await instance.destroy();
        instance = null;
    }
};

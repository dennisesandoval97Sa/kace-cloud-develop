import { Factory } from '../../src/factories/Factory.js';
import { knexConfig } from '../knexfile.js';

// StubModel/ExplodingRepository/StubFactory estan adaptados a lo que Factory
// realmente exige (constructor(repository, model, defaultAttributes, knexConfig),
// repository como CLASE que se instancia con `new repository(knex)`, y model como
// clase que `make()` instancia con `new this.model(attributes)`). El objetivo es que
// `create()` falle dentro de su propio `try` al llamar a `repository.save()`, no
// ejercitar la construccion del DTO real.
class StubModel {
    constructor(attributes) {
        this.id = attributes.id;
    }
}

class ExplodingRepository {
    constructor() {}

    async save() {
        throw new Error('null value in column "responsable_id" violates not-null constraint');
    }
}

class StubFactory extends Factory {
    constructor(knex) {
        super(ExplodingRepository, StubModel, { id: '00000000-0000-4000-8000-000000000000' }, knex);
    }
}

describe('Factory.create', () => {
    it('conserva el mensaje de la excepcion original', async () => {
        const factory = new StubFactory(knexConfig);

        await expect(factory.create()).rejects.toThrow(/responsable_id/);
    });

    it('conserva la excepcion original en la causa', async () => {
        const factory = new StubFactory(knexConfig);

        // El sintoma sin causa cuesta horas cuando el fallo es aleatorio: el `it` al que se
        // imputa cambia en cada corrida.
        const error = await factory.create().catch((caught) => caught);

        expect(error.cause).toBeInstanceOf(Error);
        expect(error.cause.message).toMatch(/responsable_id/);
    });
});

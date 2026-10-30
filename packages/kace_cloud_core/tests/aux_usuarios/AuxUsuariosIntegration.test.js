import { v4 as uuidV4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import { AuxUsersMother } from './domain/AuxUsuariosMother.js';
import { AuxUsers } from '../../src/aux_usuarios/domain/AuxUsers.js';
import { ValueObjectUuid } from '../../src/shared/index.js';
import { KnexAuxUsersRepository } from '../../src/aux_usuarios/infrastructure/persitance/KnexAuxUsersRepository.js';
import { QueryDBError } from '../../src/shared/index.js';
import { AuxUsersCreator } from '../../src/aux_usuarios/application/create/AuxUsersCreator.js';
import { AuxUsersFinder } from '../../src/aux_usuarios/application/find/AuxUsersFinder.js';
import { AuxUserUpdater } from '../../src/aux_usuarios/application/update/AuxUserUpdater.js';
import { CustomError } from '../../src/shared/index.js';

describe('Aux user integration test', () => {
    const auxUsersRepository = new KnexAuxUsersRepository(knexConfig);

    it('Repository metod save, saved a valid aux user', async () => {
        const dto = AuxUsersMother.dto();
        // El dto va directo al repositorio sin pasar por `createAuxUser`, asi
        // que aqui hay que respaldar `usuario_id` a mano: postgres rechaza el
        // insert si la fila padre no existe.
        await AuxUsersMother.ensureRelations(auxUsersRepository.connection, dto);
        const auxUserAggregate = AuxUsers.create(dto);
        const hasSaved = await auxUsersRepository.save(auxUserAggregate);
        expect(hasSaved).toBe(true);
    });

    it('Repository metod save, failed with a invalid aux user', async () => {
        const dto = {
            invalidKey: 'invalidValue',
        };
        await expect(auxUsersRepository.save(dto)).rejects.toThrow(QueryDBError);
    });

    it('Repository metod update, updated an a valid aux user', async () => {
        const dto = AuxUsersMother.dto();
        await AuxUsersMother.ensureRelations(auxUsersRepository.connection, dto);
        const auxUserAggregate = AuxUsers.create(dto);
        await auxUsersRepository.save(auxUserAggregate);

        const payload = {
            codigo: '123456',
            ciudad: auxUserAggregate.data.value.ciudad,
            barrio: 'Alcaran 223',
            direccion: 'clle alcaran 33-34',
        };

        auxUserAggregate.update({ data: payload });

        // El segundo parametro de `KnexRepository.update` es la transaccion, no
        // el id: pasarle el id revienta con "trx is not a function".
        await auxUsersRepository.update(auxUserAggregate);

        const auxUserUpdated = await auxUsersRepository
            .connection('aux_usuarios')
            .where('id', auxUserAggregate.id.value)
            .first();

        expect(auxUserUpdated.data.codigo).toEqual(payload.codigo);
        expect(auxUserUpdated.data.ciudad).toEqual(payload.ciudad);
        expect(auxUserUpdated.data.barrio).toEqual(payload.barrio);
        expect(auxUserUpdated.data.direccion).toEqual(payload.direccion);
    });

    it('Repository metod update, updated failed an a invalid aux user', async () => {
        const dto = AuxUsersMother.dto();
        await AuxUsersMother.ensureRelations(auxUsersRepository.connection, dto);
        const auxUserAggregate = AuxUsers.create(dto);
        await auxUsersRepository.save(auxUserAggregate);

        // `AggregateRoot.update` ignora las claves que no son atributos del
        // agregado, asi que un `{ invalidData: ... }` no deja nada que
        // escribir y el repositorio ni siquiera llega a la base. Lo que si
        // hace fallar el UPDATE es apuntar `usuario_id` a un usuario que no
        // existe: postgres rechaza la clave ajena.
        auxUserAggregate.update({ usuario_id: uuidV4() });

        await expect(auxUsersRepository.update(auxUserAggregate)).rejects.toThrow(QueryDBError);
    });

    it('Repository metod update, should return undefined when trying to update a non-existent auxUser', async () => {
        const dto = AuxUsersMother.dto();
        const auxUserAggregate = AuxUsers.create(dto);

        auxUserAggregate.update({
            data: {
                codigo: '123456',
                ciudad: auxUserAggregate.data.value.ciudad,
                barrio: 'Alcaran 223',
                direccion: 'clle alcaran 33-34',
            },
        });

        const result = await auxUsersRepository.update(auxUserAggregate);

        expect(result).toBeUndefined();
    });

    it('Repository metod find, return aux user aggregate with a valid aux user id', async () => {
        const dto = AuxUsersMother.dto();
        await AuxUsersMother.ensureRelations(auxUsersRepository.connection, dto);
        const auxUserAggregate = AuxUsers.create(dto);
        await auxUsersRepository.save(auxUserAggregate);

        const id = new ValueObjectUuid('id', auxUserAggregate.id.value);
        const auxUser = await auxUsersRepository.find(id);

        expect(auxUser.id.value).toBe(auxUserAggregate.id.value);
    });

    it('Repository metod find, return null with a non-exist aux user', async () => {
        const id = new ValueObjectUuid('id', uuidV4());
        const auxUser = await auxUsersRepository.find(id);

        expect(auxUser).toBe(null);
    });

    it('Repository metod findByUser, return aux user aggregate with a valid user id', async () => {
        const dto = AuxUsersMother.dto();
        await AuxUsersMother.ensureRelations(auxUsersRepository.connection, dto);
        const auxUserAggregate = AuxUsers.create(dto);
        await auxUsersRepository.save(auxUserAggregate);

        const userId = new ValueObjectUuid('userId', auxUserAggregate.usuario_id.value);
        const auxUser = await auxUsersRepository.findByUser(userId);

        expect(auxUser.usuario_id.value).toBe(auxUserAggregate.usuario_id.value);
    });

    it('Repository metod findByUser, return null with a non-exist user', async () => {
        const userId = new ValueObjectUuid('userId', uuidV4());
        const auxUser = await auxUsersRepository.findByUser(userId);

        expect(auxUser).toBe(null);
    });

    it('Aplication service AuxUserCreator, create a valid aux user', async () => {
        const dto = AuxUsersMother.dto();
        await AuxUsersMother.ensureRelations(auxUsersRepository.connection, dto);
        const hasSaved = await new AuxUsersCreator(auxUsersRepository).execute(dto);
        expect(hasSaved).toBe(true);
    });

    it('Aplication service AuxUsersFinder, return a valid aux user response', async () => {
        const dto = AuxUsersMother.dto();
        await AuxUsersMother.ensureRelations(auxUsersRepository.connection, dto);
        await new AuxUsersCreator(auxUsersRepository).execute(dto);

        const auxUser = await new AuxUsersFinder(auxUsersRepository).execute(dto.usuario_id);

        expect(auxUser.toJson().data.usuario_id).toBe(dto.usuario_id);
    });

    it('Aplication service AuxUserUpdater, updated a valid aux user', async () => {
        const dto = AuxUsersMother.dto();
        await AuxUsersMother.ensureRelations(auxUsersRepository.connection, dto);
        await new AuxUsersCreator(auxUsersRepository).execute(dto);

        const payload = {
            codigo: '123456',
            ciudad: 'updated City',
            barrio: 'Alcaran 223',
            direccion: 'clle alcaran 33-34',
        };

        const hasUpdated = await new AuxUserUpdater(auxUsersRepository).execute({ data: payload }, dto.id);
        expect(hasUpdated).toBe(true);
    });

    it('Aplication service AuxUserUpdater, failed updated to a invalid aux user', async () => {
        const payload = {
            codigo: '123456',
            ciudad: 'updated City',
            barrio: 'Alcaran 223',
            direccion: 'clle alcaran 33-34',
        };

        await expect(new AuxUserUpdater(auxUsersRepository).execute({ data: payload }, uuidV4())).rejects.toThrow(
            CustomError
        );
    });
});

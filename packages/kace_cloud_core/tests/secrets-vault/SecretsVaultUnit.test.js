import { v4 as uuidV4 } from 'uuid';
import { SecretsVaultMother } from './domain/SecretsVaultMother';
import { SecretsCollectionResponse, SecretsResponse, SecretsVault } from '../../src/secrets-vault';
import { DeleteFieldsDoNotExistError } from '../../src/shared/index.js';
import { withTestTenant } from '../support/testTenant.js';

describe('Secret test', () => {
    it('should return a Secret instance', () =>
        withTestTenant(() => {
            const dto = SecretsVaultMother.dto();
            const secret = SecretsVault.create(dto);

            expect(secret).toBeInstanceOf(SecretsVault);
            expect(secret.id.value).toEqual(dto.id);
            expect(secret.referencia.value).toEqual(dto.referencia);
            expect(secret.secreto.value).toEqual(dto.secreto);
            expect(secret.descripcion.value).toEqual(dto.descripcion);
            expect(secret.created_at.value).toEqual(dto.created_at);
            expect(secret.created_by.value).toEqual(dto.created_by);
        }));

    it('should update a secret', () =>
        withTestTenant(() => {
            const dto = SecretsVaultMother.dto();
            const secret = new SecretsVault(dto);

            const updateDto = {
                referencia: 'REFERENCIA_UPATED',
                descripcion: 'Descripción actualizado',
                secreto: 'Secreto Updated',
                updated_at: new Date().toISOString(),
                updated_by: uuidV4(),
            };

            secret.update(updateDto);

            expect(secret).toBeInstanceOf(SecretsVault);
            expect(secret.descripcion.value).toEqual(updateDto.descripcion);
            expect(secret.secreto.value).toEqual(updateDto.secreto);
            expect(secret.updated_at.value).toEqual(updateDto.updated_at);
            expect(secret.updated_by.value).toEqual(updateDto.updated_by);
        }));

    it('does not update properties when values are the same', () =>
        withTestTenant(() => {
            const dto = SecretsVaultMother.dto();
            const secret = SecretsVault.create(dto);

            secret.update(dto);

            expect(secret.changedAttributes).toEqual({});
        }));

    it('marks a Secret instance as deleted', () =>
        withTestTenant(() => {
            const dto = SecretsVaultMother.dto();
            const secret = SecretsVault.create(dto);
            const deleteDto = {
                deleted_at: new Date().toISOString(),
                deleted_by: uuidV4(),
            };
            secret.delete(deleteDto);

            expect(secret.deleted_at.value).toEqual(deleteDto.deleted_at);
            expect(secret.deleted_by.value).toEqual(deleteDto.deleted_by);
        }));

    it('should throw a error if deleted fields are empty', () =>
        withTestTenant(() => {
            const dto = SecretsVaultMother.dto();
            const secret = SecretsVault.create(dto);
            const deleteDto = {};

            expect(() => secret.delete(deleteDto)).toThrow(DeleteFieldsDoNotExistError);
        }));

    it('flushes changes in Secret instance', () =>
        withTestTenant(() => {
            const dto = SecretsVaultMother.dto();
            const secret = SecretsVault.create(dto);
            const updateDto = {
                descripcion: 'Descripción actualizado',
                secreto: 'Secreto Updated',
                updated_at: new Date().toISOString(),
                updated_by: uuidV4(),
            };
            secret.update(updateDto);
            secret.flushChanges();

            expect(secret.changedAttributes).toEqual({});
        }));
});

describe('Secret Responses Tests', () => {
    it('converts Secret object to JSON representation', () =>
        withTestTenant(() => {
            const secret = new SecretsVault(SecretsVaultMother.dto());
            const secretResponse = new SecretsResponse(secret).toJson();

            expect(secretResponse).toMatchObject({
                data: {
                    id: secret.id.value,
                    descripcion: secret.descripcion.value,
                    secreto: '***',
                    referencia: secret.referencia.value,
                    created_at: secret.created_at.value,
                    updated_at: secret.updated_at.value,
                    created_by: secret.created_by.value,
                    updated_by: secret.updated_by.value,
                },
            });
        }));

    it('converts Secret collection object to JSON representation', () =>
        withTestTenant(() => {
            const secret = [
                new SecretsVault(SecretsVaultMother.randomDto()),
                new SecretsVault(SecretsVaultMother.randomDto()),
            ];
            const secretCollectionResponse = new SecretsCollectionResponse(secret);

            const json = secretCollectionResponse.toJson();

            expect(json.data.items).toEqual(secret.map((secret) => new SecretsResponse(secret).toJson().data));
        }));

    it('return an empty object if SecretVault is null', () => {
        const secretResponse = new SecretsResponse(null);

        const json = secretResponse.toJson();

        expect(json).toMatchObject({});
    });
});

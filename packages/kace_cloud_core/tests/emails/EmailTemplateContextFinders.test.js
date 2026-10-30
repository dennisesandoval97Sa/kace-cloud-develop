import { buildEmailTemplateContext } from '../../src/shared/domain/services/emailTemplating/emailTemplatesUtils.js';
import { ClientFinder } from '../../src/clients/application/find/ClientFinder.js';
import { Client } from '../../src/clients';
import ClientMother from '../clients/domain/ClientMother.js';

describe('buildEmailTemplateContext — contrato de forma del finder (.data)', () => {
    it('puebla context.clients con los campos del cliente', async () => {
        const dto = ClientMother.dto();
        const client = Client.create(dto);
        const clientRepository = { find: async () => client };
        const clientFinder = new ClientFinder(clientRepository);
        // El bloque de usuario siempre corre para entidades que no son Case; stub benigno.
        const userFinder = { execute: async () => ({ toJson: () => ({}) }) };

        const entity = { cliente_id: { value: dto.id }, toJson: () => ({}) };

        const context = await buildEmailTemplateContext({ entity, clientFinder, userFinder });

        expect(context.clients.nombres).toBe(dto.nombres);
        expect(context.clients.email).toBe(dto.email);
    });
});

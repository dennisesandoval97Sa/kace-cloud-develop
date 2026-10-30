import { production as knexConfig } from '@kace/database/knexfile';
import { Controller } from '../src/Controller.mjs';

describe('Clients', () => {
    it('should return statuscode 200 if there is nothing to update', async () => {
        const event = {
            resource: '/',
            httpMethod: 'POST',
            headers: { Authorization: process.env.AWS_COGNITO_IDTOKEN },
            body: JSON.stringify({
                documento: '1234594',
                nombres: 'INGENIERIA BENDECK SAMUR SAS',
                email: 'jonny.parra@konecta-group.com',
                telefono: '3005552525',
                status: 1,
                contactos: [],
                tipo_cliente: 'Comercial',
                tipo_documento: 'NIT',
                email_alterno: '',
                habeas_data: 'N/A',
                nombre_empresa: 'INGENIERIA BENDECK SAMUR SAS',
            }),
        };
        const controller = new Controller(event, knexConfig);
        const response = await controller.run();

        expect(response.statusCode).toBe(200);
    });
});

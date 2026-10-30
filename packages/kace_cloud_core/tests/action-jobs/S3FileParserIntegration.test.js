import { jest } from '@jest/globals';
import { Readable } from 'stream';
import { S3Client } from '@aws-sdk/client-s3';
import { S3FileParser } from '../../src/action-jobs';
import LocalTenantRepository from '../../src/tenant/infrastructure/local/LocalTenantRepository.js';
import { TenantContext } from '../../src/shared/infrastructure/context/TenantContext.js';

const tenant = await new LocalTenantRepository().find();

const CSV_CONTENT = [
    '26;"Cambiar estado|{\"estado_nuevo\":\"Finalizado\",\"PATH_PARAM_IDCASO\":\"26\"}";"Aplicar fecha de cierre";"Send SMS Cierre Caso BO|{\"messages\":[{\"from\":\"InfoSMS\",\"text\":\"SMS Bolivia\",\"destinations\":[{\"to\":\"59170814720\"}]}]}";"Crear comentario|{\"Comentarios\":{\"caso_id\":26,\"descripcion\":\"SMS Bolivia\"}}"',
    '27;"Cambiar estado|{\"estado_nuevo\":\"Finalizado\",\"PATH_PARAM_IDCASO\":\"26\"}";"Aplicar fecha de cierre";"Send SMS Cierre Caso BO|{\"messages\":[{\"from\":\"InfoSMS\",\"text\":\"SMS Bolivia\",\"destinations\":[{\"to\":\"59170814720\"}]}]}";"Crear comentario|{\"Comentarios\":{\"caso_id\":26,\"descripcion\":\"SMS Bolivia\"}}"',
].join('\n');

function makeS3Stream(content) {
    return Readable.from([content]);
}

describe('S3FileParser', () => {
    /** @type {S3FileParser} */
    let s3FileParser;

    beforeEach(() => {
        jest.restoreAllMocks();
        s3FileParser = new S3FileParser();
    });

    it('should correctly read a file from S3', async () => {
        jest.spyOn(S3Client.prototype, 'send').mockResolvedValueOnce({
            Body: makeS3Stream(CSV_CONTENT),
        });

        await TenantContext.run(tenant, async () => {
            const fileContent = await s3FileParser.readFile('prueba.csv');

            let data = '';
            fileContent.on('data', (chunk) => (data += chunk));
            await new Promise((resolve) => fileContent.on('end', resolve));

            expect(data).toBeDefined();
            expect(data).toContain('Cambiar estado');
            expect(data).toContain('Send SMS Cierre Caso BO');
            expect(data).toContain('Crear comentario');
        });
    });

    it('should correctly parse a CSV file', async () => {
        jest.spyOn(S3Client.prototype, 'send').mockResolvedValueOnce({
            Body: makeS3Stream(CSV_CONTENT),
        });

        await TenantContext.run(tenant, async () => {
            const fileContent = await s3FileParser.readFile('prueba.csv');

            const records = await s3FileParser.parseCSV(fileContent, { separator: ';', headers: false });

            const plantillaJson = [
                {
                    0: '26',
                    1: 'Cambiar estado|{"estado_nuevo":"Finalizado","PATH_PARAM_IDCASO":"26"}',
                    2: 'Aplicar fecha de cierre',
                    3: 'Send SMS Cierre Caso BO|{"messages":[{"from":"InfoSMS","text":"SMS Bolivia","destinations":[{"to":"59170814720"}]}]}',
                    4: 'Crear comentario|{"Comentarios":{"caso_id":26,"descripcion":"SMS Bolivia"}}',
                },
                {
                    0: '27',
                    1: 'Cambiar estado|{"estado_nuevo":"Finalizado","PATH_PARAM_IDCASO":"26"}',
                    2: 'Aplicar fecha de cierre',
                    3: 'Send SMS Cierre Caso BO|{"messages":[{"from":"InfoSMS","text":"SMS Bolivia","destinations":[{"to":"59170814720"}]}]}',
                    4: 'Crear comentario|{"Comentarios":{"caso_id":26,"descripcion":"SMS Bolivia"}}',
                },
            ];

            expect(records.length).toBeGreaterThan(0);
            expect(records).toEqual(plantillaJson);
        });
    });

    it('should throw an error if the file does not exist in S3', async () => {
        jest.spyOn(S3Client.prototype, 'send').mockRejectedValueOnce(
            Object.assign(new Error('The specified key does not exist.'), { Code: 'NoSuchKey' })
        );

        await TenantContext.run(tenant, async () => {
            await expect(s3FileParser.readFile('path-to-nonexistent-file.csv')).rejects.toThrowError(
                'The specified key does not exist.'
            );
        });
    });

    it('should correctly parse a simple CSV with semicolon separator', async () => {
        const simpleCsvData = 'id;=SI()';
        const simpleCsvStream = Readable.from([simpleCsvData]);

        const result = await s3FileParser.parseCSV(simpleCsvStream, { separator: ';', headers: false });

        expect(result).toEqual([{ 0: 'id', 1: '=SI()' }]);
    });
});

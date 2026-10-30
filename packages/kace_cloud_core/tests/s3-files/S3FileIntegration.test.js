import {
    KnexS3FileRepository,
    S3File,
    S3FileCollectionResponse,
    S3FileCounter,
    S3FileCreator,
    S3FileDeleter,
    S3FileFinder,
    S3FileResponse,
    S3FileSearcher,
    S3FileUpdater,
} from '../../src/s3-files';
import S3FileMother from './domain/S3FileMother.js';
import { knexConfig } from '../knexfile.js';
import { v4 as uuidv4 } from 'uuid';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { GetPresignedUrl } from '../../src/s3-files/application/get-presigned-url/GetPresignedUrl.js';
import axios from 'axios';
import { createReadStream, statSync } from 'node:fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { CustomError } from '../../src/shared/index.js';
import { S3FileScanner } from '../../src/s3-files/application/scan/S3FileScanner.js';
import { S3ScanService } from '../../src/s3-files/infrastructure/external/S3ScanService';
import { jest } from '@jest/globals';
import LocalTenantRepository from '../../src/tenant/infrastructure/local/LocalTenantRepository.js';

const tenant = await new LocalTenantRepository().find();

describe('S3File Integration Tests', () => {
    const repository = new KnexS3FileRepository(knexConfig);

    afterEach(async () => {
        jest.restoreAllMocks();
    });

    it('should create an S3File', async () => {
        const dto = S3FileMother.dto();
        const s3FileCreator = new S3FileCreator(repository);

        await s3FileCreator.execute(dto);

        const result = await repository.connection(repository.tableName).select('*').where('id', dto.id);

        expect(result.length).toBe(1);
    });

    it('can get an existing S3File', async () => {
        const s3File = await S3FileMother.createS3File(repository);
        const s3FileFinder = new S3FileFinder(repository);

        const s3FileResult = await s3FileFinder.execute(s3File.id.value);

        expect(s3FileResult).not.toBeNull();
        expect(s3FileResult).toBeInstanceOf(S3FileResponse);
    });

    it('can update an existing S3File', async () => {
        const s3File = await S3FileMother.createS3File(repository);
        const s3FileUpdater = new S3FileUpdater(repository);

        const newValues = { description: 'Updated Name' };
        await s3FileUpdater.execute(s3File.id.value, newValues);

        const result = await repository.find(s3File.id);
        expect(result).toBeInstanceOf(S3File);
        expect(result.description.value).toBe(newValues.description);
    });

    it('can delete an existing S3File', async () => {
        const s3File = await S3FileMother.createS3File(repository);
        const s3FileDeleter = new S3FileDeleter(repository);

        await s3FileDeleter.execute(s3File.id.value, { deleted_at: new Date().toISOString(), deleted_by: uuidv4() });

        const result = await repository.find(s3File.id);
        expect(result).toBeInstanceOf(S3File);
        expect(result.deleted_at.value).not.toBeNull();
        expect(result.deleted_by.value).not.toBeNull();
    });

    it('searches for S3File instances with given criteria with filter', async () => {
        for (let i = 0; i < 10; i++) {
            await S3FileMother.createS3File(repository);
        }
        const dtoCriteria = {
            filter: [
                {
                    field: 'is_active',
                    operator: 'eq',
                    value: 'true',
                    type: 'and',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const s3FileSearcher = new S3FileSearcher(repository);

        const s3FileResult = await s3FileSearcher.execute(dtoCriteria);
        expect(s3FileResult).toBeInstanceOf(S3FileCollectionResponse);
    });

    it('searches for S3Files with criteria that match no records', async () => {
        const dtoCriteria = {
            filter: [
                // `is_active` es `boolean` en postgres: compararla con '999'
                // aborta la consulta en vez de no devolver filas. El criterio
                // que de verdad no casa con nada es un id recien generado.
                {
                    field: 'id',
                    operator: 'eq',
                    value: uuidv4(),
                    type: 'and',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const s3FileSearcher = new S3FileSearcher(repository);

        const s3FileResult = await s3FileSearcher.execute(dtoCriteria);
        expect(s3FileResult).toBeInstanceOf(S3FileCollectionResponse);
        expect(s3FileResult.toJson().data.items.length).toBe(0);
    });

    it('should return empty when trying to find an S3File with a non-existent ID', async () => {
        const s3FileFinder = new S3FileFinder(repository);

        await expect(s3FileFinder.execute(uuidv4())).rejects.toThrow(CustomError);
    });

    it('should throw an error when creating an S3File with invalid data', async () => {
        const invalidDto = S3FileMother.dto();
        delete invalidDto.id;
        const s3FileCreator = new S3FileCreator(repository);

        await expect(s3FileCreator.execute(invalidDto)).rejects.toThrow();
    });

    it('should throw an error when trying to update a non-existent S3File', async () => {
        const s3FileUpdater = new S3FileUpdater(repository);
        const nonExistentId = uuidv4();
        const newValues = { name: 'Updated Name' };

        await expect(s3FileUpdater.execute(nonExistentId, newValues)).rejects.toThrow(
            `S3 file with ID ${nonExistentId} does not exist.`
        );
    });

    it('should throw an error when deleting a non-existent S3File', async () => {
        const s3FileDeleter = new S3FileDeleter(repository);
        const nonExistentId = uuidv4();

        await expect(
            s3FileDeleter.execute(nonExistentId, { deleted_at: new Date().toISOString(), deleted_by: uuidv4() })
        ).rejects.toThrow(`S3 file with ID ${nonExistentId} does not exist.`);
    });

    it('should count S3Files correctly', async () => {
        for (let i = 0; i < 10; i++) {
            await S3FileMother.createS3File(repository);
        }
        const counter = new S3FileCounter(repository);

        const count = await counter.execute({ filters: [], relationship: null });
        expect(Number(count.count)).toBe(10);
    });

    // KACE-SKIP(decision-pendiente): firma una URL contra el bucket real de
    // AWS_S3_BUCKET/AWS_S3_ACCESS_KEY_ID y ademas sube prueba.jpg con axios.put. Con
    // claves en el .env deja el fichero en el bucket de verdad; sin ellas revienta o se
    // cuelga. Los mocks de tests/support/mocks/awsS3.js existen desde 0cc7a0ad4 sin usar.
    it.skip('should get a valid url to upload a file', async () => {
        const payload = {
            id: uuidv4(),
            fileName: 'prueba.jpg',
            contentType: 'image/jpg',
            url: 'template',
        };

        const s3Client = new S3Client({
            region: process.env.AWS_S3_REGION,
            credentials: {
                accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
            },
        });

        const s3Params = {
            Key: `${payload.url}/${payload.id}/${payload.fileName}`,
            Bucket: process.env.AWS_S3_BUCKET,
            ContentType: payload.contentType,
        };
        const command = new PutObjectCommand(s3Params);

        const signedUrl = await new GetPresignedUrl(s3Client, command).execute(payload.fileName, payload.contentType);

        expect(signedUrl).toHaveProperty('uploadUrl');

        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        const filePath = join(__dirname, 'prueba.jpg');
        const fileStats = statSync(filePath);
        const fileSize = fileStats.size;

        let response;
        try {
            response = await axios.put(signedUrl.uploadUrl, createReadStream(filePath), {
                headers: {
                    'Content-Type': payload.contentType,
                    'Content-Length': fileSize,
                },
            });
        } catch (e) {
            console.log(e);
        }
        expect(response.status).toBe(200);
    });

    it('should construct the objectKey correctly', async () => {
        const dto = {
            url: 'https://prueba.com',
            id: '123',
            fileName: 'file.txt',
        };

        const scanService = new S3ScanService(tenant);

        jest.spyOn(scanService, 'scanFile').mockResolvedValue({ result: 'Clean' });

        const fileScanner = new S3FileScanner(scanService);

        await fileScanner.execute(dto);

        expect(dto.objectKey).toBe('https://prueba.com/123/file.txt');
    });

    // KACE-SKIP(decision-pendiente): scanFile no esta mockeado y el tenant se resolvio al
    // importar el archivo, asi que cambiar APPS_ENVIRONMENT aqui no le llega: con
    // APPS_ENVIRONMENT=staging o production en el .env llama de verdad al antivirus de
    // AWS_CSS_URL; solo en development no sale a la red. Nada de esto esta mockeado.
    it.skip('should skip validation only if AWS_CSS_ENABLE is disabled and environment is develpoment', async () => {
        const holdValues = {
            AWS_CSS_ENABLE: process.env.AWS_CSS_ENABLE,
            APPS_ENVIRONMENT: process.env.APPS_ENVIRONMENT,
        };
        process.env.AWS_CSS_ENABLE = '0';
        process.env.APPS_ENVIRONMENT = 'development';

        const dto = S3FileMother.dto();
        dto.objectKey = `${dto.url}/${dto.id}/${dto.fileName}`;

        const scanService = new S3ScanService(tenant);
        const scanResult = await scanService.scanFile(dto);

        expect(scanResult.message).toBe('Security validation disabled');

        process.env.AWS_CSS_ENABLE = holdValues.AWS_CSS_ENABLE;
        process.env.APPS_ENVIRONMENT = holdValues.APPS_ENVIRONMENT;
    });

    it('should throw an error when scanning fails', async () => {
        process.env.AWS_CSS_ENABLE = '1';

        const dto = S3FileMother.dto();

        dto.objectKey = `${dto.url}/${dto.id}/${dto.fileName}`;

        const scanService = new S3ScanService(tenant);

        jest.spyOn(scanService, 'scanFile').mockRejectedValue(new Error('File scanning failed.'));

        await expect(scanService.scanFile(dto)).rejects.toThrow('File scanning failed.');
    });

    it('should not delete a clean file after scanning', async () => {
        const dto = S3FileMother.dto();

        const scanService = new S3ScanService(tenant);

        jest.spyOn(scanService, 'scanFile').mockResolvedValue({
            result: 'Clean',
        });

        const deleteFileMock = jest.spyOn(scanService, 'deleteFile');

        const fileScanner = new S3FileScanner(scanService);
        const result = await fileScanner.execute(dto);

        expect(result.message).toBe('File validated successfully');
        expect(deleteFileMock).not.toHaveBeenCalled();
    });

    it('should validate security when AWS_CSS_ENABLE is enabled', async () => {
        process.env.APPS_ENVIRONMENT = 'staging';

        const dto = S3FileMother.dto();

        const scanService = new S3ScanService(tenant);
        jest.spyOn(scanService, 'scanFile').mockResolvedValue({
            message: 'File validated successfully',
            errors: null,
        });

        const scanResult = await scanService.scanFile(dto);

        expect(scanResult.message).toBe('File validated successfully');
        expect(scanResult.errors).toBeNull();
    });

    it('should delete an infected file after scanning', async () => {
        process.env.APPS_ENVIRONMENT = 'staging';

        const dto = S3FileMother.dto();
        dto.objectKey = `${dto.url}/${dto.id}/${dto.fileName}`;

        const scanService = new S3ScanService(tenant);

        jest.spyOn(scanService, 'scanFile').mockResolvedValue({
            result: 'Infected',
            message: 'Threat detected',
            errors: {
                fileName: dto.fileName,
                message: `The attachment ${dto.fileName} is insecure and has been deleted`,
            },
        });

        const deleteFileMock = jest.spyOn(scanService, 'deleteFile').mockResolvedValue();

        const fileScanner = new S3FileScanner(scanService);
        const result = await fileScanner.execute(dto);

        expect(result.message).toBe('Threat detected');
        expect(result.errors).toEqual({
            fileName: dto.fileName,
            message: `The attachment ${dto.fileName} is insecure and has been deleted`,
        });
        expect(deleteFileMock).toHaveBeenCalled();
    });
});

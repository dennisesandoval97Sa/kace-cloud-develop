import { UserUpdater } from '../../../users/application/update/UserUpdater.js';
import { UserDeleter } from '../../../users/application/delete/UserDeleter.js';
import { UserFinder as DomainUserFinder } from '../../../users/domain/UserFinder.js';
import { toExternalCodesObject } from '../../../shared/domain/utilities/processExternalCodes.js';
import { AuxiliaryCreator } from '../../../auxiliaries/application/create/AuxiliaryCreator.js';
import { AuxiliaryUpdater } from '../../../auxiliaries/application/update/AuxiliaryUpdater.js';
import { AuxiliaryDeleter } from '../../../auxiliaries/application/delete/AuxiliaryDeleter.js';
import { ValueObjectUuid } from '../../../shared/domain/value-object/ValueObjectUuid.js';

export class CsvRecordProcessorService {
    /**
     * Procesa registros CSV e inserta en base de datos mediante el repositorio
     * @param {Object[]} records - Registros del CSV
     * @param {Object} fileRecord - Objeto agregado S3ImportFile
     * @param {Object} repository - Repositorio (con saveRecord y updateImport)
     * @param {Function} normalizeFn - Función para normalizar valores (opcional)
     * @returns {Promise<Object>} Resultado del procesamiento
     */
    static async execute(
        records,
        fileRecord,
        repository,
        normalizeFn,
        usersRepository,
        auxiliariesRepository,
        dataStructure = null,
        shouldOverrideArray = false
    ) {
        let totalRecordsInserted = 0;
        let errorDetails = '';
        let controlErrors = 0;

        const processedOffset = Number(fileRecord.processed_records?.value ?? fileRecord.processed_records) || 0;
        const recordsToProcess = records.slice(processedOffset, records.length);

        const uploadAttempts = fileRecord.upload_attempts.value;
        const updateData = {
            upload_attempts: uploadAttempts + 1,
            total_records: records.length,
            last_updated_at: new Date().toISOString(),
        };
        const userUpdater = new UserUpdater(usersRepository, null);
        const userDeleter = new UserDeleter(usersRepository, null);
        const userFinder = new DomainUserFinder(usersRepository);
        const auxiliaryCreator = new AuxiliaryCreator(auxiliariesRepository);
        const auxiliaryUpdater = new AuxiliaryUpdater(auxiliariesRepository);
        const auxiliaryDeleter = new AuxiliaryDeleter(auxiliariesRepository);

        await repository.updateImport(fileRecord.id.value, updateData);

        for (const [recordIndex, record] of recordsToProcess.entries()) {
            const rowNumber = processedOffset + recordIndex + 2;
            const skipNormalization = fileRecord.target_table.value.startsWith('aux_');
            if (!skipNormalization) {
                for (let key in record) {
                    record[key] = normalizeFn(record[key]);
                }
            }

            const isDeleteAction = fileRecord.action_type?.value === 'DELETE';

            const toOptionalString = (v) => {
                if (v === undefined) return undefined;
                if (typeof v === 'number' && Number.isNaN(v)) return undefined;
                const s = String(v).trim();
                return s === '' ? null : s;
            };

            try {
                if (fileRecord.target_table.value === 'usuarios') {
                    const { id } = record;
                    if (isDeleteAction) {
                        // Re-running a delete import is idempotent: an already-deleted user is not a row error,
                        // and UserDeleter refuses it so as not to overwrite who deleted it and when.
                        const user = await userFinder.execute(id);
                        if (!user?.isDeleted()) {
                            const deleteDto = { deleted_by: fileRecord.created_by.value, deleted_at: new Date() };
                            await userDeleter.execute(id, deleteDto);
                        }
                    } else {
                        if ('external_id' in record) {
                            record.external_id = toOptionalString(record.external_id);
                        }
                        if ('telefono' in record) {
                            record.telefono = toOptionalString(record.telefono);
                        }
                        if ('movil' in record) {
                            record.movil = toOptionalString(record.movil);
                        }
                        if ('codigos_externos' in record) {
                            record.codigos_externos = toExternalCodesObject(record.codigos_externos);
                        }
                        record.updated_at = new Date();
                        record.updated_by = fileRecord.created_by.value;
                        await userUpdater.execute(id, record);

                        const rawGroups = record.grupos;
                        if (rawGroups === null) {
                            await repository.replaceUserGroupRelations(id, []);
                        } else if (typeof rawGroups !== 'undefined') {
                            const parsedIds = String(rawGroups)
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean);
                            await repository.replaceUserGroupRelations(id, parsedIds);
                        }
                    }
                } else if (fileRecord.target_table.value.startsWith('aux_')) {
                    const tableName = fileRecord.target_table.value;
                    const { id, ...dataForJson } = record;
                    const now = new Date();

                    if (isDeleteAction) {
                        const deleteDto = { deleted_by: fileRecord.created_by.value, deleted_at: now };
                        await auxiliaryDeleter.execute(id, deleteDto, tableName);
                    } else {
                        const auxIdVO = new ValueObjectUuid('auxiliary_id', id);

                        const existingAux = await auxiliariesRepository.find(auxIdVO, tableName);

                        if (existingAux) {
                            const updateDto = {
                                data: dataForJson,
                                updated_at: now,
                                updated_by: fileRecord.created_by.value,
                            };

                            await auxiliaryUpdater.execute(
                                id,
                                updateDto,
                                tableName,
                                shouldOverrideArray,
                                dataStructure
                            );
                        } else {
                            const createDto = {
                                id,
                                data: dataForJson,
                                created_at: now,
                                created_by: fileRecord.created_by.value,
                                updated_at: now,
                                updated_by: fileRecord.created_by.value,
                                deleted_at: null,
                                deleted_by: null,
                            };

                            await auxiliaryCreator.execute(createDto, tableName, dataStructure);
                        }
                    }
                } else {
                    if (isDeleteAction) {
                        const deleteDto = { deleted_by: fileRecord.created_by.value, deleted_at: new Date() };
                        await repository.updateRecord(fileRecord.target_table.value, record.id, deleteDto);
                    } else {
                        await repository.saveRecord(fileRecord.target_table.value, record);
                    }
                }

                totalRecordsInserted++;
                await repository.updateImport(fileRecord.id.value, {
                    processed_records: totalRecordsInserted,
                });
            } catch (error) {
                // SI: Se reportan los errores en el dashboard de imports y se guardan en DB, no es necesario log
                const errors = String(error).split('-');
                const actionLabel = isDeleteAction ? 'eliminando' : 'insertando';
                const recordId = record.id ? ` (id: ${record.id})` : '';
                errorDetails += `,Error ${actionLabel} la fila ${rowNumber}${recordId}: ${errors[errors.length - 1]}`;
                controlErrors++;
            }

            if (controlErrors >= 20) break;
        }

        if (controlErrors >= 20) {
            const updateData = {
                status: 'rejected',
                last_updated_at: new Date().toISOString(),
                error_details: `Too many insert errors${errorDetails}`,
            };
            await repository.updateImport(fileRecord.id.value, updateData);
            return updateData;
        }

        if (controlErrors > 0) {
            const updateData = {
                status: 'incompleted',
                last_updated_at: new Date().toISOString(),
                error_details: errorDetails,
            };
            await repository.updateImport(fileRecord.id.value, updateData);
            return updateData;
        }

        if (totalRecordsInserted === records.length) {
            const updateData = {
                status: 'completed',
                last_updated_at: new Date().toISOString(),
            };
            await repository.updateImport(fileRecord.id.value, updateData);
            return updateData;
        }
    }
}

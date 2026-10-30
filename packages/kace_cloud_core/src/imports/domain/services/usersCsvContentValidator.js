import {
    StatusEnum,
    ValueObjectEmail,
    ValueObjectPhoneNumber,
    ValueObjectEnum,
    ValueObjectUuid,
    ValueObjectJson,
    ValueObjectCodigoExterno,
} from '../../../shared';
import { ValueObjectUserName } from '../../../users/domain/ValueObjectUserName';
import { toExternalCodesObject } from '../../../shared/domain/utilities/processExternalCodes';

export class usersCsvContentValidator {
    /**
     * Valida fila por fila usando ValueObjects, únicamente para los campos presentes.
     * @param {Object} params
     * @param {Array<Object>} params.csvContent
     * @returns {Promise<{isValid:boolean, errors:Array, sanitized:Array, summary:string}>}
     */
    static async validate(csvContent, repository) {
        const errors = [];
        const sanitized = [];

        const ALLOWED_FIELDS = new Set([
            'id',
            'nombres',
            'apellido1',
            'apellido2',
            'email',
            'telefono',
            'movil',
            'is_active',
            'rol_id',
            'codigos_externos',
            'external_id',
            'grupos',
        ]);

        const FIELD_VALIDATORS = {
            id: (v) => new ValueObjectUuid('id', v),
            nombres: (v) => new ValueObjectUserName('nombres', v),
            apellido1: (v) => new ValueObjectUserName('apellido1', v, true),
            apellido2: (v) => new ValueObjectUserName('apellido2', v, true),
            email: (v) => new ValueObjectEmail('email', v),
            telefono: (v) => new ValueObjectPhoneNumber('telefono', v, true),
            movil: (v) => new ValueObjectPhoneNumber('movil', v, true),
            is_active: (v) => new ValueObjectEnum('is_active', v, Object.values(StatusEnum.toJson())),
            rol_id: (v) => new ValueObjectUuid('rol_id', v),
            codigos_externos: (v) => new ValueObjectJson('codigos_externos', v, true),
            external_id: (v) => new ValueObjectCodigoExterno('external_id', v, true),
        };

        for (let i = 0; i < (csvContent?.length ?? 0); i++) {
            const raw = csvContent[i] ?? {};
            const rowErrors = [];

            const dto = {};
            for (const [k, v] of Object.entries(raw)) {
                if (ALLOWED_FIELDS.has(k)) dto[k] = v;
            }

            if (dto.is_active != null) {
                const num = Number(dto.is_active.trim());
                if (Number.isNaN(num)) {
                    rowErrors.push({
                        field: 'is_active',
                        message: 'Invalid numeric enum value',
                    });
                } else {
                    dto.is_active = num;
                }
            }

            dto.codigos_externos = toExternalCodesObject(dto.codigos_externos);

            for (const [field, value] of Object.entries(dto)) {
                if (value === '' || value === null || typeof value === 'undefined') continue;

                const validator = FIELD_VALIDATORS[field];
                if (!validator) continue;

                try {
                    validator(value);
                } catch (e) {
                    // SI: Se guardan los errores en array para posterior reporte, no es necesario log
                    rowErrors.push({
                        field,
                        message: e?.message ?? 'valor inválido',
                    });
                }
            }

            if (dto.rol_id && !rowErrors.some((e) => e.field === 'rol_id')) {
                try {
                    const role = await repository.findActiveRoleById(dto.rol_id);
                    if (!role) {
                        rowErrors.push({
                            field: 'rol_id',
                            message: 'El rol no existe o está eliminado',
                        });
                    }
                } catch (e) {
                    // SI: Se guardan los errores en array para posterior reporte, no es necesario log
                    rowErrors.push({
                        field: 'rol_id',
                        message: 'Error verificando rol_id.',
                    });
                }
            }
            if (dto.grupos && repository) {
                const allGroupIds = this.#parseGroupIds(dto.grupos);

                const invalidFormats = [];
                const validGroupIds = [];
                const seen = new Set();

                for (const gid of allGroupIds) {
                    try {
                        new ValueObjectUuid('grupos', gid);
                        if (!seen.has(gid)) {
                            validGroupIds.push(gid);
                            seen.add(gid);
                        }
                    } catch {
                        // SI: Se guardan los errores en array para posterior reporte, no es necesario log
                        invalidFormats.push(gid);
                    }
                }

                if (invalidFormats.length > 0) {
                    rowErrors.push({
                        field: 'grupos',
                        message: `Formato de UUID inválido en: ${invalidFormats.join(', ')}`,
                    });
                }

                if (validGroupIds.length > 0) {
                    try {
                        const found = await repository.findActiveGroupsByIds(validGroupIds);
                        const foundSet = new Set(found.map((r) => r.id));
                        const missing = validGroupIds.filter((id) => !foundSet.has(id));

                        if (missing.length > 0) {
                            rowErrors.push({
                                field: 'grupos',
                                message: `Los siguientes grupos no existen o están eliminados: ${missing.join('; ')}`,
                            });
                        }
                    } catch {
                        // SI: Se guardan los errores en array para posterior reporte, no es necesario log
                        rowErrors.push({
                            field: 'grupos',
                            message: 'Error verificando grupos en base de datos',
                        });
                    }
                }
            }

            if (rowErrors.length > 0) {
                errors.push({
                    row: i + 1,
                    errors: rowErrors,
                });
                if (errors.length >= 20) {
                    break;
                }
            } else {
                sanitized.push(dto);
            }
        }

        const isValid = errors.length === 0;
        const summary = this.#formatErrorsForSummary(errors);
        return {
            isValid,
            errors,
            sanitized,
            summary,
        };
    }

    static #formatErrorsForSummary(errors) {
        if (!errors || errors.length === 0) return '';
        return errors
            .map((e) => {
                const fields = e.errors.map((er) => `${er.message}`).join('; ');
                return `Error en el registro ${e.row}: ${fields}`;
            })
            .join(', ');
    }

    static #parseGroupIds(input) {
        if (input == null) return [];
        const raw = String(input).trim();
        if (!raw) return [];
        return raw
            .split(/[,\n;]+/)
            .map((s) => s.trim())
            .filter(Boolean);
    }
}

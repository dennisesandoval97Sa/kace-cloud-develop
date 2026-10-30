import { v4 as uuidv4 } from 'uuid';
import { AuxCases } from '../../../src/aux_casos/index.js';
import dayjs from 'dayjs';

export class AuxCasesMother {
    static dto(override = {}) {
        return {
            id: uuidv4(),
            caso_id: uuidv4(),
            data: {
                fecha_solicitud: new Date(),
                tipo_usuario: 'Abbanded',
                numero_pedido: '123456',
                canal_contacto: 'sms',
                motivo_interaccion: 'PQR',
                spc: 'test',
                tiempo_solucion: '1',
                progreso: {
                    inicio: true,
                },
            },
            updated_at: new Date(),
            created_at: new Date(),
            created_by: uuidv4(),
            ...override,
        };
    }

    /**
     * Generates a DTO with aux_cases data structured for the "reclamaciones" form,
     * including the `gestion_reclamacion` section with the date field used in assignment conditions.
     *
     * @param {string} [fechaReprogramacion] ISO date string for fecha_y_hora_de_reprogramacion.
     *   Defaults to yesterday (past date → condition "<datetime" should be true).
     * @param {object} [override] - Additional overrides for the root DTO.
     */
    static reclamacionesDto(fechaReprogramacion, override = {}) {
        return {
            ...this.dto(override),
            data: {
                reclamaciones: {
                    gestion_reclamacion: {
                        fecha_y_hora_de_reprogramacion: fechaReprogramacion ?? dayjs().subtract(1, 'day').toISOString(),
                    },
                },
            },
        };
    }

    /**
     *
     * @param {KnexAuxCasesRepository} repository
     * @param {object} overrides
     * @returns {Promise<AuxCases>}
     */
    static async createAuxCase(repository, overrides = {}) {
        const auxCase = AuxCases.create(this.dto(overrides));
        await repository.save(auxCase);
        return auxCase;
    }
}

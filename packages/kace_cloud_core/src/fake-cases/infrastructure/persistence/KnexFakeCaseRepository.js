import { Helper, KnexRepository } from '../../../shared/index.js';
import FakeCases from '../../domain/FakeCases.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';

export default class KnexFakeCaseRepository extends KnexRepository {
    constructor(config) {
        super(config, 'fake_cases');
    }

    /**
     *
     * @param {ValueObjectUuid} id
     * @returns {Promise<Case|null>}
     */
    async find(id) {
        try {
            const result = await this.table().where({ id: id.value }).first();
            return result ? new FakeCases(result) : null;
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('find');
        }
    }

    /**
     * @param {FakeCases} kase
     */
    async save(kase) {
        try {
            await this.table()
                .insert({
                    id: kase.id.value,
                    cliente_id: kase.cliente_id.value,
                    transicion_id: kase.transicion_id.value,
                    responsable_id: kase.responsable_id.value,
                    clasificacion_id: kase.clasificacion_id.value,
                    descripcion_caso_id: kase.descripcion_caso_id.value,
                    cambio_estado_comentario_id: kase.cambio_estado_comentario_id.value,
                    caso_clonado_id: kase.caso_clonado_id.value,
                    canal_id: kase.canal_id.value,
                    grupo_id: kase.grupo_id.value,
                    fecha_resolucion: kase.fecha_resolucion.value,
                    antiguedad: kase.antiguedad.value,
                    ans_posicion: kase.ans_posicion.value,
                    antiguedad_dias: kase.antiguedad_dias.value,
                    antiguedad_horas: kase.antiguedad_horas.value,
                    antiguedad_minutos: kase.antiguedad_minutos.value,
                    motivo_baja: kase.motivo_baja.value,
                    alto_impacto: kase.alto_impacto.value,
                    vista: kase.vista.value,
                    cambio_clasificacion: kase.cambio_clasificacion.value,
                    cloned_by: kase.cloned_by.value,
                    cloned_at: kase.cloned_at.value,
                    reopen_at: kase.reopen_at.value,
                    reopen_by: kase.reopen_by.value,
                    created_at: kase.created_at.value,
                    updated_at: kase.updated_at.value,
                    created_by: kase.created_by.value,
                    updated_by: kase.updated_by.value,
                    edited_by: kase.edited_by.value,
                    edited_at: kase.edited_at.value,
                })
                .returning('*');
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('save');
        }
    }

    /**
     *
     * @param {ValueObjectUuid} id
     * @returns {Promise<void>}
     */
    async delete(id) {
        try {
            await this.table().where({ id: id.value }).delete();
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('delete');
        }
    }
}

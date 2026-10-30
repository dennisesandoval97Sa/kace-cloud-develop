import { CaseDataGrid } from './CaseDataGrid';
import { ValueObjectJson } from '../../shared';

export class ViewCase extends CaseDataGrid {
    /**
     * @type {ValueObjectJson}
     * is initialized in the constructor
     */
    #aux_data;

    constructor(dto) {
        super(dto);
        const {
            id,
            nivel1,
            nivel2,
            nivel3,
            nivel4,
            nivel5,
            nivel6,
            nivel7,
            nivel8,
            nivel9,
            nivel10,
            color_ans_inicial,
            color_ans_intermedio,
            color_ans_final,
            estadoActual,
            antiguedad,
            ans_posicion,
            nombres,
            apellido1,
            apellido2,
            login,
            usuario_inactivo,
            creator_external_id,
            nombreCliente,
            primerApellido,
            segundoApellido,
            documento,
            tipo_cliente,
            nombre_empresa,
            created_at,
            updated_at,
            cambio_estado_comentario_id,
            caso_clonado_id,
            fecha_resolucion,
            antiguedad_dias,
            antiguedad_horas,
            antiguedad_minutos,
            motivo_baja,
            reference,
            folio,
            created_by,
            edited_at,
            edited_by,
            ...rest
        } = dto;

        this.#aux_data = new ValueObjectJson('aux_data', rest);
    }

    get aux_data() {
        return this.#aux_data.value;
    }

    static create(dto) {
        return new ViewCase(dto);
    }
}

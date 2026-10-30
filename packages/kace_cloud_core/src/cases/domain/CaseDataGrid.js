import { AggregateRoot } from '../../shared';

/**
 * Database row keys that are mapped to fixed grid fields in the constructor.
 * Any other key (e.g. dynamic `select` aliases from joined searches) is stored in {@link CaseDataGrid#extras}.
 */
const KNOWN_DTO_KEYS = new Set([
    'id',
    'nivel1',
    'nivel2',
    'nivel3',
    'nivel4',
    'nivel5',
    'nivel6',
    'nivel7',
    'nivel8',
    'nivel9',
    'nivel10',
    'color_ans_inicial',
    'color_ans_intermedio',
    'color_ans_final',
    'estadoActual',
    'transicion_id',
    'antiguedad',
    'ans_posicion',
    'nombres',
    'apellido1',
    'apellido2',
    'login',
    'usuario_inactivo',
    'nombreCliente',
    'primerApellido',
    'segundoApellido',
    'documento',
    'cambio_estado_comentario_id',
    'caso_clonado_id',
    'fecha_resolucion',
    'antiguedad_dias',
    'antiguedad_horas',
    'antiguedad_minutos',
    'motivo_baja',
    'created_at',
    'updated_at',
    'edited_at',
    'edited_by',
    'reference',
    'folio',
    'tipo_cliente',
    'nombre_empresa',
    'creator_external_id',
    'sla_due_date',
    'sla_state_position',
    'parent_id',
    'is_visible',
]);

export class CaseDataGrid extends AggregateRoot {
    /** is initialized in the constructor */
    #nivel1;
    /** is initialized in the constructor */
    #nivel2;
    /** is initialized in the constructor */
    #nivel3;
    /** is initialized in the constructor */
    #nivel4;
    /** is initialized in the constructor */
    #nivel5;
    /** is initialized in the constructor */
    #nivel6;
    /** is initialized in the constructor */
    #nivel7;
    /** is initialized in the constructor */
    #nivel8;
    /** is initialized in the constructor */
    #nivel9;
    /** is initialized in the constructor */
    #nivel10;
    /** is initialized in the constructor */
    #color_ans_inicial;
    /** is initialized in the constructor */
    #color_ans_intermedio;
    /** is initialized in the constructor */
    #color_ans_final;
    /** is initialized in the constructor */
    #estadoActual;
    /** is initialized in the constructor */
    #transicion_id;
    /** is initialized in the constructor */
    #antiguedad;
    /** is initialized in the constructor */
    #ans_posicion;
    /** is initialized in the constructor */
    #nombres;
    /** is initialized in the constructor */
    #apellido1;
    /** is initialized in the constructor */
    #apellido2;
    /** is initialized in the constructor */
    #login;
    /** is initialized in the constructor */
    #usuario_inactivo;
    /** is initialized in the constructor */
    #nombreCliente;
    /** is initialized in the constructor */
    #primerApellido;
    /** is initialized in the constructor */
    #segundoApellido;
    /** is initialized in the constructor */
    #documento;
    /** is initialized in the constructor */
    #cambio_estado_comentario_id;
    /** is initialized in the constructor */
    #caso_clonado_id;
    /** is initialized in the constructor */
    #fecha_resolucion;
    /** is initialized in the constructor */
    #antiguedad_dias;
    /** is initialized in the constructor */
    #antiguedad_horas;
    /** is initialized in the constructor */
    #antiguedad_minutos;
    /** is initialized in the constructor */
    #motivo_baja;
    /** is initialized in the constructor */
    #created_at;
    /** is initialized in the constructor */
    #updated_at;
    /** is initialized in the constructor */
    #reference;
    /** is initialized in the constructor */
    #folio;
    /** is initialized in the constructor */
    #tipo_cliente;
    /** is initialized in the constructor */
    #nombre_empresa;
    /** is initialized in the constructor */
    #creator_external_id;
    /** is initialized in the constructor */
    #sla_due_date;
    /** is initialized in the constructor */
    #sla_state_position;
    /** is initialized in the constructor */
    #parent_id;
    /** is initialized in the constructor */
    #is_visible;
    /** is initialized in the constructor */
    #edited_at;
    /** is initialized in the constructor */
    #edited_by;
    /** is initialized in the constructor */
    #extras;
    get sla_due_date() {
        return this.#sla_due_date;
    }

    constructor(dto) {
        super(dto.id);
        this.#nivel1 = dto.nivel1;
        this.#nivel2 = dto.nivel2;
        this.#nivel3 = dto.nivel3;
        this.#nivel4 = dto.nivel4;
        this.#nivel5 = dto.nivel5;
        this.#nivel6 = dto.nivel6;
        this.#nivel7 = dto.nivel7;
        this.#nivel8 = dto.nivel8;
        this.#nivel9 = dto.nivel9;
        this.#nivel10 = dto.nivel10;
        this.#color_ans_inicial = dto.color_ans_inicial;
        this.#color_ans_intermedio = dto.color_ans_intermedio;
        this.#color_ans_final = dto.color_ans_final;
        this.#estadoActual = dto.estadoActual;
        this.#transicion_id = dto.transicion_id;
        this.#antiguedad = dto.antiguedad;
        this.#ans_posicion = dto.ans_posicion;
        this.#nombres = dto.nombres;
        this.#apellido1 = dto.apellido1;
        this.#apellido2 = dto.apellido2;
        this.#login = dto.login;
        this.#usuario_inactivo = dto.usuario_inactivo;
        this.#creator_external_id = dto.creator_external_id;
        this.#nombreCliente = dto.nombreCliente;
        this.#primerApellido = dto.primerApellido;
        this.#segundoApellido = dto.segundoApellido;
        this.#documento = dto.documento;
        this.#tipo_cliente = dto.tipo_cliente;
        this.#nombre_empresa = dto.nombre_empresa;
        this.#created_at = dto.created_at;
        this.#updated_at = dto.updated_at;
        this.#cambio_estado_comentario_id = dto.cambio_estado_comentario_id;
        this.#caso_clonado_id = dto.caso_clonado_id;
        this.#fecha_resolucion = dto.fecha_resolucion;
        this.#antiguedad_dias = dto.antiguedad_dias;
        this.#antiguedad_horas = dto.antiguedad_horas;
        this.#antiguedad_minutos = dto.antiguedad_minutos;
        this.#motivo_baja = dto.motivo_baja;
        this.#reference = dto.reference;
        this.#folio = dto.folio;
        this.#sla_due_date = dto.sla_due_date;
        this.#sla_state_position = dto.sla_state_position;
        this.#parent_id = dto.parent_id;
        this.#is_visible = dto.is_visible;
        this.#edited_at = dto.edited_at;
        this.#edited_by = dto.edited_by;
        this.#extras = {};

        /**
         * Extra SQL result columns (aliases not mapped above), e.g. `aux_cases_data` or `json_extract(...)` from
         * `POST .../sub-cases/search` with `relationship` + `select`. Serialized in
         * {@link SubCaseRelationCollectionResponse#toJson} via `...kase.extras`.
         */
        Object.keys(dto).forEach((key) => {
            if (!KNOWN_DTO_KEYS.has(key)) {
                this.#extras[key] = dto[key];
            }
        });
    }

    get nivel1() {
        return this.#nivel1;
    }

    get nivel2() {
        return this.#nivel2;
    }

    get nivel3() {
        return this.#nivel3;
    }

    get nivel4() {
        return this.#nivel4;
    }

    get nivel5() {
        return this.#nivel5;
    }

    get nivel6() {
        return this.#nivel6;
    }

    get nivel7() {
        return this.#nivel7;
    }

    get nivel8() {
        return this.#nivel8;
    }

    get nivel9() {
        return this.#nivel9;
    }

    get nivel10() {
        return this.#nivel10;
    }

    get color_ans_inicial() {
        return this.#color_ans_inicial;
    }

    get color_ans_intermedio() {
        return this.#color_ans_intermedio;
    }

    get color_ans_final() {
        return this.#color_ans_final;
    }

    get estadoActual() {
        return this.#estadoActual;
    }

    get transicion_id() {
        return this.#transicion_id;
    }

    get antiguedad() {
        return this.#antiguedad;
    }

    get ans_posicion() {
        return this.#ans_posicion;
    }

    get nombres() {
        return this.#nombres;
    }

    get apellido1() {
        return this.#apellido1;
    }

    get apellido2() {
        return this.#apellido2;
    }

    get login() {
        return this.#login;
    }
    get usuario_inactivo() {
        return this.#usuario_inactivo;
    }

    get creator_external_id() {
        return this.#creator_external_id;
    }

    get nombreCliente() {
        return this.#nombreCliente;
    }

    get primerApellido() {
        return this.#primerApellido;
    }

    get segundoApellido() {
        return this.#segundoApellido;
    }

    get documento() {
        return this.#documento;
    }

    get cambio_estado_comentario_id() {
        return this.#cambio_estado_comentario_id;
    }

    get caso_clonado_id() {
        return this.#caso_clonado_id;
    }

    get fecha_resolucion() {
        return this.#fecha_resolucion;
    }

    get antiguedad_dias() {
        return this.#antiguedad_dias;
    }

    get antiguedad_horas() {
        return this.#antiguedad_horas;
    }

    get antiguedad_minutos() {
        return this.#antiguedad_minutos;
    }

    get motivo_baja() {
        return this.#motivo_baja;
    }

    get created_at() {
        return this.#created_at;
    }

    get updated_at() {
        return this.#updated_at;
    }

    get reference() {
        return this.#reference;
    }

    get folio() {
        return this.#folio;
    }

    get tipo_cliente() {
        return this.#tipo_cliente;
    }

    get nombre_empresa() {
        return this.#nombre_empresa;
    }
    get sla_state_position() {
        return this.#sla_state_position;
    }

    get parent_id() {
        return this.#parent_id;
    }

    get is_visible() {
        return this.#is_visible;
    }

    get edited_at() {
        return this.#edited_at;
    }

    get edited_by() {
        return this.#edited_by;
    }

    /**
     * Extra column values from the row; defensive copy so internal state is not exposed.
     */
    get extras() {
        return { ...this.#extras };
    }
}

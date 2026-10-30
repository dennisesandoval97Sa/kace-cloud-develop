import { v4 as uuidv4 } from 'uuid';
import { ViewCase, CaseViewCollectionResponse } from '../../src/cases';

describe('ViewCase', () => {
    it('should extract aux_data from dto', () => {
        const dto = {
            id: uuidv4(),
            nivel1: 'Nivel 1',
            extra_1: 'foo',
            extra_2: 'bar',
        };

        const viewCase = ViewCase.create(dto);

        expect(viewCase.aux_data).toMatchObject({
            extra_1: 'foo',
            extra_2: 'bar',
        });
    });

    it('should ignore core fields in aux_data', () => {
        const dto = {
            id: uuidv4(),
            nivel1: 'Nivel 1',
            created_by: uuidv4(),
            extra_1: 'extra',
        };

        const viewCase = ViewCase.create(dto);

        expect(viewCase.aux_data).toHaveProperty('extra_1', 'extra');
        expect(viewCase.aux_data).not.toHaveProperty('created_by');
    });
});

describe('CaseViewCollectionResponse', () => {
    const sampleDto = {
        id: uuidv4(),
        nivel1: 'Nivel 1',
        nivel2: 'Nivel 2',
        nivel3: 'Nivel 3',
        nivel4: 'Nivel 4',
        nivel5: 'Nivel 5',
        nivel6: 'Nivel 6',
        nivel7: 'Nivel 7',
        nivel8: 'Nivel 8',
        nivel9: 'Nivel 9',
        nivel10: 'Nivel 10',
        color_ans_inicial: 'green',
        color_ans_intermedio: 'yellow',
        color_ans_final: 'red',
        estadoActual: 'Abierto',
        antiguedad: '1d',
        ans_posicion: 'Alta',
        nombres: 'Juan',
        apellido1: null,
        apellido2: undefined,
        login: 'juan.perez',
        usuario_inactivo: false,
        nombreCliente: 'Empresa X',
        primerApellido: null,
        segundoApellido: null,
        creator_external_id: null,
        documento: '12345678',
        tipo_cliente: 'VIP',
        nombre_empresa: 'Empresa X',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        cambio_estado_comentario_id: uuidv4(),
        caso_clonado_id: null,
        fecha_resolucion: null,
        antiguedad_dias: 1,
        antiguedad_horas: 12,
        antiguedad_minutos: 30,
        motivo_baja: 'Motivo X',
        reference: 'REF123',
        created_by: uuidv4(),
        extra_field: 'valor extra',
    };

    it('should convert list of ViewCase to JSON with metadata', () => {
        const viewCases = [new ViewCase(sampleDto)];
        const response = new CaseViewCollectionResponse(viewCases, viewCases.length);

        const json = response.toJson();

        expect(json).toHaveProperty('data.items');
        expect(json).toHaveProperty('metadata.count', viewCases.length);

        const first = json.data.items[0];
        expect(first).toMatchObject({
            id: sampleDto.id,
            nivel1: sampleDto.nivel1,
            login: sampleDto.login,
            apellido1: '',
            apellido2: '',
            primerApellido: '',
            segundoApellido: '',
            creator_external_id: '',
            extra_field: 'valor extra',
        });
    });

    it('should return empty items if no cases are passed', () => {
        const response = new CaseViewCollectionResponse([], 0, []);

        const json = response.toJson();

        expect(json).toEqual({
            data: { items: [] },
            metadata: { count: 0, countByStatus: [] },
        });
    });

    it('should include color in countByStatus metadata', () => {
        const countByStatus = [
            { status: 'Abierto', count: 5, color: '#FF0000' },
            { status: 'Cerrado', count: 3, color: null },
        ];
        const response = new CaseViewCollectionResponse([], 0, countByStatus);
        const json = response.toJson();

        expect(json.metadata.countByStatus).toEqual(countByStatus);
    });
});

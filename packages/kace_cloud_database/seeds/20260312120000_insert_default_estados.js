const estadosTable = 'estados';
const flujosTable = 'flujos';
const ansTable = 'ans';
const clasificacionesTable = 'clasificaciones';

const estados = [
    {
        id: '3da3beab-aa74-42db-b7e8-198cb4d0f6fb',
        nombre: 'Solicitud inicial',
        tipo_id: null,
        descripcion: 'Solicitud inicial',
        icon_class: 'Folder',
        status: 1,
        color: '#66CC33',
        require_observation: false,
        created_by: '8a09ba2c-0231-4cc3-b02d-5b90054d6f90',
    },
    {
        id: '80c50014-ea72-4073-8d3a-1ada6756c1c1',
        nombre: 'En proceso',
        tipo_id: null,
        descripcion: 'En proceso',
        icon_class: 'Edit',
        status: 1,
        color: '#2BA17A',
        require_observation: false,
        created_by: '8a09ba2c-0231-4cc3-b02d-5b90054d6f90',
    },
    {
        id: '02b35df7-2f74-443d-8921-a2bb350121e7',
        nombre: 'Cerrado',
        tipo_id: null,
        descripcion: 'Cerrado',
        icon_class: 'Check',
        status: 1,
        color: '#2563EB',
        require_observation: false,
        created_by: '8a09ba2c-0231-4cc3-b02d-5b90054d6f90',
    },
];

const flujo = {
    id: 'b013d35f-5ca9-4340-a1bd-2911dcc874b6',
    nombre: 'Basic',
    json_flujo: JSON.stringify({
        edges: [
            {
                id: 'reactflow__edge-0-3da3beab-aa74-42db-b7e8-198cb4d0f6fbtop',
                type: 'custom',
                source: '0',
                target: '3da3beab-aa74-42db-b7e8-198cb4d0f6fb',
                sourceHandle: null,
                targetHandle: 'top',
                kace_transition: '0bd4a83b-352f-4261-9639-e5fbd7550087',
                transition_existed: false,
            },
            {
                id: 'reactflow__edge-3da3beab-aa74-42db-b7e8-198cb4d0f6fbbottom-80c50014-ea72-4073-8d3a-1ada6756c1c1top',
                type: 'custom',
                source: '3da3beab-aa74-42db-b7e8-198cb4d0f6fb',
                target: '80c50014-ea72-4073-8d3a-1ada6756c1c1',
                sourceHandle: 'bottom',
                targetHandle: 'top',
                kace_transition: 'b8f72863-ee66-42fb-bd0b-2bd6b00df19d',
                transition_existed: false,
            },
            {
                id: 'reactflow__edge-80c50014-ea72-4073-8d3a-1ada6756c1c1bottom-02b35df7-2f74-443d-8921-a2bb350121e7top',
                type: 'custom',
                source: '80c50014-ea72-4073-8d3a-1ada6756c1c1',
                target: '02b35df7-2f74-443d-8921-a2bb350121e7',
                sourceHandle: 'bottom',
                targetHandle: 'top',
                kace_transition: '13c696d8-e15e-4a14-9a70-0fe483a593d5',
                transition_existed: false,
            },
        ],
        nodes: [
            {
                id: '0',
                data: { label: 'inicio' },
                type: 'input',
                width: 150,
                height: 40,
                dragging: false,
                position: { x: 300, y: 0 },
                selected: false,
                positionAbsolute: { x: 0, y: 0 },
            },
            {
                id: '02b35df7-2f74-443d-8921-a2bb350121e7',
                data: { label: 'Cerrado' },
                type: 'custom',
                style: {
                    color: '#A100C2',
                    border: '2px solid #A100C2',
                    background: 'rgba(208, 192, 247, 0.5)',
                    fontWeight: 'bold',
                },
                width: 4,
                height: 4,
                dragging: false,
                position: { x: 291, y: 321 },
                selected: false,
                positionAbsolute: { x: 291, y: 321 },
            },
            {
                id: '3da3beab-aa74-42db-b7e8-198cb4d0f6fb',
                data: { label: 'Solicitud inicial' },
                type: 'custom',
                style: {
                    color: '#A100C2',
                    border: '2px solid #A100C2',
                    background: 'rgba(208, 192, 247, 0.5)',
                    fontWeight: 'bold',
                },
                width: 4,
                height: 4,
                dragging: false,
                position: { x: 300, y: 118 },
                selected: false,
                positionAbsolute: { x: 300, y: 118 },
            },
            {
                id: '80c50014-ea72-4073-8d3a-1ada6756c1c1',
                data: { label: 'En proceso' },
                type: 'custom',
                style: {
                    color: '#A100C2',
                    border: '2px solid #A100C2',
                    background: 'rgba(208, 192, 247, 0.5)',
                    fontWeight: 'bold',
                },
                width: 4,
                height: 4,
                dragging: false,
                position: { x: 280, y: 220 },
                selected: false,
                positionAbsolute: { x: 280, y: 220 },
            },
        ],
    }),
    status: 1,
    created_by: '8a09ba2c-0231-4cc3-b02d-5b90054d6f90',
};

const ans = {
    id: '0e47245c-de5e-4371-8123-2dc081d33c48',
    nombre: 'Basic',
    intermedio: 5,
    vencido: 10,
    color_ans_inicial: '#2BA17A',
    color_ans_intermedio: '#E8C468',
    color_ans_final: '#E76E50',
    status: 1,
    medicion_ans_id: 'Minutes',
    created_by: '8a09ba2c-0231-4cc3-b02d-5b90054d6f90',
};

const clasificacion = {
    id: 'bd997f63-a28b-4469-8e2f-71e85b8adac5',
    nivel1: 'Categoria',
    nivel2: '',
    nivel3: '',
    nivel4: '',
    nivel5: '',
    nivel6: '',
    nivel7: '',
    nivel8: '',
    nivel9: '',
    nivel10: '',
    flujo_id: 'b013d35f-5ca9-4340-a1bd-2911dcc874b6',
    ans_id: '0e47245c-de5e-4371-8123-2dc081d33c48',
    is_active: true,
    created_by: '8a09ba2c-0231-4cc3-b02d-5b90054d6f90',
    default_group_id: '3824c61a-6368-4c5c-957f-769525109e85',
    external_id: '',
    can_start_sub_cases_flow: true,
    json_flujo: null,
    description: 'Categoria',
};

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function seed(knex) {
    const currentDate = new Date().toISOString();

    for (const estado of estados) {
        estado.created_at = currentDate;
    }

    await knex(estadosTable).insert(estados);

    flujo.created_at = currentDate;
    await knex(flujosTable).insert(flujo);

    ans.created_at = currentDate;
    await knex(ansTable).insert(ans);

    clasificacion.created_at = currentDate;
    await knex(clasificacionesTable).insert(clasificacion);
}

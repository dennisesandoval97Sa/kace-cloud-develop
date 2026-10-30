import { jest } from '@jest/globals';
import { v4 as uuid } from 'uuid';

import { knexConfig } from '../knexfile.js';
import { KnexWSRestFlowRepository, WSRestFlowUpdater } from '../../src/ws-rest-flows/index.js';
import { KnexWSRestWorkflowStepRepository } from '../../src/ws-rest-workflow-step/infrastructure/persistence/KnexWSRestWorkflowStepRepository.js';
import { WSRestConditionalCreator } from '../../src/ws-rest-conditionals/application/create/WSRestConditionalCreator.js';
import { WSRestConditionalUpdater } from '../../src/ws-rest-conditionals/application/update/WSRestConditionalUpdater.js';
import { WSRestConditionalFinder } from '../../src/ws-rest-conditionals/domain/WSRestConditionalFinder.js';
import { WSRestFlowStepManager } from '../../src/ws-rest-flows/application/services/WSRestFlowStepManager.js';
import { EventLogger } from '../../src/shared/EventLogger.js';
import { Helper } from '../../src/shared/infrastructure/utils/Helper.js';
import WSRestFlowMother from './domain/WSRestFlowMother.js';

const failingPayload = {
    description:
        'Este flujo REST permite la obtención de casos bot de finalización, validando una contingencia activa, cruzando información y aplicando filtros por (flags) y estado concluido.(rest_flow_list_close_cases_for_closing) (RF28) - viejo',
    is_active: true,
    is_primary: true,
    external_code: 'rest_flow_list_close_cases_for_closing_viejo',
    json_diagram_properties: {
        nodes: [
            {
                id: '0',
                data: { label: 'inicio' },
                type: 'input',
                width: 150,
                height: 40,
                dragging: false,
                position: { x: 160, y: 73 },
                selected: false,
                positionAbsolute: { x: 160, y: 73 },
            },
            {
                id: '08188b1b-a2fd-44bd-aa11-77819c6f9b27',
                data: {
                    id: '15d2cfe9-bc35-48ce-9a05-70f94addfe97',
                    type: 'conditional',
                    label: 'If list_close_cases_for_closing.data.items[0].caso_id null',
                    value: '',
                    filter: 'list_close_cases_for_closing.data.items[0].caso_id',
                    operator: 'null',
                    subflows: { unsatisfied: 'b2ecc6a1-c5b2-40f0-af60-83e7b284001b' },
                    conditionType: 'null',
                },
                type: 'conditional',
                style: { wordBreak: 'break-word' },
                width: 120,
                height: 120,
                dragging: false,
                position: { x: 171.0114187384478, y: 711.7110111436332 },
                selected: false,
                positionAbsolute: { x: 171.0114187384478, y: 711.7110111436332 },
            },
            {
                id: 'f95efc3d-4f1e-4bff-9c2c-1c01b977e196',
                data: {
                    id: 'fc377de2-75c7-4bbd-89a0-3456707e242a',
                    type: 'conditional',
                    label: 'If functions.activo_contingencia.activo_general_estrategia = 1',
                    value: '1',
                    filter: 'functions.activo_contingencia.activo_general_estrategia',
                    operator: '=',
                    subflows: {
                        satisfied: 'f26c3a80-efc7-46bf-bc88-eef510d9f3a9',
                        unsatisfied: 'd192571a-389d-4606-8af5-32d9f086a2d5',
                    },
                    conditionType: 'eq',
                },
                type: 'conditional',
                style: { wordBreak: 'break-word' },
                width: 120,
                height: 120,
                dragging: false,
                position: { x: 163.1693488269392, y: 498.19314286324027 },
                selected: false,
                positionAbsolute: { x: 163.1693488269392, y: 498.19314286324027 },
            },
            {
                id: '2a19fc2d-54ac-4c2b-8c11-73ba56e0b7f3',
                data: {
                    id: 'a3c556b3-38d8-48b3-9150-5364a6e4508f',
                    type: 'endpoint',
                    label: 'Endpoint para filtrar y obtener la estrategia de contingencia  (estrategias_generales). (rest_flow_list_close_cases_for_closing)(RF28)',
                },
                style: { color: 'black', wordBreak: 'break-word', backgroundColor: 'rgb(232, 196, 104)' },
                width: 150,
                height: 148,
                dragging: false,
                position: { x: 62.41799632660104, y: 139.67152665567227 },
                selected: false,
                positionAbsolute: { x: 62.41799632660104, y: 139.67152665567227 },
            },
            {
                id: '193747dd-80b7-4eb4-9d7d-fc8c1b7be5e4',
                data: {
                    id: '8daae47b-dac5-448f-bea0-9e1eeaacf3dc',
                    type: 'conditional',
                    label: 'Si list_close_cases_for_closing.data.items[0].flag_numero_consumos > 2',
                    value: '2',
                    filter: 'list_close_cases_for_closing.data.items[0].flag_numero_consumos',
                    operator: '>',
                    subflows: {
                        satisfied: '13c60523-9bc2-4913-a2f0-f263eed3de41',
                        unsatisfied: '02b239cc-568e-481b-abb5-c3eac46b53dd',
                    },
                    conditionType: 'gt',
                },
                type: 'conditional',
                style: { wordBreak: 'break-word' },
                width: 120,
                height: 120,
                dragging: false,
                position: { x: -24, y: 811.905785157102 },
                selected: false,
                positionAbsolute: { x: -24, y: 811.905785157102 },
            },
            {
                id: '4dce725d-df93-45c5-bafc-8a015cdb5359',
                data: { id: 'ecc14202-111f-47b1-9eae-4903933a3583', type: 'function', label: 'Fecha Actual' },
                style: { color: 'white', wordBreak: 'break-word', backgroundColor: 'rgb(231, 110, 80)' },
                width: 150,
                height: 40,
                dragging: false,
                position: { x: -45.74563444575398, y: 725.4763737553233 },
                selected: false,
                positionAbsolute: { x: -45.74563444575398, y: 725.4763737553233 },
            },
            {
                id: '1cb5054f-8a86-4dcd-ac87-4e535543bafc',
                data: {
                    id: 'dd9e36a7-971d-4c95-b7ef-55d121c0cb4a',
                    type: 'function',
                    label: 'format data bot finalizacion',
                },
                style: { color: 'white', wordBreak: 'break-word', backgroundColor: 'rgb(231, 110, 80)' },
                width: 150,
                height: 58,
                dragging: false,
                position: { x: -95.50830559443088, y: 614.9519419376362 },
                selected: false,
                positionAbsolute: { x: -95.50830559443088, y: 614.9519419376362 },
            },
            {
                id: 'c0934836-6b7d-4b00-bd52-b563a97b350c',
                data: {
                    id: '5671f102-f541-468c-be04-821ab156b68a',
                    type: 'endpoint',
                    label: 'Endpoint para filtrar casos con estado Concluido y CE Documentado. (rest_flow_list_close_cases_for_closing)(RF28)',
                },
                style: { color: 'black', wordBreak: 'break-word', backgroundColor: 'rgb(232, 196, 104)' },
                width: 150,
                height: 130,
                dragging: false,
                position: { x: -79.83144840262344, y: 322.29202685083305 },
                selected: false,
                positionAbsolute: { x: -79.83144840262344, y: 322.29202685083305 },
            },
            {
                id: 'd38305ae-4583-4e4e-afe3-4bb818fbd5d0',
                data: {
                    id: '2bd92635-a9b4-493a-9d3b-2a39c02aa50a',
                    type: 'function',
                    label: 'Esta función formatea los valores booleanos extraídos de activo_contingencia y los convierte a valores numéricos para su uso en condicionales. (rest_flow_list_close_cases_for_closing)(RF28)',
                },
                style: { color: 'white', wordBreak: 'break-word', backgroundColor: 'rgb(231, 110, 80)' },
                width: 150,
                height: 184,
                dragging: false,
                position: { x: 380.05084916476824, y: 416.68213284032396 },
                selected: false,
                positionAbsolute: { x: 380.05084916476824, y: 416.68213284032396 },
            },
            {
                id: '9f031a06-2c5f-4b0f-9fc4-d231bb2deaea',
                data: {
                    id: '7b212c23-6f95-4cda-9814-3311862315e2',
                    type: 'function',
                    label: 'Autoincrementar los consumos satisfactorios hechos al bot_finalización (rest_flow_list_close_cases_for_closing)',
                },
                style: { color: 'white', wordBreak: 'break-word', backgroundColor: 'rgb(231, 110, 80)' },
                width: 150,
                height: 130,
                dragging: false,
                position: { x: -154.98516475135312, y: 945.2590548251583 },
                selected: false,
                positionAbsolute: { x: -154.98516475135312, y: 945.2590548251583 },
            },
            {
                id: '33155427-74b4-459f-8bac-5a1ee975d754',
                data: {
                    id: '26de3d33-6511-4b6c-9250-6147d5484e03',
                    type: 'function',
                    label: 'Extraer de list_close_cases_for_document el id del caso y ponerlo en primer nivel del json (rest_flow_list_close_cases_for_closing)',
                },
                style: { color: 'white', wordBreak: 'break-word', backgroundColor: 'rgb(231, 110, 80)' },
                width: 150,
                height: 148,
                dragging: false,
                position: { x: 122.52841973365207, y: 945.0209523053015 },
                selected: false,
                positionAbsolute: { x: 122.52841973365207, y: 945.0209523053015 },
            },
            {
                id: '6f664635-a6eb-4f4d-b164-71e2f37e11ca',
                data: {
                    id: 'cee1c04f-1894-465e-9390-0ab75e2177a9',
                    type: 'endpoint',
                    label: 'Endpoint para actualizar el indicador(FLAG) de aumento de consumos en el bot de finalización. (rest_flow_list_close_cases_for_closing)(RF28)',
                },
                style: { color: 'black', wordBreak: 'break-word', backgroundColor: 'rgb(232, 196, 104)' },
                width: 150,
                height: 166,
                dragging: false,
                position: { x: -109, y: 1345.872527945966 },
                selected: false,
                positionAbsolute: { x: -109, y: 1345.872527945966 },
            },
            {
                id: '9410e993-9969-4a52-8628-8f7938a05683',
                data: {
                    id: 'e03b14c1-d75a-4a6c-a53d-fc4f4ea7cff7',
                    type: 'function',
                    label: 'Esta función obtiene el caso y lo ubica en el nivel principal del JSON. (rest_flow_list_close_cases_for_closing)(RF28)',
                },
                style: { color: 'white', wordBreak: 'break-word', backgroundColor: 'rgb(231, 110, 80)' },
                width: 150,
                height: 130,
                dragging: false,
                position: { x: -106, y: 1130.872527945966 },
                selected: false,
                positionAbsolute: { x: -106, y: 1130.872527945966 },
            },
            {
                id: '07389102-882c-4bdd-9d01-bc1306929e2e',
                data: {
                    id: '58073f6f-cccc-4c5c-b0d6-bd244be06333',
                    type: 'function',
                    label: 'Esta función obtiene la flag_numero_consumos y la pasa a string. (rest_flow_list_close_cases_for_closing)(RF28)',
                },
                style: { color: 'white', wordBreak: 'break-word', backgroundColor: 'rgb(231, 110, 80)' },
                width: 150,
                height: 112,
                dragging: false,
                position: { x: 104, y: 1135.905785157102 },
                selected: false,
                positionAbsolute: { x: 104, y: 1135.905785157102 },
            },
            {
                id: '9e7af702-1ca3-4596-8f58-aca01bb79919',
                data: {
                    id: '92b67702-1968-45b5-b830-0df6ac19fb1d',
                    type: 'endpoint',
                    label: 'Endpoint para documentar el caso doc_nov_bot_finalizacion_envio_exitoso del bot de finalización. (rest_flow_list_close_cases_for_closing)(RF28)',
                },
                style: { color: 'black', wordBreak: 'break-word', backgroundColor: 'rgb(232, 196, 104)' },
                width: 150,
                height: 148,
                dragging: false,
                position: { x: 172.5625, y: 1435.905785157102 },
                selected: false,
                positionAbsolute: { x: 172.5625, y: 1435.905785157102 },
            },
            {
                id: 'c7e12b91-5481-4a3f-8830-018f731360f6',
                data: {
                    id: '9a38d731-6a59-48b1-ba9a-3794531dda2f',
                    type: 'endpoint',
                    label: 'Endpoint para actualizar el indicador(FLAG) si es mayor a 2 consumos (rest_flow_list_close_cases_for_closing)(RF28)',
                },
                style: { color: 'black', wordBreak: 'break-word', backgroundColor: 'rgb(232, 196, 104)' },
                width: 150,
                height: 130,
                dragging: false,
                position: { x: 334, y: 874.905785157102 },
                selected: false,
                positionAbsolute: { x: 334, y: 874.905785157102 },
            },
            {
                id: 'dd95fe59-db52-4cd0-b69b-c07cb238e042',
                data: {
                    id: 'be903f60-aaa6-4c79-8ef0-5e3978a55525',
                    type: 'conditional',
                    label: 'Si estrategia_contingencia.data.items[0].data.activo_general_estrategia null',
                    value: '',
                    filter: 'estrategia_contingencia.data.items[0].data.activo_general_estrategia',
                    operator: 'null',
                    conditionType: 'null',
                },
                type: 'conditional',
                style: { wordBreak: 'break-word' },
                width: 120,
                height: 120,
                dragging: false,
                position: { x: 268.4975743629129, y: 246.26179887605406 },
                selected: false,
                positionAbsolute: { x: 268.4975743629129, y: 246.26179887605406 },
            },
        ],
        edges: [
            {
                id: 'reactflow__edge-08188b1b-a2fd-44bd-aa11-77819c6f9b27no-4dce725d-df93-45c5-bafc-8a015cdb5359',
                data: { is_visible: true },
                type: 'custom',
                source: '08188b1b-a2fd-44bd-aa11-77819c6f9b27',
                target: '4dce725d-df93-45c5-bafc-8a015cdb5359',
                zIndex: 0,
                selected: false,
                sourceHandle: 'no',
                targetHandle: null,
            },
            {
                id: 'reactflow__edge-0-2a19fc2d-54ac-4c2b-8c11-73ba56e0b7f3',
                data: { is_visible: true },
                type: 'custom',
                source: '0',
                target: '2a19fc2d-54ac-4c2b-8c11-73ba56e0b7f3',
                zIndex: 0,
                selected: false,
                sourceHandle: null,
                targetHandle: null,
            },
            {
                id: 'reactflow__edge-f95efc3d-4f1e-4bff-9c2c-1c01b977e196no-c0934836-6b7d-4b00-bd52-b563a97b350c',
                data: { is_visible: true },
                type: 'custom',
                source: 'f95efc3d-4f1e-4bff-9c2c-1c01b977e196',
                target: 'c0934836-6b7d-4b00-bd52-b563a97b350c',
                zIndex: 0,
                selected: false,
                sourceHandle: 'no',
                targetHandle: null,
            },
            {
                id: 'reactflow__edge-193747dd-80b7-4eb4-9d7d-fc8c1b7be5e4no-9f031a06-2c5f-4b0f-9fc4-d231bb2deaea',
                data: { is_visible: true },
                type: 'custom',
                source: '193747dd-80b7-4eb4-9d7d-fc8c1b7be5e4',
                target: '9f031a06-2c5f-4b0f-9fc4-d231bb2deaea',
                zIndex: 0,
                selected: false,
                sourceHandle: 'no',
                targetHandle: null,
            },
            {
                id: 'reactflow__edge-4dce725d-df93-45c5-bafc-8a015cdb5359-193747dd-80b7-4eb4-9d7d-fc8c1b7be5e4in',
                data: { is_visible: true },
                type: 'custom',
                source: '4dce725d-df93-45c5-bafc-8a015cdb5359',
                target: '193747dd-80b7-4eb4-9d7d-fc8c1b7be5e4',
                zIndex: 0,
                selected: false,
                sourceHandle: null,
                targetHandle: 'in',
            },
            {
                id: 'reactflow__edge-1cb5054f-8a86-4dcd-ac87-4e535543bafc-08188b1b-a2fd-44bd-aa11-77819c6f9b27in',
                data: { is_visible: true },
                type: 'custom',
                source: '1cb5054f-8a86-4dcd-ac87-4e535543bafc',
                target: '08188b1b-a2fd-44bd-aa11-77819c6f9b27',
                zIndex: 0,
                selected: false,
                sourceHandle: null,
                targetHandle: 'in',
            },
            {
                id: 'reactflow__edge-d38305ae-4583-4e4e-afe3-4bb818fbd5d0-f95efc3d-4f1e-4bff-9c2c-1c01b977e196in',
                data: { is_visible: true },
                type: 'custom',
                source: 'd38305ae-4583-4e4e-afe3-4bb818fbd5d0',
                target: 'f95efc3d-4f1e-4bff-9c2c-1c01b977e196',
                zIndex: 0,
                selected: false,
                sourceHandle: null,
                targetHandle: 'in',
            },
            {
                id: 'reactflow__edge-9f031a06-2c5f-4b0f-9fc4-d231bb2deaea-33155427-74b4-459f-8bac-5a1ee975d754',
                data: { is_visible: true },
                type: 'custom',
                source: '9f031a06-2c5f-4b0f-9fc4-d231bb2deaea',
                target: '33155427-74b4-459f-8bac-5a1ee975d754',
                zIndex: 0,
                selected: false,
                sourceHandle: null,
                targetHandle: null,
            },
            {
                id: 'reactflow__edge-33155427-74b4-459f-8bac-5a1ee975d754-9410e993-9969-4a52-8628-8f7938a05683',
                data: { is_visible: true },
                type: 'custom',
                source: '33155427-74b4-459f-8bac-5a1ee975d754',
                target: '9410e993-9969-4a52-8628-8f7938a05683',
                zIndex: 0,
                selected: false,
                sourceHandle: null,
                targetHandle: null,
            },
            {
                id: 'reactflow__edge-9410e993-9969-4a52-8628-8f7938a05683-07389102-882c-4bdd-9d01-bc1306929e2e',
                data: { is_visible: true },
                type: 'custom',
                source: '9410e993-9969-4a52-8628-8f7938a05683',
                target: '07389102-882c-4bdd-9d01-bc1306929e2e',
                zIndex: 0,
                selected: false,
                sourceHandle: null,
                targetHandle: null,
            },
            {
                id: 'reactflow__edge-07389102-882c-4bdd-9d01-bc1306929e2e-6f664635-a6eb-4f4d-b164-71e2f37e11ca',
                data: { is_visible: true },
                type: 'custom',
                source: '07389102-882c-4bdd-9d01-bc1306929e2e',
                target: '6f664635-a6eb-4f4d-b164-71e2f37e11ca',
                zIndex: 0,
                selected: false,
                sourceHandle: null,
                targetHandle: null,
            },
            {
                id: 'reactflow__edge-6f664635-a6eb-4f4d-b164-71e2f37e11ca-9e7af702-1ca3-4596-8f58-aca01bb79919',
                data: { is_visible: true },
                type: 'custom',
                source: '6f664635-a6eb-4f4d-b164-71e2f37e11ca',
                target: '9e7af702-1ca3-4596-8f58-aca01bb79919',
                zIndex: 0,
                selected: false,
                sourceHandle: null,
                targetHandle: null,
            },
            {
                id: 'reactflow__edge-193747dd-80b7-4eb4-9d7d-fc8c1b7be5e4yes-c7e12b91-5481-4a3f-8830-018f731360f6',
                data: { is_visible: true },
                type: 'custom',
                source: '193747dd-80b7-4eb4-9d7d-fc8c1b7be5e4',
                target: 'c7e12b91-5481-4a3f-8830-018f731360f6',
                zIndex: 0,
                selected: false,
                sourceHandle: 'yes',
                targetHandle: null,
            },
            {
                id: 'reactflow__edge-c0934836-6b7d-4b00-bd52-b563a97b350c-1cb5054f-8a86-4dcd-ac87-4e535543bafc',
                data: { is_visible: true },
                type: 'custom',
                source: 'c0934836-6b7d-4b00-bd52-b563a97b350c',
                target: '1cb5054f-8a86-4dcd-ac87-4e535543bafc',
                selected: false,
                sourceHandle: null,
                targetHandle: null,
            },
            {
                id: 'reactflow__edge-2a19fc2d-54ac-4c2b-8c11-73ba56e0b7f3-dd95fe59-db52-4cd0-b69b-c07cb238e042in',
                data: { is_visible: true },
                type: 'custom',
                source: '2a19fc2d-54ac-4c2b-8c11-73ba56e0b7f3',
                target: 'dd95fe59-db52-4cd0-b69b-c07cb238e042',
                sourceHandle: null,
                targetHandle: 'in',
            },
            {
                id: 'reactflow__edge-dd95fe59-db52-4cd0-b69b-c07cb238e042no-d38305ae-4583-4e4e-afe3-4bb818fbd5d0',
                data: { is_visible: true },
                type: 'custom',
                source: 'dd95fe59-db52-4cd0-b69b-c07cb238e042',
                target: 'd38305ae-4583-4e4e-afe3-4bb818fbd5d0',
                sourceHandle: 'no',
                targetHandle: null,
            },
        ],
    },
};

const workingPayload = {
    description:
        'Este flujo REST permite la obtención de casos bot de finalización, validando una contingencia activa, cruzando información y aplicando filtros por (flags) y estado concluido.(rest_flow_list_close_cases_for_closing) (RF28)',
    is_active: true,
    is_primary: true,
    external_code: 'rest_flow_list_close_cases_for_closing',
    json_diagram_properties: {
        nodes: [
            {
                id: '0',
                data: { label: 'inicio' },
                type: 'input',
                width: 150,
                height: 40,
                dragging: false,
                position: { x: 225, y: 75 },
                selected: false,
                positionAbsolute: { x: 0, y: 0 },
            },
            {
                id: '260fbe8d-ccf7-4cfa-9f32-6f5971b2cbfb',
                data: {
                    id: 'a3c556b3-38d8-48b3-9150-5364a6e4508f',
                    type: 'endpoint',
                    label: 'Endpoint para filtrar y obtener la estrategia de contingencia  (estrategias_generales). (rest_flow_list_close_cases_for_closing)(RF28)',
                },
                style: { color: 'black', wordBreak: 'break-word', backgroundColor: 'rgb(232, 196, 104)' },
                width: 150,
                height: 148,
                dragging: false,
                position: { x: 225, y: 200 },
                selected: false,
                positionAbsolute: { x: 0, y: 0 },
            },
            {
                id: 'bf9d34d6-15e9-4f47-b18b-76c3a25d683c',
                data: {
                    id: '375f1820-5f2f-4a15-82ae-fb7c7e738eb2',
                    type: 'conditional',
                    label: 'Si estrategia_contingencia.data.items[0].data.activo_general_estrategia null',
                    value: '',
                    filter: 'estrategia_contingencia.data.items[0].data.activo_general_estrategia',
                    operator: 'null',
                    subflows: {
                        satisfied: '2fc0eee0-1bd7-45b0-8b68-028ab67c3e3a',
                        unsatisfied: 'bcff3cb0-d0ef-4cd0-a8d4-cf48cb357f0b',
                    },
                    conditionType: 'null',
                },
                type: 'conditional',
                style: { wordBreak: 'break-word' },
                width: 120,
                height: 120,
                dragging: false,
                position: { x: 493, y: 230 },
                selected: false,
                positionAbsolute: { x: 493, y: 230 },
            },
            {
                id: '37745711-184a-40f6-a938-4040b79f914a',
                data: {
                    id: '25d3f00e-a918-4ff8-bb79-9a5ba969bff2',
                    type: 'conditional',
                    label: 'Si functions.activo_contingencia.activo_general_estrategia = 1',
                    value: '1',
                    filter: 'functions.activo_contingencia.activo_general_estrategia',
                    operator: '=',
                    subflows: { unsatisfied: '308cc974-b139-4b03-aa6d-613322992982' },
                    conditionType: 'eq',
                },
                type: 'conditional',
                style: { wordBreak: 'break-word' },
                width: 120,
                height: 120,
                dragging: false,
                position: { x: 255, y: 474 },
                selected: false,
                positionAbsolute: { x: 255, y: 474 },
            },
            {
                id: '15cf20fc-f836-4cf5-867c-091252ebd80b',
                data: {
                    id: 'b4771432-7df9-4702-920a-267cb4c6cbac',
                    type: 'conditional',
                    label: 'Si list_close_cases_for_closing.data.items[0].caso_id null',
                    value: '',
                    filter: 'list_close_cases_for_closing.data.items[0].caso_id',
                    operator: 'null',
                    subflows: { unsatisfied: '05198fec-2a8f-42a0-83af-f340053067ac' },
                    conditionType: 'null',
                },
                type: 'conditional',
                style: { wordBreak: 'break-word' },
                width: 120,
                height: 120,
                dragging: false,
                position: { x: 266, y: 784 },
                selected: false,
                positionAbsolute: { x: 266, y: 784 },
            },
            {
                id: 'f617686b-11c2-47d8-a13d-a3841a0af8cf',
                data: {
                    id: '91b40115-5627-4c30-9bda-4c4451cae008',
                    type: 'conditional',
                    label: 'Si list_close_cases_for_closing.data.items[0].flag_numero_consumos < 2',
                    value: '2',
                    filter: 'list_close_cases_for_closing.data.items[0].flag_numero_consumos',
                    operator: '<',
                    subflows: {
                        satisfied: '62f15b5b-f081-4efa-bc8a-d36094295da5',
                        unsatisfied: '255c27b3-9783-43a4-b406-666033c4871c',
                    },
                    conditionType: 'lt',
                },
                type: 'conditional',
                style: { wordBreak: 'break-word' },
                width: 120,
                height: 120,
                dragging: false,
                position: { x: 236, y: 950 },
                selected: false,
                positionAbsolute: { x: 236, y: 950 },
            },
            {
                id: 'ed1ecd87-bae8-45bb-9721-b83e6645f7e9',
                data: {
                    id: '2bd92635-a9b4-493a-9d3b-2a39c02aa50a',
                    type: 'function',
                    label: 'Esta función formatea los valores booleanos extraídos de activo_contingencia y los convierte a valores numéricos para su uso en condicionales. (rest_flow_list_close_cases_for_closing)(RF28)',
                },
                style: { color: 'white', wordBreak: 'break-word', backgroundColor: 'rgb(231, 110, 80)' },
                width: 150,
                height: 184,
                dragging: false,
                position: { x: 527, y: 446 },
                selected: false,
                positionAbsolute: { x: 527, y: 446 },
            },
            {
                id: 'e771f067-4f06-4af2-a5ab-98079be159a7',
                data: {
                    id: '5671f102-f541-468c-be04-821ab156b68a',
                    type: 'endpoint',
                    label: 'Endpoint para filtrar casos con estado Concluido y CE Documentado. (rest_flow_list_close_cases_for_closing)(RF28)',
                },
                style: { color: 'black', wordBreak: 'break-word', backgroundColor: 'rgb(232, 196, 104)' },
                width: 150,
                height: 130,
                dragging: false,
                position: { x: 74, y: 565 },
                selected: false,
                positionAbsolute: { x: 74, y: 565 },
            },
            {
                id: 'e47c53c8-11d6-408f-b978-0c87d6c58331',
                data: {
                    id: 'dd9e36a7-971d-4c95-b7ef-55d121c0cb4a',
                    type: 'function',
                    label: 'format data bot finalizacion',
                },
                style: { color: 'white', wordBreak: 'break-word', backgroundColor: 'rgb(231, 110, 80)' },
                width: 150,
                height: 58,
                dragging: false,
                position: { x: 77, y: 728 },
                selected: false,
                positionAbsolute: { x: 77, y: 728 },
            },
            {
                id: '3ad3fe36-e477-41f8-8797-e678902070d0',
                data: { id: 'ecc14202-111f-47b1-9eae-4903933a3583', type: 'function', label: 'Fecha Actual (RF11)' },
                style: { color: 'white', wordBreak: 'break-word', backgroundColor: 'rgb(231, 110, 80)' },
                width: 150,
                height: 40,
                dragging: false,
                position: { x: 67, y: 867 },
                selected: false,
                positionAbsolute: { x: 67, y: 867 },
            },
            {
                id: '37adf554-716e-48e4-b1eb-bdd08f8588d6',
                data: {
                    id: '7b212c23-6f95-4cda-9814-3311862315e2',
                    type: 'function',
                    label: 'Autoincrementar los consumos satisfactorios hechos al bot_finalización (rest_flow_list_close_cases_for_closing)',
                },
                style: { color: 'white', wordBreak: 'break-word', backgroundColor: 'rgb(231, 110, 80)' },
                width: 150,
                height: 130,
                dragging: false,
                position: { x: 82, y: 1111 },
                selected: false,
                positionAbsolute: { x: 82, y: 1111 },
            },
            {
                id: 'bea11a91-2562-480c-80b4-772589130754',
                data: {
                    id: '26de3d33-6511-4b6c-9250-6147d5484e03',
                    type: 'function',
                    label: 'Extraer de list_close_cases_for_document el id del caso y ponerlo en primer nivel del json (rest_flow_list_close_cases_for_closing)',
                },
                style: { color: 'white', wordBreak: 'break-word', backgroundColor: 'rgb(231, 110, 80)' },
                width: 150,
                height: 148,
                dragging: false,
                position: { x: 343, y: 1126 },
                selected: false,
                positionAbsolute: { x: 343, y: 1126 },
            },
            {
                id: '01d32bcc-408b-465b-bf92-d7bf5c6194c5',
                data: {
                    id: 'e03b14c1-d75a-4a6c-a53d-fc4f4ea7cff7',
                    type: 'function',
                    label: 'Esta función obtiene el caso y lo ubica en el nivel principal del JSON. (rest_flow_list_close_cases_for_closing)(RF28)',
                },
                style: { color: 'white', wordBreak: 'break-word', backgroundColor: 'rgb(231, 110, 80)' },
                width: 150,
                height: 130,
                dragging: false,
                position: { x: 87, y: 1287 },
                selected: false,
                positionAbsolute: { x: 87, y: 1287 },
            },
            {
                id: '75ceb43d-af98-48bc-8ffe-794f52fcc332',
                data: {
                    id: '58073f6f-cccc-4c5c-b0d6-bd244be06333',
                    type: 'function',
                    label: 'Esta función obtiene la flag_numero_consumos y la pasa a string. (rest_flow_list_close_cases_for_closing)(RF28)',
                },
                style: { color: 'white', wordBreak: 'break-word', backgroundColor: 'rgb(231, 110, 80)' },
                width: 150,
                height: 112,
                dragging: false,
                position: { x: 357, y: 1305 },
                selected: false,
                positionAbsolute: { x: 357, y: 1305 },
            },
            {
                id: 'c70f1ca2-925c-428d-91e3-0761740b8bc9',
                data: {
                    id: 'cee1c04f-1894-465e-9390-0ab75e2177a9',
                    type: 'endpoint',
                    label: 'Endpoint para actualizar el indicador(FLAG) de aumento de consumos en el bot de finalización. (rest_flow_list_close_cases_for_closing)(RF28)',
                },
                style: { color: 'black', wordBreak: 'break-word', backgroundColor: 'rgb(232, 196, 104)' },
                width: 150,
                height: 166,
                dragging: false,
                position: { x: 95, y: 1445 },
                selected: false,
                positionAbsolute: { x: 95, y: 1445 },
            },
            {
                id: 'acf7ec6a-e41f-4698-95af-96cf1a3a4314',
                data: {
                    id: '9a38d731-6a59-48b1-ba9a-3794531dda2f',
                    type: 'endpoint',
                    label: 'Endpoint para actualizar el indicador(FLAG) si es mayor a 2 consumos (rest_flow_list_close_cases_for_closing)(RF28)',
                },
                style: { color: 'black', wordBreak: 'break-word', backgroundColor: 'rgb(232, 196, 104)' },
                width: 150,
                height: 130,
                dragging: false,
                position: { x: 352, y: 1462 },
                selected: false,
                positionAbsolute: { x: 352, y: 1462 },
            },
            {
                id: 'afdbd52b-360f-4d44-832a-498a9913ff0c',
                data: {
                    id: '9a38d731-6a59-48b1-ba9a-3794531dda2f',
                    type: 'endpoint',
                    label: 'Endpoint para actualizar el indicador(FLAG) si es mayor a 2 consumos (rest_flow_list_close_cases_for_closing)(RF28)',
                },
                style: { color: 'black', wordBreak: 'break-word', backgroundColor: 'rgb(232, 196, 104)' },
                width: 150,
                height: 130,
                dragging: false,
                position: { x: -73, y: 945 },
                selected: false,
                positionAbsolute: { x: -73, y: 945 },
            },
        ],
        edges: [
            {
                id: 'reactflow__edge-0-260fbe8d-ccf7-4cfa-9f32-6f5971b2cbfb',
                data: { is_visible: true },
                type: 'custom',
                source: '0',
                target: '260fbe8d-ccf7-4cfa-9f32-6f5971b2cbfb',
                zIndex: 0,
                selected: false,
                sourceHandle: null,
                targetHandle: null,
            },
            {
                id: 'reactflow__edge-260fbe8d-ccf7-4cfa-9f32-6f5971b2cbfb-bf9d34d6-15e9-4f47-b18b-76c3a25d683cin',
                data: { is_visible: true },
                type: 'custom',
                source: '260fbe8d-ccf7-4cfa-9f32-6f5971b2cbfb',
                target: 'bf9d34d6-15e9-4f47-b18b-76c3a25d683c',
                zIndex: 0,
                selected: false,
                sourceHandle: null,
                targetHandle: 'in',
            },
            {
                id: 'reactflow__edge-37745711-184a-40f6-a938-4040b79f914ano-e771f067-4f06-4af2-a5ab-98079be159a7',
                data: { is_visible: true },
                type: 'custom',
                source: '37745711-184a-40f6-a938-4040b79f914a',
                target: 'e771f067-4f06-4af2-a5ab-98079be159a7',
                zIndex: 0,
                selected: false,
                sourceHandle: 'no',
                targetHandle: null,
            },
            {
                id: 'reactflow__edge-15cf20fc-f836-4cf5-867c-091252ebd80bno-3ad3fe36-e477-41f8-8797-e678902070d0',
                data: { is_visible: true },
                type: 'custom',
                source: '15cf20fc-f836-4cf5-867c-091252ebd80b',
                target: '3ad3fe36-e477-41f8-8797-e678902070d0',
                zIndex: 0,
                selected: false,
                sourceHandle: 'no',
                targetHandle: null,
            },
            {
                id: 'reactflow__edge-f617686b-11c2-47d8-a13d-a3841a0af8cfno-afdbd52b-360f-4d44-832a-498a9913ff0c',
                data: { is_visible: true },
                type: 'custom',
                source: 'f617686b-11c2-47d8-a13d-a3841a0af8cf',
                target: 'afdbd52b-360f-4d44-832a-498a9913ff0c',
                zIndex: 0,
                selected: false,
                sourceHandle: 'no',
                targetHandle: null,
            },
            {
                id: 'reactflow__edge-f617686b-11c2-47d8-a13d-a3841a0af8cfyes-37adf554-716e-48e4-b1eb-bdd08f8588d6',
                data: { is_visible: true },
                type: 'custom',
                source: 'f617686b-11c2-47d8-a13d-a3841a0af8cf',
                target: '37adf554-716e-48e4-b1eb-bdd08f8588d6',
                zIndex: 0,
                selected: false,
                sourceHandle: 'yes',
                targetHandle: null,
            },
            {
                id: 'reactflow__edge-bf9d34d6-15e9-4f47-b18b-76c3a25d683cno-ed1ecd87-bae8-45bb-9721-b83e6645f7e9',
                data: { is_visible: true },
                type: 'custom',
                source: 'bf9d34d6-15e9-4f47-b18b-76c3a25d683c',
                target: 'ed1ecd87-bae8-45bb-9721-b83e6645f7e9',
                sourceHandle: 'no',
                targetHandle: null,
            },
            {
                id: 'reactflow__edge-ed1ecd87-bae8-45bb-9721-b83e6645f7e9-37745711-184a-40f6-a938-4040b79f914ain',
                data: { is_visible: true },
                type: 'custom',
                source: 'ed1ecd87-bae8-45bb-9721-b83e6645f7e9',
                target: '37745711-184a-40f6-a938-4040b79f914a',
                zIndex: 0,
                selected: false,
                sourceHandle: null,
                targetHandle: 'in',
            },
            {
                id: 'reactflow__edge-e771f067-4f06-4af2-a5ab-98079be159a7-e47c53c8-11d6-408f-b978-0c87d6c58331',
                data: { is_visible: true },
                type: 'custom',
                source: 'e771f067-4f06-4af2-a5ab-98079be159a7',
                target: 'e47c53c8-11d6-408f-b978-0c87d6c58331',
                zIndex: 0,
                selected: false,
                sourceHandle: null,
                targetHandle: null,
            },
            {
                id: 'reactflow__edge-e47c53c8-11d6-408f-b978-0c87d6c58331-15cf20fc-f836-4cf5-867c-091252ebd80bin',
                data: { is_visible: true },
                type: 'custom',
                source: 'e47c53c8-11d6-408f-b978-0c87d6c58331',
                target: '15cf20fc-f836-4cf5-867c-091252ebd80b',
                zIndex: 0,
                selected: false,
                sourceHandle: null,
                targetHandle: 'in',
            },
            {
                id: 'reactflow__edge-3ad3fe36-e477-41f8-8797-e678902070d0-f617686b-11c2-47d8-a13d-a3841a0af8cfin',
                data: { is_visible: true },
                type: 'custom',
                source: '3ad3fe36-e477-41f8-8797-e678902070d0',
                target: 'f617686b-11c2-47d8-a13d-a3841a0af8cf',
                zIndex: 0,
                selected: false,
                sourceHandle: null,
                targetHandle: 'in',
            },
            {
                id: 'reactflow__edge-37adf554-716e-48e4-b1eb-bdd08f8588d6-bea11a91-2562-480c-80b4-772589130754',
                data: { is_visible: true },
                type: 'custom',
                source: '37adf554-716e-48e4-b1eb-bdd08f8588d6',
                target: 'bea11a91-2562-480c-80b4-772589130754',
                zIndex: 0,
                selected: false,
                sourceHandle: null,
                targetHandle: null,
            },
            {
                id: 'reactflow__edge-bea11a91-2562-480c-80b4-772589130754-01d32bcc-408b-465b-bf92-d7bf5c6194c5',
                data: { is_visible: true },
                type: 'custom',
                source: 'bea11a91-2562-480c-80b4-772589130754',
                target: '01d32bcc-408b-465b-bf92-d7bf5c6194c5',
                zIndex: 0,
                selected: false,
                sourceHandle: null,
                targetHandle: null,
            },
        ],
    },
};

describe('WSRestFlowUpdater - real user payloads regression', () => {
    const repository = new KnexWSRestFlowRepository(knexConfig);
    const stepRepository = new KnexWSRestWorkflowStepRepository(repository.connection);

    beforeEach(async () => {
        jest.spyOn(WSRestConditionalCreator.prototype, 'execute').mockResolvedValue(undefined);
        jest.spyOn(WSRestConditionalUpdater.prototype, 'execute').mockResolvedValue(undefined);
        jest.spyOn(WSRestConditionalFinder.prototype, 'execute').mockResolvedValue(null);
        jest.spyOn(WSRestFlowStepManager.prototype, 'createStepsForFlows').mockResolvedValue(undefined);
        jest.spyOn(WSRestFlowStepManager.prototype, 'updateStepsForFlows').mockResolvedValue(undefined);
        jest.spyOn(WSRestFlowStepManager.prototype, 'deleteStepsForFlow').mockResolvedValue(undefined);
        jest.spyOn(EventLogger.prototype, 'log').mockResolvedValue(undefined);

        jest.spyOn(Helper, 'logError').mockImplementation((message, error) => {
            // eslint-disable-next-line no-console
            console.error('[Helper.logError]', message, error?.message ?? error, error?.stack ?? '');
        });
    });

    afterEach(async () => {
        jest.restoreAllMocks();
    });

    const seedFlow = async ({ description, external_code, json_diagram_properties }) => {
        const flowId = uuid();
        await WSRestFlowMother.create(repository, {
            id: flowId,
            description,
            external_code,
            json_diagram_properties,
        });
        return flowId;
    };

    const runUpdate = async (flowId, payload) => {
        const updater = new WSRestFlowUpdater(repository, stepRepository);
        const dto = { ...payload, updated_by: uuid(), updated_at: new Date().toISOString() };
        try {
            await updater.execute(flowId, dto);
            return null;
        } catch (error) {
            return error;
        }
    };

    const logError = (label, error) => {
        // eslint-disable-next-line no-console
        console.error(`\n=== ${label} ===`);
        // eslint-disable-next-line no-console
        console.error('name:', error?.name);
        // eslint-disable-next-line no-console
        console.error('message:', error?.message);
        // eslint-disable-next-line no-console
        console.error('code:', error?.code);
        // eslint-disable-next-line no-console
        console.error('stack:', error?.stack);
        // eslint-disable-next-line no-console
        console.error('=== END ===\n');
    };

    it('failing payload: single update against minimal seed', async () => {
        const flowId = await seedFlow({
            description: failingPayload.description,
            external_code: failingPayload.external_code,
        });
        const error = await runUpdate(flowId, failingPayload);
        if (error) logError('FAILING PAYLOAD - SINGLE UPDATE', error);
        expect(error).toBeNull();
    });

    it('failing payload: re-update flow that already has the same diagram', async () => {
        const flowId = await seedFlow({
            description: failingPayload.description,
            external_code: failingPayload.external_code,
            json_diagram_properties: failingPayload.json_diagram_properties,
        });
        const error = await runUpdate(flowId, failingPayload);
        if (error) logError('FAILING PAYLOAD - RE-UPDATE', error);
        expect(error).toBeNull();
    });

    it('working payload: single update against minimal seed', async () => {
        const flowId = await seedFlow({
            description: workingPayload.description,
            external_code: workingPayload.external_code,
        });
        const error = await runUpdate(flowId, workingPayload);
        if (error) logError('WORKING PAYLOAD - SINGLE UPDATE', error);
        expect(error).toBeNull();
    });

    it('failing payload: soft-deleted subflow referenced by parent diagram is restored, not duplicated', async () => {
        const flowId = await seedFlow({
            description: failingPayload.description,
            external_code: failingPayload.external_code,
            json_diagram_properties: failingPayload.json_diagram_properties,
        });

        const conditionalNodes = (failingPayload.json_diagram_properties.nodes || []).filter(
            (n) => n?.data?.type === 'conditional' && n.data.subflows
        );
        const referencedSubflowIds = conditionalNodes.flatMap((n) => Object.values(n.data.subflows || {}));
        expect(referencedSubflowIds.length).toBeGreaterThan(0);

        for (const subflowId of referencedSubflowIds) {
            await repository.connection('ws_rest_flows').insert({
                id: subflowId,
                description: `seeded soft-deleted subflow ${subflowId}`,
                external_code: `seeded_sd_${subflowId}`,
                json_diagram_properties: JSON.stringify({
                    nodes: [{ id: uuid(), data: { label: 'placeholder' } }],
                    edges: [],
                }),
                is_primary: false,
                is_active: false,
                created_at: new Date().toISOString(),
                created_by: uuid(),
                deleted_at: new Date().toISOString(),
                deleted_by: uuid(),
            });
        }

        const error = await runUpdate(flowId, failingPayload);
        if (error) logError('FAILING PAYLOAD - SOFT-DELETED SUBFLOW', error);
        expect(error).toBeNull();

        const restoredRows = await repository
            .connection('ws_rest_flows')
            .whereIn('id', referencedSubflowIds)
            .whereNull('deleted_at');
        expect(restoredRows.length).toBeGreaterThan(0);
    });
});

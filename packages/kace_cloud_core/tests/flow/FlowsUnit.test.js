import { v4 as uuidv4 } from 'uuid';
import { Flow, FlowCollectionResponse, FlowResponse, ValueObjectJsonFlow } from '../../src/flow';
import { DeleteFieldsDoNotExistError, StatusEnum } from '../../src/shared/index.js';
import FlowsMother from './domain/FlowsMother';

describe('Flows test', () => {
    it('should return a flow instance', () => {
        const dto = FlowsMother.dto();
        const flow = Flow.create(dto);

        expect(flow).toBeInstanceOf(Flow);
        expect(flow.id.value).toEqual(dto.id);
        expect(flow.nombre.value).toEqual(dto.nombre);
        expect(flow.status.value).toEqual(dto.status);
        expect(flow.created_at.value).toEqual(dto.created_at);
        expect(flow.created_by.value).toEqual(dto.created_by);
    });

    it('should update a flow', () => {
        const dto = FlowsMother.dto();
        const flow = new Flow(dto);

        const updateDto = {
            nombre: 'Nombre actualizado',
            status: StatusEnum.ACTIVE.value,
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };

        flow.update(updateDto);

        expect(flow).toBeInstanceOf(Flow);
        expect(flow.nombre.value).toEqual(updateDto.nombre);
        expect(flow.status.value).toEqual(updateDto.status);
        expect(flow.updated_at.value).toEqual(updateDto.updated_at);
        expect(flow.updated_by.value).toEqual(updateDto.updated_by);
    });

    it('does not update properties when values are the same', () => {
        const dto = FlowsMother.dto();
        const flow = Flow.create(dto);

        flow.update(dto);

        expect(flow.changedAttributes).toEqual({});
    });

    it('marks a flow instance as deleted', () => {
        const dto = FlowsMother.dto();
        const flow = Flow.create(dto);
        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };
        flow.delete(deleteDto);

        expect(flow.deleted_at.value).toEqual(deleteDto.deleted_at);
        expect(flow.deleted_by.value).toEqual(deleteDto.deleted_by);
    });

    it('should throw a error if deleted fields are empty', () => {
        const dto = FlowsMother.dto();
        const flow = Flow.create(dto);
        const deleteDto = {};

        expect(() => flow.delete(deleteDto)).toThrow(DeleteFieldsDoNotExistError);
    });

    it('flushes changes in Flow instance', () => {
        const dto = FlowsMother.dto();
        const flow = Flow.create(dto);
        const updateDto = {
            status: StatusEnum.INACTIVE.value,
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        flow.update(updateDto);
        flow.flushChanges();

        expect(flow.changedAttributes).toEqual({});
    });
});

describe('Flow Responses Tests', () => {
    it('converts Flows object to JSON representation', () => {
        const flow = new Flow(FlowsMother.randomDto());
        const flowResponse = new FlowResponse(flow);

        const json = flowResponse.toJson();

        expect(json).toMatchObject({
            data: {
                id: flow.id.value,
                nombre: flow.nombre.value,
                json_flujo: expect.any(Object),
                status: flow.status.value,
                created_at: flow.created_at.value,
                updated_at: flow.updated_at.value,
                created_by: flow.created_by.value,
                updated_by: flow.updated_by.value,
                deleted_at: flow.deleted_at.value,
                deleted_by: flow.deleted_by.value,
            },
        });
    });

    it('converts flow collection object to JSON representation', () => {
        const flow = [new Flow(FlowsMother.randomDto()), new Flow(FlowsMother.randomDto())];
        const flowCollectionResponse = new FlowCollectionResponse(flow, flow.length);

        const json = flowCollectionResponse.toJson();

        expect(json).toEqual({
            data: {
                items: flow.map((flow) => new FlowResponse(flow).toJson().data),
            },
            metadata: {
                count: flow.length,
            },
        });
    });

    it('return an empty object if flow is null', () => {
        const flowResponse = new FlowResponse(null);

        const json = flowResponse.toJson();

        expect(json).toMatchObject({});
    });

    it('converts Flow search collection object to JSON representation', () => {
        const flow = [new Flow(FlowsMother.randomDto()), new Flow(FlowsMother.randomDto())];
        const flowCollectionSearchReponse = new FlowCollectionResponse(flow, flow.length);

        const json = flowCollectionSearchReponse.toJson();

        expect(json).toEqual({
            data: {
                items: flow.map((flow) => new FlowResponse(flow).toJson().data),
            },
            metadata: {
                count: flow.length,
            },
        });
    });
});

describe('ValueObjectJsonFlow validation', () => {
    const baseFlow = JSON.parse(
        '{"nodes":[{"id":"0","type":"input","position":{"x":324,"y":45.55998535156249},"data":{"label":"inicio"},"selected":false,"positionAbsolute":{"x":324,"y":45.55998535156249},"dragging":false,"width":150,"height":40},{"id":"786ba89c-ad4c-44c6-8284-214a32536868","position":{"x":339.23995645937714,"y":139.67725671038437},"type":"custom","data":{"label":"RADICADO"},"selected":false,"positionAbsolute":{"x":339.23995645937714,"y":139.67725671038437},"dragging":false,"style":{"background":"rgba(208, 192, 247, 0.5)","color":"#A100C2","fontWeight":"bold","border":"2px solid #A100C2"},"width":3,"height":3},{"id":"2f6cbaeb-5106-4e92-8a71-90cab7c1123e","position":{"x":319.33328283475805,"y":390.619530478436},"type":"custom","data":{"label":"FINALIZADO"},"selected":true,"positionAbsolute":{"x":319.33328283475805,"y":390.619530478436},"dragging":false,"style":{"background":"rgba(208, 192, 247, 0.5)","color":"#A100C2","fontWeight":"bold","border":"2px solid #A100C2"},"width":3,"height":3},{"id":"f0752d1b-8032-4e8f-a3eb-f90030682af8","position":{"x":211.65170010757458,"y":243.67725671038443},"type":"custom","data":{"label":"TRAMITE"},"selected":false,"positionAbsolute":{"x":211.65170010757458,"y":243.67725671038443},"dragging":false,"style":{"background":"rgba(208, 192, 247, 0.5)","color":"#A100C2","fontWeight":"bold","border":"2px solid #A100C2"},"width":3,"height":3}],"edges":[{"source":"0","sourceHandle":null,"target":"786ba89c-ad4c-44c6-8284-214a32536868","targetHandle":"top","id":"reactflow__edge-0-786ba89c-ad4c-44c6-8284-214a32536868top","transition_existed":false,"kace_transition":"5fe12dcc-992e-49db-9299-a0a6d696b644"},{"source":"786ba89c-ad4c-44c6-8284-214a32536868","sourceHandle":"bottom","target":"2f6cbaeb-5106-4e92-8a71-90cab7c1123e","targetHandle":"top","id":"reactflow__edge-786ba89c-ad4c-44c6-8284-214a32536868bottom-2f6cbaeb-5106-4e92-8a71-90cab7c1123etop","transition_existed":false,"kace_transition":"d6357177-8290-4e9d-a74e-9dc173262a58"},{"source":"786ba89c-ad4c-44c6-8284-214a32536868","sourceHandle":"bottom","target":"f0752d1b-8032-4e8f-a3eb-f90030682af8","targetHandle":"top","id":"reactflow__edge-786ba89c-ad4c-44c6-8284-214a32536868bottom-f0752d1b-8032-4e8f-a3eb-f90030682af8top","transition_existed":false,"kace_transition":"dd6a2b51-291e-45d5-9af3-380aa2dea272"},{"source":"f0752d1b-8032-4e8f-a3eb-f90030682af8","sourceHandle":"bottom","target":"2f6cbaeb-5106-4e92-8a71-90cab7c1123e","targetHandle":"top","id":"reactflow__edge-f0752d1b-8032-4e8f-a3eb-f90030682af8bottom-2f6cbaeb-5106-4e92-8a71-90cab7c1123etop","transition_existed":false,"kace_transition":"98a6475c-4f31-4aff-a03e-6f4f9807fdf5"}]}'
    );

    it('should create a valid ValueObjectJsonFlow', () => {
        const vo = new ValueObjectJsonFlow('json_flujo', baseFlow);
        expect(vo).toBeInstanceOf(ValueObjectJsonFlow);
    });

    it('should throw error if nodes is missing', () => {
        const invalidFlow = { ...baseFlow };
        delete invalidFlow.nodes;

        expect(() => new ValueObjectJsonFlow('json_flujo', invalidFlow)).toThrow(
            "El flujo debe contener una propiedad 'nodes' como array."
        );
    });

    it('should throw error if a node is not an object', () => {
        const invalidFlow = {
            ...baseFlow,
            nodes: [null],
        };

        expect(() => new ValueObjectJsonFlow('json_flujo', invalidFlow)).toThrow(
            /Nodo en posición 0 debe ser un objeto válido/
        );
    });

    it('should throw error if edge is missing required fields', () => {
        const invalidFlow = {
            ...baseFlow,
            edges: [{ id: null, source: '', target: '' }],
        };

        expect(() => new ValueObjectJsonFlow('json_flujo', invalidFlow)).toThrow(/source/);
    });

    it('should create a valid ValueObjectJsonFlow with a complex flow', () => {
        const vo = new ValueObjectJsonFlow('json_flujo', baseFlow);
        expect(vo).toBeInstanceOf(ValueObjectJsonFlow);
    });

    it('should accept null in sourceHandle and targetHandle', () => {
        const edge = baseFlow.edges[0];
        expect(edge.sourceHandle).toBeNull();
        expect(() => new ValueObjectJsonFlow('json_flujo', baseFlow)).not.toThrow();
    });

    it('should validate all node labels, even with uppercase and spaces', () => {
        const labels = baseFlow.nodes.map((n) => n.data.label);
        labels.forEach((label) => {
            expect(typeof label).toBe('string');
        });
    });

    it('should allow small width and height values', () => {
        baseFlow.nodes.forEach((node) => {
            expect(typeof node.width).toBe('number');
            expect(typeof node.height).toBe('number');
            expect(node.width).toBeGreaterThanOrEqual(0);
            expect(node.height).toBeGreaterThanOrEqual(0);
        });
    });

    it('should support true/false in selected property of nodes', () => {
        const selectedValues = baseFlow.nodes.map((n) => n.selected);
        expect(selectedValues).toContain(true);
        expect(selectedValues).toContain(false);
    });

    it('should ignore additional properties like "style"', () => {
        expect(baseFlow.nodes[1]).toHaveProperty('style');
        expect(() => new ValueObjectJsonFlow('json_flujo', baseFlow)).not.toThrow();
        expect(new ValueObjectJsonFlow('json_flujo', baseFlow).value).toEqual(baseFlow);
    });

    it('should have properties ans_id, label, transition_existed, type', () => {
        const jsonFlow = {
            edges: [
                {
                    id: 'reactflow__edge-0-53b57043-a3ba-4fea-a7f0-4e2f489bb9cftop',
                    source: '0',
                    target: '53b57043-a3ba-4fea-a7f0-4e2f489bb9cf',
                    sourceHandle: null,
                    targetHandle: 'top',
                    kace_transition: 'c9d8e74c-340a-4835-a2f1-bc69a2f6c64c',
                    ans_id: '60c24aa1-4544-46ac-a49f-acac7a280141',
                    label: 'ANS TRES',
                    transition_existed: false,
                    type: 'custom',
                },
            ],
            nodes: [
                {
                    id: '0',
                    data: { label: 'inicio' },
                    type: 'input',
                    width: 150,
                    height: 41,
                    dragging: false,
                    position: { x: 300, y: 0 },
                    selected: false,
                    positionAbsolute: { x: 0, y: 0 },
                },
                {
                    id: '53b57043-a3ba-4fea-a7f0-4e2f489bb9cf',
                    data: { label: 'daflohul' },
                    type: 'custom',
                    width: 3,
                    height: 3,
                    dragging: false,
                    position: { x: 130.75, y: 132.54998779296875 },
                    selected: false,
                    positionAbsolute: { x: 0, y: 0 },
                    style: {
                        color: '#A100C2',
                        border: '2px solid #A100C2',
                        background: 'rgba(208, 192, 247, 0.5)',
                        fontWeight: 'bold',
                    },
                },
            ],
        };

        const VOJsonFlow = new ValueObjectJsonFlow('json_flujo', jsonFlow);

        expect(VOJsonFlow.value.edges[0]).toHaveProperty('ans_id');
        expect(VOJsonFlow.value.edges[0]).toHaveProperty('label');
        expect(VOJsonFlow.value.edges[0]).toHaveProperty('transition_existed');
        expect(VOJsonFlow.value.edges[0]).toHaveProperty('type');
    });
    it('should preserve data.is_visible property in edges', () => {
        const jsonFlow = {
            edges: [
                {
                    id: 'reactflow__edge-0-bbc1a08f-bc1d-474d-9023-45045873bae9top',
                    source: '0',
                    target: 'bbc1a08f-bc1d-474d-9023-45045873bae9',
                    sourceHandle: null,
                    targetHandle: 'top',
                    kace_transition: '6613e79f-52b8-43b7-a8dd-0d267c872499',
                    ans_id: '35d6c643-913e-4e4a-8759-4e4a7dde7619',
                    label: 'ANS uno prueba',
                    transition_existed: true,
                    type: 'custom',
                    data: {
                        is_visible: true,
                    },
                },
                {
                    id: 'reactflow__edge-1-test',
                    source: '0',
                    target: 'test-node',
                    sourceHandle: null,
                    targetHandle: 'top',
                    kace_transition: '7713e79f-52b8-43b7-a8dd-0d267c872499',
                    ans_id: '45d6c643-913e-4e4a-8759-4e4a7dde7619',
                    label: 'ANS dos prueba',
                    transition_existed: false,
                    type: 'custom',
                    data: {
                        is_visible: false,
                    },
                },
            ],
            nodes: [
                {
                    id: '0',
                    data: { label: 'inicio' },
                    type: 'input',
                    width: 150,
                    height: 41,
                    dragging: false,
                    position: { x: 300, y: 0 },
                    selected: false,
                    positionAbsolute: { x: 0, y: 0 },
                },
                {
                    id: 'bbc1a08f-bc1d-474d-9023-45045873bae9',
                    data: { label: 'Estado Uno' },
                    type: 'custom',
                    width: 3,
                    height: 3,
                    dragging: false,
                    position: { x: 130.75, y: 132.54998779296875 },
                    selected: false,
                    positionAbsolute: { x: 0, y: 0 },
                },
                {
                    id: 'test-node',
                    data: { label: 'Estado Dos' },
                    type: 'custom',
                    width: 3,
                    height: 3,
                    dragging: false,
                    position: { x: 230.75, y: 232.54998779296875 },
                    selected: false,
                    positionAbsolute: { x: 0, y: 0 },
                },
            ],
        };

        const VOJsonFlow = new ValueObjectJsonFlow('json_flujo', jsonFlow);

        expect(VOJsonFlow.value.edges[0]).toHaveProperty('data');
        expect(VOJsonFlow.value.edges[0].data).toHaveProperty('is_visible');
        expect(VOJsonFlow.value.edges[0].data.is_visible).toBe(true);

        expect(VOJsonFlow.value.edges[1]).toHaveProperty('data');
        expect(VOJsonFlow.value.edges[1].data).toHaveProperty('is_visible');
        expect(VOJsonFlow.value.edges[1].data.is_visible).toBe(false);
    });

    it('should accept edges without data property', () => {
        const jsonFlow = {
            edges: [
                {
                    id: 'reactflow__edge-0-test',
                    source: '0',
                    target: 'test-node',
                    sourceHandle: null,
                    targetHandle: 'top',
                    kace_transition: '6613e79f-52b8-43b7-a8dd-0d267c872499',
                    ans_id: '35d6c643-913e-4e4a-8759-4e4a7dde7619',
                    label: 'Sin data',
                    transition_existed: true,
                    type: 'custom',
                },
            ],
            nodes: [
                {
                    id: '0',
                    data: { label: 'inicio' },
                    type: 'input',
                    width: 150,
                    height: 41,
                    dragging: false,
                    position: { x: 300, y: 0 },
                    selected: false,
                    positionAbsolute: { x: 0, y: 0 },
                },
                {
                    id: 'test-node',
                    data: { label: 'Estado' },
                    type: 'custom',
                    width: 3,
                    height: 3,
                    dragging: false,
                    position: { x: 130.75, y: 132.54998779296875 },
                    selected: false,
                    positionAbsolute: { x: 0, y: 0 },
                },
            ],
        };

        expect(() => new ValueObjectJsonFlow('json_flujo', jsonFlow)).not.toThrow();
        const VOJsonFlow = new ValueObjectJsonFlow('json_flujo', jsonFlow);
        expect(VOJsonFlow.value.edges[0].data).toBeUndefined();
    });
});

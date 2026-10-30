import { chance, Factory, uuidv4 } from './Factory.js';
import { Flow, KnexFlowRepository } from '../flow/index.js';
import { Helper } from '../shared/infrastructure/utils/Helper.js';

export class FlowFactory extends Factory {
    /**
     * @param {*} knexConfig - instancia de knex
     */
    constructor(knexConfig) {
        super(KnexFlowRepository, Flow, {}, knexConfig);

        this.define({
            id: () => uuidv4(),
            nombre: () => chance.word({ length: 10 }),
            json_flujo: JSON.parse(
                `{"edges":[{"id":"reactflow__edge-0-ba209c41-9311-4482-9c57-2398a0d1296a","source":"0","target":"ba209c41-9311-4482-9c57-2398a0d1296a","sourceHandle":null,"targetHandle":null},{"id":"reactflow__edge-0-b2c44291-18c4-4af2-9888-a7ddb0430b66","source":"0","target":"b2c44291-18c4-4af2-9888-a7ddb0430b66","sourceHandle":null,"targetHandle":null},{"id":"reactflow__edge-b2c44291-18c4-4af2-9888-a7ddb0430b66-5d51b141-1967-4fcb-ad8a-061c0b884f87","source":"b2c44291-18c4-4af2-9888-a7ddb0430b66","target":"5d51b141-1967-4fcb-ad8a-061c0b884f87","sourceHandle":null,"targetHandle":null},{"id":"reactflow__edge-ba209c41-9311-4482-9c57-2398a0d1296a-5d51b141-1967-4fcb-ad8a-061c0b884f87","source":"ba209c41-9311-4482-9c57-2398a0d1296a","target":"5d51b141-1967-4fcb-ad8a-061c0b884f87","sourceHandle":null,"targetHandle":null},{"id":"reactflow__edge-0-5d51b141-1967-4fcb-ad8a-061c0b884f87","source":"0","target":"5d51b141-1967-4fcb-ad8a-061c0b884f87","sourceHandle":null,"targetHandle":null}],"nodes":[{"id":"0","data":{"label":"inicio"},"type":"input","width":150,"height":40,"dragging":false,"position":{"x":300,"y":0},"selected":false,"positionAbsolute":{"x":0,"y":0}},{"id":"ba209c41-9311-4482-9c57-2398a0d1296a","data":{"label":"Radicado"},"style":{"color":"#A100C2","border":"2px solid #A100C2","background":"rgba(208, 192, 247, 0.5)","fontWeight":"bold"},"width":150,"height":41,"dragging":false,"position":{"x":175,"y":74},"selected":false,"positionAbsolute":{"x":175,"y":74}},{"id":"b2c44291-18c4-4af2-9888-a7ddb0430b66","data":{"label":"En Trámite"},"style":{"color":"#A100C2","border":"2px solid #A100C2","background":"rgba(208, 192, 247, 0.5)","fontWeight":"bold"},"width":150,"height":41,"dragging":false,"position":{"x":444,"y":126},"selected":false,"positionAbsolute":{"x":444,"y":126}},{"id":"5d51b141-1967-4fcb-ad8a-061c0b884f87","data":{"label":"Finalizado"},"style":{"color":"#A100C2","border":"2px solid #A100C2","background":"rgba(208, 192, 247, 0.5)","fontWeight":"bold"},"width":150,"height":41,"dragging":false,"position":{"x":333,"y":234},"selected":false,"positionAbsolute":{"x":333,"y":234}},{"id":"0","data":{"label":"inicio"},"type":"input","width":150,"height":40,"dragging":false,"position":{"x":300,"y":0},"selected":false,"positionAbsolute":{"x":0,"y":0}},{"id":"ba209c41-9311-4482-9c57-2398a0d1296a","data":{"label":"Radicado"},"style":{"color":"#A100C2","border":"2px solid #A100C2","background":"rgba(208, 192, 247, 0.5)","fontWeight":"bold"},"width":150,"height":41,"dragging":false,"position":{"x":175,"y":74},"selected":false,"positionAbsolute":{"x":175,"y":74}},{"id":"b2c44291-18c4-4af2-9888-a7ddb0430b66","data":{"label":"En Trámite"},"style":{"color":"#A100C2","border":"2px solid #A100C2","background":"rgba(208, 192, 247, 0.5)","fontWeight":"bold"},"width":150,"height":41,"dragging":false,"position":{"x":444,"y":126},"selected":false,"positionAbsolute":{"x":444,"y":126}},{"id":"5d51b141-1967-4fcb-ad8a-061c0b884f87","data":{"label":"Finalizado"},"style":{"color":"#A100C2","border":"2px solid #A100C2","background":"rgba(208, 192, 247, 0.5)","fontWeight":"bold"},"width":150,"height":41,"dragging":false,"position":{"x":333,"y":234},"selected":false,"positionAbsolute":{"x":333,"y":234}}]}`
            ),
            status: chance.pickone([1, 2]),
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        })
            .afterMaking((flow) => {
                Helper.logInfo(`Flow made with id: ${flow.id.value}`);
            })
            .afterCreating((flow) => {
                Helper.logInfo(`Flow created with id: ${flow.id.value}`);
            });
    }
}

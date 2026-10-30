import { Aggregates } from '../../domain/Aggregates.js';

export class AggregateLister {
    execute() {
        return [Aggregates.CLIENTES, Aggregates.CASOS, Aggregates.AUX_CASE, Aggregates.AUX_CLIENT];
    }
}

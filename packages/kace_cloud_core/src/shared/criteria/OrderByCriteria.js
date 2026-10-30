import { ValueObjectString } from '../domain/value-object/ValueObjectString';
import { OrderByDirection } from './OrderByDirection';

export class OrderByCriteria {
    constructor(order) {
        this.orders = [];

        if (Array.isArray(order)) {
            order.forEach((o) => {
                const field = o.entity ? `${o.entity}.${o.field}` : o.field;
                this.orders.push({
                    field: new ValueObjectString('field', field),
                    direction: new OrderByDirection(o.direction),
                    insensitive: !!o.insensitive,
                    data_type: o.data_type ?? null,
                });
            });
        } else {
            const field = order.entity ? `${order.entity}.${order.field}` : order.field;
            this.orders.push({
                field: new ValueObjectString('field', field),
                direction: new OrderByDirection(order.direction),
                insensitive: !!order.insensitive,
                data_type: order.data_type ?? null,
            });
        }

        if (this.orders.length > 0) {
            this.field = this.orders[0].field;
            this.direction = this.orders[0].direction;
            this.insensitive = this.orders[0].insensitive;
            this.data_type = this.orders[0].data_type ?? null;
        }
    }

    toJson() {
        if (this.orders.length === 1) {
            const data = {};
            if (this.field) {
                data[this.field.value] = this.direction.value;
            }
            return data;
        }

        return this.orders.map((order) => ({
            field: order.field.value,
            direction: order.direction.value,
            insensitive: order.insensitive,
            data_type: order.data_type,
        }));
    }
}

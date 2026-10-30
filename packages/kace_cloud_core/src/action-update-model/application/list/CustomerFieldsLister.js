import { CustomerFields } from '../../domain/CustomerFields.js';

export class CustomerFieldsLister {
    execute() {
        const fields = CustomerFields.toJson();

        return Object.entries(fields).map(([key, value]) => ({
            key: key,
            value: value,
        }));
    }
}

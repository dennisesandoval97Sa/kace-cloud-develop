import { CaseFields } from '../../domain/CaseFields.js';

export class CaseFieldsLister {
    execute() {
        const fields = CaseFields.toJson();

        return Object.entries(fields).map(([key, value]) => ({
            key: key,
            value: value,
        }));
    }
}

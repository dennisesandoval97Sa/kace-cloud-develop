export class OperationsEnum {
    static CRUD = new OperationsEnum('CRUD', 'crud');
    static CREATE = new OperationsEnum('CREATE', 'create');
    static READ = new OperationsEnum('READ', 'read');
    static UPDATE = new OperationsEnum('UPDATE', 'update');
    static DELETE = new OperationsEnum('DELETE', 'delete');

    constructor(key, value) {
        this.#ensureIsValidAction(value);

        this.key = key;
        this.value = value;
        Object.freeze(this);
    }

    #ensureIsValidAction(value) {
        if (!value) throw new Error(`Invalid value: ${value}`);
    }

    static fromValue(value) {
        if (value === 'crud') return OperationsEnum.CRUD;
        if (value === 'create') return OperationsEnum.CREATE;
        if (value === 'read') return OperationsEnum.READ;
        if (value === 'update') return OperationsEnum.UPDATE;
        if (value === 'delete') return OperationsEnum.DELETE;
        throw new Error(`Invalid value: ${value}`);
    }

    static toJson() {
        return {
            CRUD: OperationsEnum.CRUD.value,
            CREATE: OperationsEnum.CREATE.value,
            READ: OperationsEnum.READ.value,
            UPDATE: OperationsEnum.UPDATE.value,
            DELETE: OperationsEnum.DELETE.value,
        };
    }
}

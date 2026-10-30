import { AggregateRoot } from '../../shared';
import { ValueObjectActions } from './ValueObjectActions';
import { ValueObjectEffect } from './ValueObjectEffect';
import { ValueObjectOperations } from './ValueObjectOperations';
import { ValueObjectProvider } from './ValueObjectProvider';
import { ValueObjectTitle } from './ValueObjectTitle';

export class Policy extends AggregateRoot {
    /** @type {ValueObjectTitle} is initialized in the constructor */
    #title;
    /** @type {ValueObjectProvider} is initialized in the constructor */
    #provider;
    /** @type {ValueObjectEffect} is initialized in the constructor */
    #effect;
    /** @type {ValueObjectOperations} is initialized in the constructor */
    #operations;
    /** @type {ValueObjectActions} is initialized in the constructor */
    #actions;
    constructor(dto) {
        super(dto.id);
        this.#title = new ValueObjectTitle('title', dto.title ?? 'default');
        this.#provider = new ValueObjectProvider('provider', dto.provider);
        this.#effect = new ValueObjectEffect('effect', dto.effect);
        this.#operations = new ValueObjectOperations('operations', dto.operations);
        this.#actions = new ValueObjectActions('actions', dto.actions);
        this.created_at = dto.created_at;
        this.created_by = dto.created_by;
        this.updated_at = dto.updated_at;
        this.updated_by = dto.updated_by;
        this.deleted_at = dto.deleted_at;
        this.deleted_by = dto.deleted_by;
    }

    static create(dto) {
        return new Policy(dto);
    }

    get title() {
        return this.#title;
    }

    set title(value) {
        this.#title = new ValueObjectTitle('title', value);
        this.changedAttributes.title = value;
    }

    get provider() {
        return this.#provider;
    }

    set provider(value) {
        this.#provider = new ValueObjectProvider('provider', value);
        this.changedAttributes.provider = value;
    }

    get effect() {
        return this.#effect;
    }

    set effect(value) {
        this.#effect = new ValueObjectEffect('effect', value);
        this.changedAttributes.effect = value;
    }

    get operations() {
        return this.#operations;
    }

    set operations(value) {
        this.#operations = new ValueObjectOperations('operations', value);
        this.changedAttributes.operations = JSON.stringify(this.#operations.value);
    }

    get actions() {
        return this.#actions;
    }

    set actions(value) {
        this.#actions = new ValueObjectActions('actions', value);
        this.changedAttributes.actions = JSON.stringify(this.#actions.value);
    }
}

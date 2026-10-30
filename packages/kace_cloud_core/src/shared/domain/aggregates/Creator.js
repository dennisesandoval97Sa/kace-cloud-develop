import { AggregateRoot } from '../AggregateRoot.js';
import VOName from '../value-objects/VOName.js';

export default class Creator extends AggregateRoot {
    /** @type {VOName} is initialized in the constructor */
    #nombres;
    /** @type {VOName} is initialized in the constructor */
    #apellido1;
    /** @type {VOName} is initialized in the constructor */
    #apellido2;

    constructor(dto) {
        super(dto.id);
        // SONAR-EXC: Se deja el TODO ya que es deuda tecnica que se resolverá a futuro
        // TODO: Remplazar con ValueObjectUserName del Dominio de Users (Promoverlo a shared)
        this.#nombres = new VOName('nombres', dto.nombres);
        this.#apellido1 = new VOName('apellido1', dto.apellido1, true);
        this.#apellido2 = new VOName('apellido2', dto.apellido2, true);
    }

    get nombres() {
        return this.#nombres;
    }

    set nombres(value) {
        this.#nombres = new VOName('nombres', value);
    }

    get apellido1() {
        return this.#apellido1;
    }

    set apellido1(value) {
        this.#apellido1 = new VOName('apellido1', value);
    }

    get apellido2() {
        return this.#apellido2;
    }

    set apellido2(value) {
        this.#apellido2 = new VOName('apellido2', value);
    }

    static create(dto) {
        return new Creator(dto);
    }
}

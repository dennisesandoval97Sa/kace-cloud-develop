import { ValueObjectUserName } from '../../../src/users/domain/ValueObjectUserName.js';

describe('ValueObjectUserName', () => {
    it('acepta un apellido corriente', () => {
        expect(new ValueObjectUserName('apellido', 'Perez').value).toBe('Perez');
    });

    // El patron admitia la comilla tipografica de apertura (U+2018) pero no el apostrofe ASCII
    // ni la de cierre (U+2019), que es la que insertan teclados y correctores.
    it.each(["O'Connor", 'D’Angelo', 'Degl‘Innocenti'])('acepta el apellido %s', (apellido) => {
        expect(() => new ValueObjectUserName('apellido', apellido)).not.toThrow();
    });

    it('sigue rechazando un caracter fuera del juego', () => {
        expect(() => new ValueObjectUserName('apellido', 'Perez€')).toThrow();
    });

    it('lanza cuando el valor es vacio y no es nullable', () => {
        expect(() => new ValueObjectUserName('apellido', '', false)).toThrow('apellido: The value cannot be null');
    });

    it('retorna sin valor cuando es vacio y nullable', () => {
        const vo = new ValueObjectUserName('apellido', '', true);

        expect(vo.value).toBe('');
    });
});

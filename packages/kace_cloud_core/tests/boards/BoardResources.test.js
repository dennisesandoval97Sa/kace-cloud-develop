import { BoardResources } from '../../src/boards/domain/BoardResources.js';
import { InvalidArgumentError } from '../../src/shared/index.js';

describe('BoardResources', () => {
    it('usa los defaults rows=[] y total=0 cuando no se pasan argumentos', () => {
        // Act
        const resources = new BoardResources();

        // Assert
        expect(resources.rows).toEqual([]);
        expect(resources.total).toBe(0);
    });

    it('lanza InvalidArgumentError cuando rows no es un array', () => {
        // Act & Assert
        expect(() => new BoardResources({ not: 'an array' }, 1)).toThrow(InvalidArgumentError);
    });

    it('normaliza claves con comillas dobles al inicio/fin', () => {
        // Arrange
        const rows = [{ '"id"': '1', nombre: 'x' }];

        // Act
        const resources = new BoardResources(rows, 1);

        // Assert
        expect(resources.rows).toEqual([{ id: '1', nombre: 'x' }]);
        expect(resources.total).toBe(1);
    });
});

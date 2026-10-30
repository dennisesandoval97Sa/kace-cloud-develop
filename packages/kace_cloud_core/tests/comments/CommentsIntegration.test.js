import { KnexCommentsRepository } from '../../src/comments/index.js';
import CommentsMother from './domain/CommentsMother.js';
import UsersMother from '../users/domain/UsersMother.js';
import {
    Comment,
    CommentCreator,
    CommentFinder,
    CommentResponse,
    CommentsSearcher,
    CommentUpdater,
} from '../../src/comments/index.js';
import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import { CommentsCollectionResponse } from '../../src/comments/index.js';
import { CommentCounter } from '../../src/comments/index.js';
import { CommentsCountResponse } from '../../src/comments/application/CommentsCountResponse.js';
import { InvalidArgumentError } from '../../src/shared/errors/InvalidArgumentError.js';
import { CustomError } from '../../src/shared/index.js';
import { QueryDBError } from '../../src/shared/errors/QueryDBError.js';
import { KnexUsersRepository } from '../../src/users/index.js';

describe('CommentCreator', () => {
    const repository = new KnexCommentsRepository(knexConfig);
    const usersRepository = new KnexUsersRepository(repository.connection);

    it('should create a Comment', async () => {
        const dto = CommentsMother.dto(uuidv4());
        // El dto va al caso de uso sin pasar por `createComment`, que es quien
        // respalda el caso al que cuelga el comentario.
        await CommentsMother.ensureRelations(repository.connection, dto);
        const commentCreator = new CommentCreator(repository);
        await commentCreator.execute(dto);
        const result = await repository.connection('comentarios').select('*').where('id', dto.id);
        expect(result.length).toBe(1);
    });

    it('can i get a existing comment', async () => {
        const comment = await CommentsMother.createComment(repository);
        const commentFinder = new CommentFinder(repository);
        const commentResult = await commentFinder.execute(comment.id.value);
        expect(commentResult).not.toBeNull();
        expect(commentResult).toBeInstanceOf(CommentResponse);
    });

    it('can update a existing comment', async () => {
        const comment = await CommentsMother.createComment(repository);
        const commentUpdater = new CommentUpdater(repository);
        await commentUpdater.execute(comment.id.value, { descripcion: 'description updated' });
        const result = await repository.find(comment.id);
        expect(result).toBeInstanceOf(Comment);
        expect(result.descripcion.value).toBe('description updated');
    });

    it('searches for Comment instances with given criteria', async () => {
        const user = await UsersMother.createUser(usersRepository);
        for (let i = 0; i < 10; i++) {
            await CommentsMother.createRandomComment(repository, { created_by: user.id.value });
        }
        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const CommentsSearch = new CommentsSearcher(repository);
        const CommentsResult = await CommentsSearch.execute(dtoCriteria);
        expect(CommentsResult).toBeInstanceOf(CommentsCollectionResponse);
    });

    it('searches for Comment instances with given criteria with filter', async () => {
        const user = await UsersMother.createUser(usersRepository);
        for (let i = 0; i < 10; i++) {
            await CommentsMother.createRandomComment(repository, { created_by: user.id.value });
        }
        const dtoCriteria = {
            filter: [
                {
                    field: 'calificacion',
                    operator: 'eq',
                    value: '1',
                    type: 'and',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const CommentsSearch = new CommentsSearcher(repository);
        const CommentsResult = await CommentsSearch.execute(dtoCriteria);
        expect(CommentsResult).toBeInstanceOf(CommentsCollectionResponse);
    });

    it('counter for Comment instances with given criteria', async () => {
        for (let i = 0; i < 10; i++) {
            // Sin `await` el conteo dependia de cuantas de las diez promesas
            // sueltas hubieran resuelto cuando corre el contador.
            await CommentsMother.createRandomComment(repository);
        }
        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const commentCount = new CommentCounter(repository);
        const commentResult = await commentCount.execute(dtoCriteria);
        expect(commentResult).toBeInstanceOf(CommentsCountResponse);
        // `count()` de postgres devuelve bigint, y pg lo entrega como cadena.
        expect(Number(commentResult.toJson().count)).toEqual(10);
    });

    it('return null if not found a record', async () => {
        const commentFinder = new CommentFinder(repository);
        const commentResult = await commentFinder.execute(uuidv4());
        expect(commentResult).not.toBeNull();
        expect(commentResult).toBeInstanceOf(CommentResponse);
    });

    it('should throw an error when create a Comment with same id', async () => {
        const dto = CommentsMother.dto();
        await CommentsMother.ensureRelations(repository.connection, dto);
        const commentCreator = new CommentCreator(repository);
        await commentCreator.execute(dto);
        await expect(commentCreator.execute(dto)).rejects.toThrow(CustomError);
    });

    it('should throw an error when calificación is greater than 10', async () => {
        const dto = CommentsMother.dto();
        dto.calificacion = 20;
        const commentCreator = new CommentCreator(repository);

        await expect(commentCreator.execute(dto)).rejects.toThrow(InvalidArgumentError);

        await expect(commentCreator.execute(dto)).rejects.toThrow('calificacion: The value must be between 1 and 10');
    });

    it('should throw an error when calificación is not an integer value', async () => {
        const dto = CommentsMother.dto();
        dto.calificacion = '20';
        const commentCreator = new CommentCreator(repository);

        await expect(commentCreator.execute(dto)).rejects.toThrow(InvalidArgumentError);

        await expect(commentCreator.execute(dto)).rejects.toThrow('calificacion: The value must be a number');
    });

    it('should handle updating a Comment with non-existent fields', async () => {
        const comment = await CommentsMother.createComment(repository);
        const commentUpdater = new CommentUpdater(repository);

        await expect(commentUpdater.execute(comment.id.value, { nonExistentField: 'value' })).rejects.toThrow(
            QueryDBError
        );
        await expect(commentUpdater.execute(comment.id.value, { nonExistentField: 'value' })).rejects.toThrow(
            'Transaction failed: error updating data.'
        );
    });

    it('should throw an error when search Comment instances with invalid criteria', async () => {
        for (let i = 0; i < 10; i++) {
            await CommentsMother.createRandomComment(repository);
        }
        const dtoCriteria = {
            filter: [
                {
                    field: 'invalid',
                    operator: 'eq',
                    value: '1',
                    type: 'and',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const CommentsSearch = new CommentsSearcher(repository);
        await expect(CommentsSearch.execute(dtoCriteria)).rejects.toThrow(QueryDBError);
        await expect(CommentsSearch.execute(dtoCriteria)).rejects.toThrow(
            'Transaction failed: error executing search.'
        );
    });
});

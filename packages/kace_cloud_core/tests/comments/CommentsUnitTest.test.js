import { Comment, CommentResponse, CommentsCollectionResponse } from '../../src/comments/index.js';
import { v4 as uuidv4 } from 'uuid';
import { ValueObjectUuid } from '../../src/shared/index.js';
import CommentsMother from './domain/CommentsMother.js';
import { ValueObjectCalificacion } from '../../src/comments/domain/value-object/ValueObjectCalificacion.js';

describe('Comment Entity', () => {
    const dto = CommentsMother.dto();
    it('should create a comment with valid data', () => {
        const comment = Comment.create(dto, uuidv4());
        expect(comment.id).toBeInstanceOf(ValueObjectUuid);
        expect(comment.calificacion).toBeInstanceOf(ValueObjectCalificacion);
    });

    it('should update comment data', () => {
        const comment = Comment.create(dto, uuidv4());
        const newData = {
            descripcion: 'Updated descripcion',
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        comment.update(newData);
        expect(comment.descripcion.value).toBe('Updated descripcion');
        expect(comment.changedAttributes).toEqual(newData);
    });

    /**
     * `Comment` construye la valoración como nullable, pero la comprobación propia del value
     * object corría después del `super()` sin mirar ese flag y volvía a exigir un entero. El
     * efecto era que un comentario sin valoración no se podía ni crear ni hidratar, aunque
     * `comentarios.calificacion` admite nulos. Lo necesita el motivo de una reclasificación, que
     * no sale de ninguna encuesta.
     */
    it.each([null, undefined])('acepta un comentario sin valoración (%p)', (calificacion) => {
        const comment = Comment.create({ ...CommentsMother.dto(), calificacion }, uuidv4());
        expect(comment.calificacion.value ?? null).toBeNull();
    });

    it.each([0, 11, 'cinco', 2.5])('sigue rechazando una valoración inválida (%p)', (calificacion) => {
        expect(() => Comment.create({ ...CommentsMother.dto(), calificacion }, uuidv4())).toThrow();
    });

    it('should throw an error with invalid UUID', () => {
        const invalidData = dto;
        invalidData.id = 'invalid-uuid';
        expect(() => Comment.create(invalidData)).toThrow('Invalid value invalid-uuid for object uuid');
    });
});

describe('Comments Tests', () => {
    it('creates a new Comment instance from DTO', () => {
        const dto = CommentsMother.dto();
        dto.updated_at = null;
        dto.updated_by = null;
        const comment = Comment.create(dto, uuidv4());
        expect(comment.id.value).toBe(dto.id);
        expect(comment.descripcion.value).toBe(dto.descripcion);
        expect(comment.calificacion.value).toBe(dto.calificacion);
        expect(comment.created_at.value).toBe(dto.created_at);
        expect(comment.updated_at.value).toBe(dto.updated_at);
        expect(comment.created_by.value).toBe(dto.created_by);
        expect(comment.updated_by.value).toBe(dto.updated_by);
    });

    it('updates an Comments instance with new values', () => {
        const dto = CommentsMother.dto();
        const comment = Comment.create(dto, uuidv4());
        const updateDto = {
            descripcion: 'Comment Updated',
            calificacion: 2,
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        comment.update(updateDto);
        expect(comment.descripcion.value).toBe(updateDto.descripcion);
        expect(comment.calificacion.value).toBe(updateDto.calificacion);
        expect(comment.updated_at.value).toBe(updateDto.updated_at);
        expect(comment.updated_by.value).toBe(updateDto.updated_by);
    });

    it('does not update properties when values are the same', () => {
        const dto = CommentsMother.dto();
        const comment = Comment.create(dto, uuidv4());
        comment.update(dto);
        expect(comment.changedAttributes).toEqual({});
    });

    it('flushes changes in Comments instance', () => {
        const dto = CommentsMother.dto();
        const comment = Comment.create(dto, uuidv4());
        const updateDto = {
            descripcion: 'Updated Name',
            calificacion: 2,
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        comment.update(updateDto);
        comment.flushChanges();
        expect(comment.changedAttributes).toEqual({});
    });
});

describe('Comments Responses Tests', () => {
    it('converts Comments object to JSON representation', () => {
        const comment = new Comment(CommentsMother.randomDto());
        const commentResponse = new CommentResponse(comment);
        const json = commentResponse.toJson();
        expect(json).toEqual({
            data: {
                id: comment.id.value,
                descripcion: comment.descripcion.value,
                calificacion: comment.calificacion.value,
                created_at: comment.created_at.value,
                updated_at: comment.updated_at.value,
                created_by: comment.created_by.value,
                updated_by: comment.updated_by.value,
                creator: null,
            },
        });
    });

    it('converts CommentsCollection to JSON representation', () => {
        const commentsCollection = [new Comment(CommentsMother.randomDto()), new Comment(CommentsMother.randomDto())];
        const commentCollectionResponse = new CommentsCollectionResponse(commentsCollection, commentsCollection.length);
        const json = commentCollectionResponse.toJson();
        expect(json).toEqual({
            data: {
                items: commentsCollection.map((comment) => new CommentResponse(comment).toJson().data),
            },
            metadata: {
                count: commentsCollection.length,
            },
        });
    });
});

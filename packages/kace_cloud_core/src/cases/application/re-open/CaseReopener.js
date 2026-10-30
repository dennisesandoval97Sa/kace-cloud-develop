import { CustomError } from '../../../shared/errors/CustomError';
import { InvalidArgumentError } from '../../../shared/errors/InvalidArgumentError.js';
import { DomainCaseFinder } from '../../index.js';
import { CaseReopenWindow } from '../../domain/CaseReopenWindow.js';
import { GroupsFinder } from '../../../grupos/domain/GroupsFinder';
import { AgentCasesConfigFinder } from '../../../global-config/domain/AgentCasesConfigFinder.js';
import { CommentCreator } from '../../../comments/application/create/CommentCreator.js';
import { CommentFinder as DomainCommentFinder } from '../../../comments/domain/CommentFinder.js';
import {
    CASE_REOPEN_CASE_NOT_CLOSED,
    CASE_REOPEN_CASE_NOT_FOUND,
    CASE_REOPEN_CONFIG_UNAVAILABLE,
    CASE_REOPEN_NO_ACTIVE_GROUP,
    CASE_REOPEN_USER_GROUP_NOT_FOUND,
} from '@kace/error-codes';

export class CaseReopener {
    /**
     * @type {KnexCaseRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     * @type {DomainCaseFinder}
     * is initialized in the constructor
     */
    #finder;

    /**
     *
     * @param {KnexCaseRepository} caseRepository
     * @param {KnexGroupsRepository} groupsRepository
     * @param {KnexGlobalConfigurationRepository} globalConfigurationRepository
     * @param {KnexCommentsRepository} commentsRepository
     */
    constructor(caseRepository, groupsRepository, globalConfigurationRepository, commentsRepository) {
        if (!commentsRepository) {
            throw new InvalidArgumentError('CaseReopener: commentsRepository is required');
        }
        this.#repository = caseRepository;
        this.#finder = new DomainCaseFinder(caseRepository);
        this.groupFinder = new GroupsFinder(groupsRepository);
        this.agentCasesConfigFinder = new AgentCasesConfigFinder(globalConfigurationRepository);
        this.commentCreator = new CommentCreator(commentsRepository);
        this.commentFinder = new DomainCommentFinder(commentsRepository);
    }

    /**
     * Reopens a closed case.
     *
     * The reopen window is read from the acting user's active group (`userGroupId`),
     * not from the case's group. Missing `reopen_cases_only_last_days` defaults to 7.
     * `0` means unlimited. A failure to load the global configuration is not treated
     * as a missing key: it throws `CASE_REOPEN_CONFIG_UNAVAILABLE` (`0x030048`).
     *
     * @param {string} id identificator case to reopen
     * @param {object} payload data for reopen case
     * @param {{ userGroupId: string, comment?: object }} [context]
     * @returns {Promise<void>}
     * @throws {CustomError}
     */
    async execute(id, payload, { userGroupId, comment } = {}) {
        const kase = await this.#finder.execute(id);

        if (kase === null) {
            throw new CustomError(
                'The Case you are trying re open does not exist',
                404,
                [],
                CASE_REOPEN_CASE_NOT_FOUND
            );
        }

        if (kase.fecha_resolucion.value === null) {
            throw new CustomError(
                'The Case you are trying re open is not closed',
                400,
                [],
                CASE_REOPEN_CASE_NOT_CLOSED
            );
        }

        if (!userGroupId) {
            throw new CustomError('User has no active group assigned', 400, [], CASE_REOPEN_NO_ACTIVE_GROUP);
        }

        const grupo = await this.groupFinder.execute(userGroupId);
        if (grupo === null) {
            throw new CustomError('The group of the user does not exist', 404, [], CASE_REOPEN_USER_GROUP_NOT_FOUND);
        }

        const casosConfig = await this.agentCasesConfigFinder.execute(grupo, {
            failOnError: true,
            unavailableErrorCode: CASE_REOPEN_CONFIG_UNAVAILABLE,
        });
        CaseReopenWindow.fromConfig(casosConfig.reopen_cases_only_last_days).ensureAllowsReopen(kase.created_at.value);

        if (!comment && payload.cambio_estado_comentario_id) {
            await this.#ensureExistingComment(id, payload.cambio_estado_comentario_id);
        }

        const trx = await this.#repository.startTransaction();
        try {
            await this.#persistReopen(kase, payload, comment ? { ...comment, caso_id: id } : null, trx);
            await trx.commit();
        } catch (error) {
            await trx.rollback();
            throw error;
        }
    }

    async #ensureExistingComment(caseId, commentId) {
        const existing = await this.commentFinder.execute(commentId);
        if (!existing) {
            throw new CustomError('The comment does not exist', 400);
        }
        if (existing.caso_id?.value && existing.caso_id.value !== caseId) {
            throw new CustomError('The comment does not belong to the case', 400);
        }
    }

    async #persistReopen(kase, payload, comment, trx) {
        let reopenPayload = payload;
        if (comment) {
            await this.commentCreator.execute(comment, trx);
            reopenPayload = { ...payload, cambio_estado_comentario_id: comment.id };
        }

        const originalValues = kase.toJson();
        kase.update(reopenPayload);

        if (kase.changedAttributes.transicion_id && !('update_source' in reopenPayload)) {
            kase.update_source = null;
        }

        await this.#repository.update(kase, trx);
        await this.#repository.saveHistory(kase, originalValues, trx);

        kase.flushChanges();
    }
}

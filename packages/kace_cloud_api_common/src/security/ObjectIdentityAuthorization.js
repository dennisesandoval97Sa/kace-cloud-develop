import { validate as validateUuid } from 'uuid';
import { HttpResponse } from '../http_responses/HttpResponse.js';
import { Helper, ValueObjectUuid } from '@kace/core/src/shared/index.js';

export const SERVER_MANAGED_FIELDS = Object.freeze([
    'created_at',
    'created_by',
    'updated_at',
    'updated_by',
    'deleted_at',
    'deleted_by',
    'tenant_id',
    'tenant',
    'edited_at',
    'edited_by',
]);

export class ObjectIdentityAuthorizationError extends Error {
    constructor({ message, code, field = 'id', statusCode = 400, metadata = {} }) {
        super(message);
        this.name = 'ObjectIdentityAuthorizationError';
        this.code = code;
        this.field = field;
        this.statusCode = statusCode;
        this.metadata = metadata;
    }
}

export const isObjectIdentityAuthorizationError = (error) => error instanceof ObjectIdentityAuthorizationError;

export const applyServerManagedFields = (payload = {}, { operation, userId, now = new Date() } = {}) => {
    const sanitized = { ...payload };

    for (const field of SERVER_MANAGED_FIELDS) {
        delete sanitized[field];
    }

    if (operation === 'create') {
        sanitized.created_at = now;
        sanitized.created_by = userId;
    }

    if (operation === 'update') {
        sanitized.updated_at = now;
        sanitized.updated_by = userId;
    }

    if (operation === 'delete') {
        sanitized.deleted_at = now;
        sanitized.deleted_by = userId;
    }

    return sanitized;
};

export const auditObjectIdentityDecision = ({
    actorId,
    tenantId,
    endpoint,
    resourceType,
    identifier,
    decision,
    reason,
    metadata = {},
} = {}) => {
    Helper.logInfo('object_identity_authorization_decision', {
        actor_id: actorId,
        tenant_id: tenantId,
        endpoint,
        resource_type: resourceType,
        identifier,
        decision,
        reason,
        metadata,
    });
};

export const createRepositoryIdCollisionFinder =
    (repository, source = 'repository') =>
    async (id) => {
        if (!repository) {
            return { source, exists: false };
        }

        if (typeof repository.find === 'function') {
            const result = await repository.find(new ValueObjectUuid('id', id));
            return { source, exists: !!result, result };
        }

        if (typeof repository.findById === 'function') {
            const result = await repository.findById(id);
            return { source, exists: !!result, result };
        }

        if (typeof repository.table === 'function' && repository.tableName) {
            const result = await repository.table(repository.tableName).where({ id }).first();
            return { source, exists: !!result, result };
        }

        return { source, exists: false };
    };

export const resolveCanonicalCreateIdentity = async ({
    payload = {},
    idField = 'id',
    allowLegacyId = false,
    generateId = () => ValueObjectUuid.random(),
    collisionFinders = [],
    actorId,
    tenantId,
    endpoint,
    resourceType,
} = {}) => {
    const nextPayload = { ...payload };
    const requestId = nextPayload[idField];

    if (!requestId) {
        nextPayload[idField] = generateId();
        auditObjectIdentityDecision({
            actorId,
            tenantId,
            endpoint,
            resourceType,
            identifier: nextPayload[idField],
            decision: 'server_generated',
            reason: 'request_body_id_missing',
        });
        return { payload: nextPayload, id: nextPayload[idField], decision: 'server_generated' };
    }

    if (!allowLegacyId) {
        nextPayload[idField] = generateId();
        auditObjectIdentityDecision({
            actorId,
            tenantId,
            endpoint,
            resourceType,
            identifier: String(requestId),
            decision: 'replaced',
            reason: 'request_body_id_not_legacy_compatible',
            metadata: { replacement_id: nextPayload[idField] },
        });
        return { payload: nextPayload, id: nextPayload[idField], decision: 'server_generated_replacement' };
    }

    if (!validateUuid(String(requestId))) {
        auditObjectIdentityDecision({
            actorId,
            tenantId,
            endpoint,
            resourceType,
            identifier: String(requestId),
            decision: 'rejected',
            reason: 'malformed_request_body_id',
        });
        throw new ObjectIdentityAuthorizationError({
            message: `Invalid ${idField}`,
            code: 'malformed_request_body_id',
            field: idField,
            statusCode: 400,
            metadata: { endpoint, resourceType },
        });
    }

    for (const collisionFinder of collisionFinders) {
        const collision = await collisionFinder(String(requestId));
        if (collision?.exists) {
            auditObjectIdentityDecision({
                actorId,
                tenantId,
                endpoint,
                resourceType,
                identifier: String(requestId),
                decision: 'rejected',
                reason: 'legacy_id_collision',
                metadata: { source: collision.source },
            });
            throw new ObjectIdentityAuthorizationError({
                message: `${resourceType ?? 'Resource'} id already exists`,
                code: 'legacy_id_collision',
                field: idField,
                statusCode: 400,
                metadata: { endpoint, resourceType, source: collision.source },
            });
        }
    }

    auditObjectIdentityDecision({
        actorId,
        tenantId,
        endpoint,
        resourceType,
        identifier: String(requestId),
        decision: 'legacy_accepted',
        reason: 'legacy_uuid_not_bound',
    });
    return { payload: nextPayload, id: requestId, decision: 'legacy_accepted' };
};

export const assertCreateRouteUpdateAuthorized = ({
    user,
    existingObject,
    permission,
    endpoint,
    resourceType,
    targetId = null,
    actorId = user?.id?.value,
    tenantId,
} = {}) => {
    if (!existingObject) {
        return;
    }

    const permissions = Array.isArray(permission) ? permission : [permission];
    const allowed = permissions.some((candidate) =>
        user?.hasPermission?.(candidate.role, candidate.moduleId, candidate.action)
    );
    const resolvedTargetId =
        targetId ?? existingObject?.id?.value ?? existingObject?.id ?? existingObject?.data?.id ?? 'unknown';

    auditObjectIdentityDecision({
        actorId,
        tenantId,
        endpoint,
        resourceType,
        identifier: resolvedTargetId,
        decision: allowed ? 'create_route_update_authorized' : 'create_route_update_rejected',
        reason: allowed ? 'explicit_update_permission_granted' : 'missing_explicit_update_permission',
    });

    if (!allowed) {
        throw new ObjectIdentityAuthorizationError({
            message: `${endpoint ?? 'Create route'} requires update authorization for existing ${resourceType}`,
            code: 'create_route_update_forbidden',
            field: 'id',
            statusCode: 403,
            metadata: { endpoint, resourceType, targetId: resolvedTargetId },
        });
    }
};

export const assertAuthorizedRelationships = async ({
    payload = {},
    repository,
    relationships = [],
    actorId,
    tenantId,
    endpoint,
    resourceType,
} = {}) => {
    if (!repository) {
        if (relationships.length > 0) {
            auditObjectIdentityDecision({
                actorId,
                tenantId,
                endpoint,
                resourceType,
                decision: 'relationship_check_skipped',
                reason: 'missing_repository',
                metadata: { relationship_count: relationships.length },
            });
        }
        return;
    }

    for (const relationship of relationships) {
        const value = payload[relationship.field];
        const isEmpty =
            value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);

        if (isEmpty) {
            if (relationship.required) {
                throw new ObjectIdentityAuthorizationError({
                    message: `Missing relationship ${relationship.field}`,
                    code: 'relationship_required',
                    field: relationship.field,
                    statusCode: 400,
                    metadata: { endpoint, resourceType },
                });
            }
            continue;
        }

        const ids = Array.isArray(value) ? value : [value];
        for (const rawId of ids) {
            // Some resources persist relationships as denormalized JSON arrays of `{ id }`
            // objects (e.g. workspaces `groups`) rather than scalar UUID columns. Normalize
            // to the underlying identifier so the broad check works for both shapes.
            const id = rawId !== null && typeof rawId === 'object' ? (rawId.id ?? rawId.value) : rawId;
            if (relationship.uuid !== false && !validateUuid(String(id))) {
                throw new ObjectIdentityAuthorizationError({
                    message: `Invalid relationship ${relationship.field}`,
                    code: 'malformed_relationship_id',
                    field: relationship.field,
                    statusCode: 400,
                    metadata: { endpoint, resourceType, relationship: relationship.field },
                });
            }

            const row = await repository
                .table(relationship.table)
                .select(relationship.select ?? 'id')
                .where({ [relationship.idColumn ?? 'id']: id })
                // `relationship.table` is the bare PG correlation alias of the schema-qualified
                // FROM above (FROM "schema"."table" -> correlation name "table"), so column refs
                // like `${relationship.table}.deleted_at` must stay UNqualified by schema.
                .modify((query) => {
                    if (relationship.notDeleted !== false) {
                        query.whereNull(`${relationship.table}.deleted_at`);
                    }
                    if (relationship.where) {
                        query.andWhere(relationship.where);
                    }
                })
                .first();

            const allowed =
                row && (!relationship.authorize || (await relationship.authorize(row, { payload, actorId })));
            if (!allowed) {
                auditObjectIdentityDecision({
                    actorId,
                    tenantId,
                    endpoint,
                    resourceType,
                    identifier: String(id),
                    decision: 'relationship_rejected',
                    reason: 'relationship_missing_or_unauthorized',
                    metadata: { relationship: relationship.field, table: relationship.table },
                });
                throw new ObjectIdentityAuthorizationError({
                    message: `Related object ${relationship.field} is not accessible`,
                    code: 'relationship_unauthorized',
                    field: relationship.field,
                    statusCode: row ? 403 : 404,
                    metadata: { endpoint, resourceType, relationship: relationship.field, table: relationship.table },
                });
            }
        }
    }
};

const BROAD_RELATIONSHIP_TABLE_BY_FIELD = Object.freeze({
    action_id: 'actions',
    adapter_id: 'broker_adapters',
    advisor_list_id: 'lista_usuarios',
    agenda_id: 'agendas',
    ans_id: 'ans',
    assigned_to: 'usuarios',
    authorization_id: 'ws_rest_endpoints',
    canal_id: 'mail_accounts',
    case_id: 'cases',
    caso_id: 'cases',
    child_case_id: 'cases',
    clasificacion_id: 'clasificaciones',
    classification_id: 'clasificaciones',
    configuration_id: 'global_configurations',
    conditional_id: 'ws_rest_conditionals',
    default_group_id: 'grupos',
    descripcion_caso_id: 'descripciones_casos',
    email_id: 'emails',
    endpoint_id: 'ws_rest_endpoints',
    estado_actual_id: 'estados',
    flow_id: 'flujos',
    flujo_id: 'flujos',
    folio_config_id: 'folio_configurations',
    function_id: 'ws_rest_functions',
    group_id: 'grupos',
    group_list_id: 'lista_grupos',
    groups: 'grupos',
    grupo_id: 'grupos',
    help_id: 'helps',
    horario_id: 'shift_management',
    last_appointment_id: 'appointments',
    mail_account_id: 'mail_accounts',
    mapper_id: 'broker_message_mappers',
    model_update_id: 'action_model_updates',
    padre_id: 'clients',
    parent_id: 'cases',
    ref_id: 'boards',
    responsable_id: 'usuarios',
    responsible_id: 'usuarios',
    rest_flow_id: 'ws_rest_flows',
    restflow_id: 'ws_rest_flows',
    rol_id: 'roles',
    rule_id: 'transition_rules',
    schema_id: 'schemas',
    siguiente_estado_id: 'estados',
    state_id: 'estados',
    template_id: 'plantillas',
    transicion_id: 'transiciones',
    transition_id: 'transiciones',
    user_id: 'usuarios',
    usuario_id: 'usuarios',
    workspace_id: 'workspaces',
    ws_rest_flow_id: 'ws_rest_flows',
});

const hasOwn = (object, property) => Object.prototype.hasOwnProperty.call(object ?? {}, property);

export const buildBroadRelationshipRules = (
    payload = {},
    relationshipTableByField = BROAD_RELATIONSHIP_TABLE_BY_FIELD
) =>
    Object.entries(relationshipTableByField)
        .filter(([field]) => hasOwn(payload, field))
        .map(([field, table]) => ({
            field,
            table,
            // Broad rollout covers many legacy tables whose soft-delete columns are not uniform.
            // High-risk controllers can still opt into the default not-deleted check explicitly.
            notDeleted: false,
        }));

export const secureObjectCreatePayload = async ({
    payload = {},
    userId,
    now = new Date(),
    actorId = userId,
    tenantId,
    endpoint,
    resourceType,
    idField = 'id',
    protectId = true,
    allowLegacyId = false,
    generateId,
    collisionFinders = [],
    repository,
    relationships,
    relationshipTableByField,
} = {}) => {
    let securedPayload = applyServerManagedFields(payload, {
        operation: 'create',
        userId,
        now,
    });

    if (protectId === true || (protectId === 'if-present' && hasOwn(securedPayload, idField))) {
        const identity = await resolveCanonicalCreateIdentity({
            payload: securedPayload,
            idField,
            allowLegacyId,
            generateId,
            collisionFinders,
            actorId,
            tenantId,
            endpoint,
            resourceType,
        });
        securedPayload = identity.payload;
    }

    const relationshipRules = relationships ?? buildBroadRelationshipRules(securedPayload, relationshipTableByField);
    if (relationshipRules.length > 0) {
        await assertAuthorizedRelationships({
            payload: securedPayload,
            repository,
            relationships: relationshipRules,
            actorId,
            tenantId,
            endpoint,
            resourceType,
        });
    }

    return securedPayload;
};

export const objectIdentityErrorResponse = (error, event) => {
    if (!isObjectIdentityAuthorizationError(error)) {
        return null;
    }

    if (error.statusCode === 403) {
        return HttpResponse.forbidden({ message: error.message, event });
    }

    if (error.statusCode === 404) {
        return HttpResponse.notFound({ message: error.message, event });
    }

    return HttpResponse.badRequest({ message: error.message, errors: error, event });
};

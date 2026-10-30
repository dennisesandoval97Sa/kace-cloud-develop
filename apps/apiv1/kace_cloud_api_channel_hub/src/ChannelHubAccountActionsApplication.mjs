const DEFAULT_INDEX_LIMIT = 10;
const MAX_INDEX_LIMIT = 100;

const parsePaginationParam = (value, defaultValue) => {
    if (value === undefined || value === null || value === '') return defaultValue;
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : null;
};

export class ChannelHubAccountAuthorizationError extends Error {}

export class ChannelHubAccountValidationError extends Error {
    constructor(validationError) {
        super('Channel Hub account payload validation failed');
        this.validationError = validationError;
    }
}

export class ChannelHubAccountPaginationError extends Error {}

export class ChannelHubAccountActionsApplication {
    constructor({
        creator,
        updater,
        deleter,
        registrar,
        finder,
        searcher,
        createSchema,
        updateSchema,
        idGenerator,
        clock = () => new Date(),
        createdAt,
        ownedResources = [],
    }) {
        this.creator = creator;
        this.updater = updater;
        this.deleter = deleter;
        this.registrar = registrar;
        this.finder = finder;
        this.searcher = searcher;
        this.createSchema = createSchema;
        this.updateSchema = updateSchema;
        this.idGenerator = idGenerator;
        this.clock = clock;
        this.createdAt = createdAt;
        this.ownedResources = ownedResources;
    }

    #authorize(user, permission, message) {
        if (!user.hasPermission('administrador', 'channel-hub', permission)) {
            throw new ChannelHubAccountAuthorizationError(message);
        }
    }

    #validate(schema, payload) {
        const { value, error } = schema.validate(payload, { abortEarly: false });
        if (error) throw new ChannelHubAccountValidationError(error);
        return value;
    }

    async create(payload, user) {
        this.#authorize(user, 'ChannelHubCreate', 'You do not have permission to create this resource.');
        const now = this.createdAt ?? this.clock();
        const dto = this.#validate(this.createSchema, {
            ...payload,
            id: this.idGenerator(),
            created_at: now,
            created_by: user.id.value,
            updated_at: now,
            updated_by: user.id.value,
        });
        await this.creator.execute(dto);
    }

    async update(id, payload, user) {
        this.#authorize(user, 'ChannelHubUpdate', 'You do not have permission to update this resource.');
        const dto = this.#validate(this.updateSchema, {
            ...payload,
            updated_at: this.clock(),
            updated_by: user.id.value,
        });
        await this.updater.execute(id, dto);
    }

    async delete(id, user) {
        this.#authorize(user, 'ChannelHubDelete', 'You do not have permission to delete this resource.');
        const now = this.clock();
        await this.deleter.execute(id, {
            updated_at: now,
            updated_by: user.id.value,
            deleted_at: now,
            deleted_by: user.id.value,
        });
    }

    async register(id, user) {
        this.#authorize(user, 'ChannelHubUpdate', 'You do not have permission to register this resource.');
        await this.registrar.execute(id, user.id.value);
    }

    async find(id, user) {
        this.#authorize(user, 'ChannelHubRead', 'You do not have permission to read this resource.');
        return this.finder.execute(id);
    }

    async search(query, user) {
        this.#authorize(user, 'ChannelHubRead', 'You do not have permission to read this resource.');
        return this.searcher.execute(query);
    }

    async index(queryString, user) {
        this.#authorize(user, 'ChannelHubRead', 'You do not have permission to read this resource.');
        const requestedLimit = parsePaginationParam(queryString.limit, DEFAULT_INDEX_LIMIT);
        const requestedOffset = parsePaginationParam(queryString.offset, 0);
        if (requestedLimit === null || requestedLimit < 1 || requestedOffset === null || requestedOffset < 0) {
            throw new ChannelHubAccountPaginationError();
        }

        return this.searcher.execute({
            filter: undefined,
            relationship: undefined,
            limit: Math.min(requestedLimit, MAX_INDEX_LIMIT),
            offset: requestedOffset,
            order: { field: 'created_at', direction: 'desc' },
        });
    }

    async destroy() {
        const results = await Promise.allSettled(
            this.ownedResources.map((resource) => resource.destroy?.() ?? resource.destroyConnection?.())
        );
        const failure = results.find(({ status }) => status === 'rejected');
        if (failure) throw failure.reason;
    }
}

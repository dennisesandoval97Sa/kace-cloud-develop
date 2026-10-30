import { CustomError } from '../../../shared/errors/CustomError.js';
import { ChannelHubAccountFinder as DomainFinder } from '../../domain/ChannelHubAccountFinder.js';
import { ChannelHubAccountResponse } from '../ChannelHubAccountResponse.js';

export class ChannelHubAccountFinder {
    #finder;

    constructor(repository) {
        this.#finder = new DomainFinder(repository);
    }

    async execute(id) {
        const account = await this.#finder.execute(id);

        if (!account || account.isDeleted()) {
            throw new CustomError('Channel Hub account not found', 404);
        }

        return new ChannelHubAccountResponse(account);
    }
}

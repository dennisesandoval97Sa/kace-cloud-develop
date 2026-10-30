import { InvalidArgumentError } from '../../shared/errors/InvalidArgumentError';

export class SiteRole {
    static ADMIN = new SiteRole('ADMIN', 'admin');
    static AGENT = new SiteRole('AGENT', 'agent');
    static BOTH = new SiteRole('BOTH', 'both');

    constructor(name, value) {
        this.#ensureIsValidRole(value);

        this.name = name;
        this.value = value;
        Object.freeze(this);
    }

    static fromValue(value) {
        for (const key in SiteRole) {
            if (SiteRole[key].value === value) {
                return SiteRole[key];
            }
        }
        throw new InvalidArgumentError(`Invalid site role value: ${value}`);
    }

    static getValidValues() {
        return ['admin', 'agent', 'both'];
    }

    #ensureIsValidRole(value) {
        const validValues = SiteRole.getValidValues();
        if (!value) {
            throw new InvalidArgumentError('The site role value cannot be null');
        }
        if (!validValues.includes(value)) {
            throw new InvalidArgumentError(
                `The site role value must be one of the valid values: ${validValues.join(', ')}`
            );
        }
    }
}

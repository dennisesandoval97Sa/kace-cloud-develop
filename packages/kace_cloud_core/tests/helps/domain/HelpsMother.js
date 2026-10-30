import { v4 as uuidv4 } from 'uuid';
import { Chance } from 'chance';
import { Helps } from '../../../src/helps';
import { SHARED_VISUAL_COLOR_ALLOWLIST } from '../../../src/shared/visual-options/sharedVisualOptions.js';
export default class HelpsMother {
    static dto() {
        return {
            id: uuidv4(),
            titulo: 'test title',
            descripcion: 'Example test description',
            color: SHARED_VISUAL_COLOR_ALLOWLIST[2],
            is_active: 1,
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        };
    }

    static randomDTO() {
        const chance = new Chance();
        return {
            id: uuidv4(),
            titulo: chance.word({ length: 5 }),
            descripcion: chance.sentence({ words: 4 }),
            color: chance.pickone(SHARED_VISUAL_COLOR_ALLOWLIST),
            is_active: chance.pickone(Object.values([1, 0])),
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        };
    }

    static async createRandomHelps(repository) {
        const help = Helps.create(HelpsMother.randomDTO());
        await repository.save(help);
        return help;
    }
    static async createHelp(repository) {
        const help = Helps.create(HelpsMother.dto());
        await repository.save(help);
        return help;
    }
}

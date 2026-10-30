import { ClassificationResponse } from '../../../classifications';
import { GroupResponse } from '../../../grupos';
import { OneScriptResponse } from '../../../one-script';
import { Criteria } from '../../../shared/criteria/Criteria';
import { ClassificationGroupFormCollectionResponse as Response } from '../ClassificationGroupFormCollectionResponse';

export class ClassificationGroupSearcherForm {
    /** @type {KnexClassificationGroupRelationshipRepository} is initialized in the constructor */
    #repository;
    /** @type {KnexClassificationsRepository} is initialized in the constructor */
    #clasificacionesRepository;
    /** @type {KnexGroupsRepository} is initialized in the constructor */
    #gruposRepository;
    /** @type {KnexOneScriptRepository} is initialized in the constructor */
    #oneScriptRepository;

    constructor(repository, clasificacionesRepository, gruposRepository, oneScriptRepository) {
        this.#repository = repository;
        this.#clasificacionesRepository = clasificacionesRepository;
        this.#gruposRepository = gruposRepository;
        this.#oneScriptRepository = oneScriptRepository;
    }

    async execute({ filter, relationship, limit, offset, order }) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(filter, relationship, limit, offset, order, tablename);
        const relationships = await this.#repository.search(criteria);

        const enrichedRelationships = await Promise.all(
            relationships.map(async (relationship) => {
                const classification = await this.#clasificacionesRepository.find(relationship.classification_id);
                const group = await this.#gruposRepository.find(relationship.group_id);
                const oneScript = await this.#oneScriptRepository.find(relationship.form);

                return {
                    classification: new ClassificationResponse(classification),
                    group: new GroupResponse(group),
                    form: new OneScriptResponse(oneScript),
                };
            })
        );

        return new Response(enrichedRelationships);
    }
}

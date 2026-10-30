export default class ClassificationsLevelDistinctionResponse {
    /** @type {Array}  is initialized in the constructor*/
    #classificationsLevelDistinction;

    constructor(classificationsLevelDistinction) {
        this.#classificationsLevelDistinction = classificationsLevelDistinction;
    }

    toJson() {
        return {
            data: {
                items: this.#classificationsLevelDistinction.map(
                    (classificationLevelDistinction) => classificationLevelDistinction.level
                ),
            },
        };
    }
}

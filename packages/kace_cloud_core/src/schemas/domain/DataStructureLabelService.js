export class DataStructureLabelService {
    static assignDefaultLabels(dataStructure) {
        for (const key in dataStructure) {
            if (!dataStructure[key].ui) dataStructure[key].ui = {};
            if (!dataStructure[key].ui.label) dataStructure[key].ui.label = '';
        }
        return dataStructure;
    }
}

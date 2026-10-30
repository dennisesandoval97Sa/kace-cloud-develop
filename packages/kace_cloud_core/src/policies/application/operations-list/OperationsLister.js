import { ActionsEnum } from '../../domain/ActionsEnum';

export class ActionLister {
    execute() {
        return ActionsEnum.toJson();
    }
}

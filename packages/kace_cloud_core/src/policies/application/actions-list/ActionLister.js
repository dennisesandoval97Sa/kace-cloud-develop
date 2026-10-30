import { OperationsEnum } from '../../domain/OperationsEnum';

export class OperationsLister {
    execute() {
        return OperationsEnum.toJson();
    }
}

import { Controller } from './controller.mjs';

export class WorkspacePriorityReorderController extends Controller {
    async actionCreate() {
        return this.actionWorkspacePriorityReorder();
    }
}

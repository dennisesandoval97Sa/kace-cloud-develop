import { Controller } from './controller.mjs';

export class WorkspacePriorityListController extends Controller {
    async actionRead() {
        return this.actionWorkspacePriorityList();
    }
}

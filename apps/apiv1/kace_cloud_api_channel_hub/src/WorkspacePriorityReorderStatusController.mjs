import { Controller } from './controller.mjs';

export class WorkspacePriorityReorderStatusController extends Controller {
    async actionRead() {
        return this.actionWorkspacePriorityReorderStatus();
    }
}

import { Controller } from './controller.mjs';

export class RegisterController extends Controller {
    async actionCreate() {
        return this.actionRegister();
    }
}

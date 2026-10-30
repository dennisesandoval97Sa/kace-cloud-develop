import { Controller } from './controller.mjs';

export const handler = async (event) => {
    const controller = new Controller(event);

    const response = await controller.run();

    return response.toJson();
};

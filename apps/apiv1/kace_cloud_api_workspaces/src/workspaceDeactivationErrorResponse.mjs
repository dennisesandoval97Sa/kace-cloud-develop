import { HttpResponse } from '@kace/api-common';
import { WorkspaceChannelHubTagDeactivatorError } from './WorkspaceChannelHubTagDeactivator.mjs';

export const workspaceDeactivationErrorResponse = (error, event) => {
    if (!(error instanceof WorkspaceChannelHubTagDeactivatorError)) return null;
    if (error.statusCode === 409) {
        return HttpResponse.conflict({ event, code: error.publicErrorCode });
    }
    return HttpResponse.badGateway({ event, code: error.publicErrorCode });
};

import { ClientJS } from 'clientjs';

let clientInstance = null;

const getClientFingerprint = () => {
  if (!clientInstance) {
    clientInstance = new ClientJS();
  }

  return clientInstance.getCustomFingerprint();
};

export default getClientFingerprint;

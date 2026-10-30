import Kace from '#plugins/kace/index.js';

const modules = [Kace];

if (globalThis.EventEmitter)
  globalThis.EventEmitter.next({
    action: 'builder.modules.add',
    payload: { modules },
  });
else globalThis.Formio?.use(modules);

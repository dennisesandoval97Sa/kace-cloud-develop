import Plugin from './index.js';

const modules = [Plugin];

if (globalThis.EventEmitter)
  globalThis.EventEmitter.next({
    action: 'builder.modules.add',
    payload: { modules },
  });
else globalThis.Formio?.use(modules);

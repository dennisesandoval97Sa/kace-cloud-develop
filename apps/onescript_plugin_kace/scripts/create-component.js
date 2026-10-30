import { argv } from 'node:process';
import { createComponent } from './create-component.impl.js';

const [, , pluginComponentName, ...components] = argv;

const [pluginName, componentName] = pluginComponentName.split(':');
createComponent({ pluginName, componentName });

for (const componentArg of components) {
  if (componentArg.indexOf(':') === -1)
    createComponent({ pluginName, componentName: componentArg });
  else {
    const [plugin, component] = componentArg.split(':');
    createComponent({ pluginName: plugin, componentName: component });
  }
}

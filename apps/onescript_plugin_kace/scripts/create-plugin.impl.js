import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';
import { createComponent } from './create-component.impl.js';
import { capitalize, kebabToCamel } from './helpers/index.js';

const PLUGIN_FILE_CONTENT = `import Plugin from "./index.js";

const modules = [Plugin];

if (globalThis.EventEmitter)
	globalThis.EventEmitter.next({
		action: "builder.modules.add",
		payload: { modules },
	});
else globalThis.Formio?.use(modules);
`;

const envfileContent = (pluginName) => `export const {
	${pluginName.replace(/-/g, '_').toUpperCase()}_ENV_VAR: ${kebabToCamel(pluginName)}EnvVar = "${pluginName} environment variable fallback value",
} = import.meta.env;
`;

const indexFileContent = (
  pluginName,
  ...componentNames
) => `import { getComponentsBuilderInfoObject } from "#util/formio.util.js";

${componentNames.map((c) => `import ${capitalize(kebabToCamel(c))}Component from "./components/${c}/index.js";`).join('\n')}

/**
 * To include any component on this plugin add them like this:
 *
 * @example
 * \`\`\`
 * const components = {
 * 	[SomeComponent.COMPONENT_TYPE]: SomeComponent
 * }
 * \`\`\`
 */
const components = {
	${componentNames
    .map((c) => {
      const component = `${capitalize(kebabToCamel(c))}Component`;
      return `[${component}.COMPONENT_TYPE]: ${component},`;
    })
    .join('\n\t')}
};
const builder = {
	${kebabToCamel(pluginName)}: {
		weight: 10,
		title: "OS ${capitalize(kebabToCamel(pluginName))} Components",
		components: getComponentsBuilderInfoObject(components),
	},
};

export default {
	components,
	options: { builder: { builder } },
};
`;

/**
 * @param {string} pluginName
 * @param  {...string} componentNames
 */
export const createPlugin = (pluginName, ...componentNames) => {
  const pluginsPath = resolve(import.meta.dirname, '..', 'src', 'plugins');
  const pluginFolder = join(pluginsPath, pluginName);
  fs.mkdir(pluginFolder, { recursive: true }).then(() => {
    fs.writeFile(
      join(pluginFolder, 'index.js'),
      indexFileContent(pluginName, ...componentNames)
    );
    fs.writeFile(join(pluginFolder, 'plugin.js'), PLUGIN_FILE_CONTENT);

    const pluginConfigFolder = join(pluginFolder, 'env');
    fs.mkdir(pluginConfigFolder, { recursive: true }).then(() => {
      fs.writeFile(
        join(pluginConfigFolder, 'index.js'),
        envfileContent(pluginName)
      );
    });

    for (const componentName of componentNames)
      createComponent({ pluginName, componentName });
  });
};

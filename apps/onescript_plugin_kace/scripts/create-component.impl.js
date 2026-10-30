import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';
import { capitalize, kebabToCamel } from './helpers/index.js';

const DEFAULT_PLUGIN_NAME = 'components';
const DEFAULT_COMPONENT_NAME = 'template';

const CSS_FILE_CONTENT = `.tomato {
	color: tomato;
}

.bold {
	font-weight: bold;
}

.text-l {
	font-size: large;
}
`;

const EDIT_FORM_FILE_CONTENT = `{
	"key": "custom",
	"label": "Custom",
	"components": [
		{
			"key": "changeme",
			"type": "url",
			"label": "Changeme",
			"placeholder": "https://example.com/",
			"description": "This is only an example field, remove it."
		}
	]
}
`;

const jsxComponentFileContent = (
  componentName
) => `import "./${componentName}.css";

/**
 * @typedef Props
 * @prop {{ [x: string]: unknown }} component - \`this.component\` properties
 * @prop {(value: any, flags: any, source: any) => any} updateValue - Function to update \`this.value\` (formio component instance) value
 */

/**
 * @param {Props} props
 */
export const ${componentName} = ({ component, updateValue }) => {
	return <p className="tomato bold text-l">👍🏽 {component.label} works!</p>;
};
`;

const componentFileContent = (
  componentName = DEFAULT_COMPONENT_NAME,
  pluginName = DEFAULT_PLUGIN_NAME
) => `import { Components } from "@formio/react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";

import customTabEditForm from "./custom.form.json";
import * as globalEnv from "#env/index.js";
import * as ${kebabToCamel(pluginName)}Env from "#plugins/${pluginName}/env/index.js";
import { BuilderPlaceholder } from "#util/BuilderPlaceholder.jsx";
import { ${componentName} } from "./${componentName}.jsx";

const FormioComponent = Components.components.container;

// Use this custom error instead of the default generic error
class ${componentName}Error extends Error {}

export default class ${componentName}Component extends FormioComponent {
	/**
	 * It is not really necessary but it simplifies and centralizes
	 * the configuration of the component type for Formio
	 * 
	 * @todo change this random value an then remove this _todo_
	 */
	static get COMPONENT_TYPE() {
		return "${kebabToCamel(pluginName)}-${crypto.randomUUID().replaceAll('-', '')}";
	}

	/**
	 * @param {...import('formiojs').ExtendedComponentSchema} extend
	 */
	static schema(...extend) {
		return FormioComponent.schema({
			type: ${componentName}Component.COMPONENT_TYPE,
			key: ${componentName}Component.COMPONENT_TYPE,
			label: "${componentName} Component",
			...extend,
		});
	}

	static get builderInfo() {
		return {
			title: "${componentName} Component",
			icon: "superpowers", // https://fontawesome.com/v4/icons/
			preview: true, // This is how you can hide/show the preview column in editForm modal
			schema: ${componentName}Component.schema(),
		};
	}

	static editForm = (...extend) => {
		return Components.baseEditForm(
			[
				// customize your editForm tabs
				customTabEditForm
			],
			...extend,
		);
	};

	render() {
		const componentType = ${componentName}Component.COMPONENT_TYPE;
		return super.render(
			\`<div id="\${componentType}-\${this.component.id}"></div>\`,
		);
	}

	/**
	 * @param {Element} element
	 */
	attach(element) {
		this.reactRoot?.unmount();
		super.attach(element);
		
		const componentType = ${componentName}Component.COMPONENT_TYPE;
		const elem = element.querySelector(
			\`#\${componentType}-\${this.component.id}\`
		);
		if (!elem) return;
		this.reactRoot = createRoot(elem);

		if (this.builderMode)
			return this.reactRoot.render(
				createElement(BuilderPlaceholder, { label: this.component.label }),
			);

		this.reactRoot.render(
			createElement(${componentName}, {
				component: this.component,
				updateValue: this.updateValue.bind(this),
			}),
		);
	}

	detach() {
		this.reactRoot?.unmount();
		super.detach();
	}
}
`;

export const createComponent = ({
  componentName = DEFAULT_COMPONENT_NAME,
  pluginName = DEFAULT_PLUGIN_NAME,
}) => {
  const pluginsPath = resolve(import.meta.dirname, '..', 'src', 'plugins');
  const pluginFolder = join(pluginsPath, pluginName);
  const componentFolder = join(pluginFolder, 'components', componentName);
  const capitalizedComponentName = capitalize(kebabToCamel(componentName));
  const componentFile = {
    path: join(componentFolder, 'index.js'),
    content: componentFileContent(capitalizedComponentName, pluginName),
  };
  const editFormtFile = {
    path: join(componentFolder, 'custom.form.json'),
    content: EDIT_FORM_FILE_CONTENT,
  };
  const jsxComponentFile = {
    path: join(componentFolder, `${capitalizedComponentName}.jsx`),
    content: jsxComponentFileContent(capitalizedComponentName),
  };
  const cssComponentFile = {
    path: join(componentFolder, `${capitalizedComponentName}.css`),
    content: CSS_FILE_CONTENT,
  };

  fs.mkdir(componentFolder, { recursive: true }).then(() => {
    fs.writeFile(componentFile.path, componentFile.content);
    fs.writeFile(editFormtFile.path, editFormtFile.content);
    fs.writeFile(jsxComponentFile.path, jsxComponentFile.content);
    fs.writeFile(cssComponentFile.path, cssComponentFile.content);
  });
};

# OneScript Plugins

---

## Requisitos y recursos

- [nodejs](https://nodejs.org/docs/latest/api/) (v22 o superior)
- [React](http://es.react.dev/)
- [Form.io](https://help.form.io/)

---

## Estructura base del proyecto

```sh
.
├── README.md
├── biome.json
├── index.html
├── jsconfig.json
├── package-lock.json
├── package.json
├── scripts
│   ├── create-component.impl.js
│   ├── create-component.js
│   ├── create-plugin.impl.js
│   ├── create-plugin.js
│   └── helpers
│       └── index.js
├── src
│   ├── env
│   │   └── index.js
│   ├── index.js
│   ├── plugins
│   │   └── example
│   │       ├── components
│   │       │   ├── component-test
│   │       │   │   ├── ComponentTest.css
│   │       │   │   ├── ComponentTest.jsx
│   │       │   │   ├── custom.form.json
│   │       │   │   └── index.js
│   │       │   └── component-test2
│   │       │       ├── ComponentTest2.css
│   │       │       ├── ComponentTest2.jsx
│   │       │       ├── custom.form.json
│   │       │       └── index.js
│   │       ├── env
│   │       │   └── index.js
│   │       ├── index.js
│   │       └── plugin.js
│   └── util
│       ├── BuilderPlaceholder.jsx
│       ├── customEditForm.js
│       └── formio.util.js
├── typings.d.ts
└── vite.config.js

12 directories, 29 files
```

---

## Uso básico

### Crear un nuevo plugin

Para crear un nuevo plugin, ejecuta en tu treminal:

```sh
npm run create:plugin <plugin-name> [...<component-name>]
```

Creará todo el _boilerpate_ necesario para disponibilizar un plugin y tantos componentes como indiquemos <span style="color:gray;">(solo el primero es obligatorio)</span>, ligados a ese plugin. A partir de aquí solo necesitamos añadir la importación del nuevo plugin en `src/index.js` del siguiente modo:

```js
// src/index.js
import Example from '#plugins/example/index.js';
import NewPlugin from '#plugins/new-plugin/index.js'; // importar

const modules = [Example, NewPlugin]; // añadir

if (globalThis.EventEmitter)
  globalThis.EventEmitter.next({
    action: 'builder.modules.add',
    payload: { modules },
  });
else globalThis.Formio?.use(modules);
```

#### Env variables

También, de forma opcional pero recomendable <span style="color: gray;">(si se le va a dar uso)</span> registrar en `vite.config.js` y en `typings.d.ts` los prefijos de variables de entorno generados para este plugin:

```js
// vite.config.js
...
const envPrefixes = [
	"VITE_",
	"OS_",
	// Add here new prefixes for each plugin
	"EXAMPLE_",
	"NEW_PLUGIN_", // prefijo autogenerado (siempre encontraras un ejemplo en src/plugins/<your-plugin>/env/index.js)
];
...
```

```js
// typings.d.ts
/// <reference types="vite/client" />

// Define aquí tus variables de entorno VITE_* , OS_* , EXAMPLE_* ...
interface ImportMetaEnv {
  readonly [key: `VITE_${string}`]: string;
  readonly [key: `OS_${string}`]: string;
  readonly [key: `EXAMPLE_${string}`]: string;
  readonly [key: `NEW_PLUGIN_${string}`]: string; // prefijos (esta característica por el momento no tiene efecto)
  // Agrega más variables según tus necesidades
  readonly OS_ENV_VAR: string;
  readonly OS_API_TEST: string;
  readonly EXAMPLE_ENV_VAR: string;
  // añadir todas las env variables que se deseen usar para tener type-checking
  readonly NEW_PLUGIN_ENV_VAR: string; // Añadir aquí la nueva variable de entorno
}
...
```

---

### Crear un nuevo componente

Para crear un componente dentro de un plugin, ejecuta:

```sh
npm run create:component <plugin-name>:<component-name> ...[<component-name> || <other-plugin>:<component-name>]
```

Creará todo el _boilerpate_ necesario para disponibilizar tantos componentes como indiquemos <span style="color:gray;">(solo el primero es obligatorio)</span> ligados plugin indicado por `<plugin-name>:`. A partir de aquí solo necesitamos añadir la importación del nuevo componente en `src/<plugin-name>/index.js` del siguiente modo:

````js
// src/new-plugin/index.js
import { getComponentsBuilderInfoObject } from "#util/formio.util.js";

// importa asi tus componetes
import AComponent from "./components/a/index.js";
import BComponent from "./components/b/index.js";

/**
 * To include any component on this plugin add them like this:
 *
 * @example
 * ```
 * const components = {
 * 	[SomeComponent.COMPONENT_TYPE]: SomeComponent
 * }
 * ```
 */
const components = {
  // Añade aquí tus componentes para disponibilizarlos en el plugin
	[AComponent.COMPONENT_TYPE]: AComponent,
	[BComponent.COMPONENT_TYPE]: BComponent,
};
...
````

---

### Construir para producción

Para generar una build optimizada para producción, añade en `package.json` en la sección de scripts un comando `"build-prd:<plugin-name>": "cross-env OS_PLUGIN_NAME=<plugin-name> vite build --mode=prd"` tal y como en el ejemplo siguiente:

```json
{
  ...
  "scripts": {
    ...
    "build-prd:new-plugin": "cross-env OS_PLUGIN_NAME=new-plugin vite build --mode=prd",
    ...
  },
  ...
}
```

Y utilizalo así:

```sh
npm run build-prd:<plugin-name>
```

Los archivos generados estarán en la carpeta de salida configurada (por defecto, `dist/`).

---

### Variables de entorno

Para usar variables de entorno en tu código, agrégalas en un archivo `.env` con el prefijo `VITE_`.  
Por ejemplo:

```sh
VITE_API_URL=https://api.ejemplo.com
```

Luego, accede a ellas en tu código JavaScript usando `import.meta.env.VITE_API_URL`.

Para centralizar y clasificar las variables de entorno se crea un environment `src/env/index.js` general para las variables de prefijo `"OS_"`:

```js
// src/env/index.js
export const {
  OS_ENV_VAR: osEnvVar = 'default value', // extraer, renombrar, asignar valor por defecto en caso de no estar disponible y exportar
  OS_API_TEST: osApiTest = 'https://jsonplaceholder.typicode.com/todos/1',
} = import.meta.env;
```

Y otro environment para cada plugin en `src/env/<your-plugin>/index.js` donde debemos extraer las variables definidas con prefijo `"<YOUR_PLUGIN>_"`

```js
// src/env/new-plugin/index.js
export const {
  NEW_PLUGIN_ENV_VAR:
    newPluginEnvVar = 'new-plugin environment variable fallback value',
} = import.meta.env;
```

## Tests

`pnpm test` (Vitest, entorno jsdom). Convención de sufijos para los componentes React-island de Form.io:

| Sufijo                   | Qué prueba                                                                                                                                                                                          |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `*.test.{jsx,js}`        | Unit del componente React aislado: `render(<Component .../>)` con `@testing-library/react`.                                                                                                         |
| `*.formio.test.{jsx,js}` | Integración con la clase Form.io real: `new ComponentClass(schema, ...).attach(element)` y aserción sobre el DOM que Form.io pinta. Cubre la propagación `this.component` → prop `component` → JSX. |

Los `*.formio.test.*` esperan a que el `createRoot().render()` de React se aplique con `waitFor` de `@testing-library/react` (no `setTimeout`), y limpian la instancia en `afterEach` con `instance.destroy()`.

> **Nota:** Solo las variables que comienzan con `VITE_`, `OS_` y `EXAMPLE_` estarán disponibles en el código fuente. Si deseas añadir nuevos prefijos para los plugins creados debes añadir dichos prefijos en `vite.config.js` en la variable `envPrefixes` y tiparlas en `typings.d.ts` tal y como se explica en el punto [_Env variables_](#env-variables).

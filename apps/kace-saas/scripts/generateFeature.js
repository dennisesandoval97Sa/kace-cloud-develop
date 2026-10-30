/*
 * scripts/generateFeature.js
 * Usage: npm run kace -- <feature-name> [--force]
 */

const fs = require("fs").promises;
const path = require("path");
const { exec } = require("child_process");

const rawName = process.argv[2];
const force = process.argv.includes("--force");

if (!rawName) {
    // SONAR-EXC: NODEJS No expone logs porque es server-side
    console.error("Uso: node scripts/generateFeature.js <feature-name> [--force]");
    process.exit(1);
}

const toKebab = (s) =>
    s
        .replace(/([a-z])([A-Z])/g, "$1-$2")
        .replace(/[_\s]+/g, "-")
        .replace(/-+/g, "-")
        .toLowerCase();

const toPascal = (s) =>
    s
        .replace(/[_\-\s]+/g, " ")
        .split(" ")
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join("");

const featureKebab = toKebab(rawName);
const FeaturePascal = toPascal(rawName);
const featureRoot = path.join(process.cwd(), "src_v2", "features", featureKebab);

const files = [
    // pages
    {
        file: path.join(featureRoot, "pages", `${FeaturePascal}Page.jsx`),
        content: `import React from 'react';
import { ${FeaturePascal}List } from '../components/${FeaturePascal}List';

export const ${FeaturePascal}Page = () => {
      return (
            <main data-testid="${featureKebab}-page">
                  <h1>${FeaturePascal}</h1>
                  <${FeaturePascal}List />
            </main>
      );
};
`,
    },

    // components
    {
        file: path.join(featureRoot, "components", `${FeaturePascal}List.jsx`),
        content: `
        import React from 'react';

        export const ${FeaturePascal}List = () => {
          return (
            <section data-testid="${featureKebab}-list">
              <div>Lista de ${FeaturePascal}</div>
            </section>
          );
        };
        `,
    },

    // hooks
    {
        file: path.join(featureRoot, "hooks", `use${FeaturePascal}.hook.js`),
        content: `import { useQuery } from '@tanstack/react-query';
import { fetch${FeaturePascal} } from '../services/${featureKebab}.service';

export const use${FeaturePascal} = (params) => {
  return useQuery(['${featureKebab}', params], () => fetch${FeaturePascal}(params), {
    staleTime: 1000 * 30,
    keepPreviousData: true,
  });
};
`,
    },

    {
        file: path.join(featureRoot, "hooks", `use${FeaturePascal}Item.hook.js`),
        content: `import { useQuery } from '@tanstack/react-query';
import { fetch${FeaturePascal}ById } from '../services/${featureKebab}.service';

export const use${FeaturePascal}Item = (id) => {
  return useQuery(['${featureKebab}', id], () => fetch${FeaturePascal}ById(id));
};
`,
    },

    // services
    {
        file: path.join(featureRoot, "services", `${featureKebab}.service.js`),
        content: `// Ajusta la importación de apiClient según tus aliases (ej: @/platform/apiClient)
import api from '@/platform/apiClient';

export const fetch${FeaturePascal} = async (params) => {
  const { data } = await api.get('/${featureKebab}', { params });
  return data;
};

export const fetch${FeaturePascal}ById = async (id) => {
  const { data } = await api.get(\`/${featureKebab}/\${id}\`);
  return data;
};
`,
    },

    // schemas
    {
        file: path.join(featureRoot, "schemas", `${featureKebab}.schema.js`),
        content: `// Ejemplo de schema. Sustituye por Zod/Joi según tu stack.
export const validate${FeaturePascal} = (payload) => {
  return { valid: true };
};
`,
    },

    // utils
    {
        file: path.join(featureRoot, "utils", `format${FeaturePascal}.util.js`),
        content: `export const format${FeaturePascal} = (item) => {
  return item;
};
`,
    },

    // constants (local a la feature)
    {
        file: path.join(featureRoot, "constants", `${featureKebab}.constants.js`),
        content: `export const ${FeaturePascal.toUpperCase()}_STATUSES = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
};
`,
    },

    // tests unit
    {
        file: path.join(featureRoot, "__tests__/hooks", `use${FeaturePascal}.spec.js`),
        content: `import { describe, it, expect } from 'vitest';
describe('${FeaturePascal} hooks', () => {
  it('placeholder test', () => {
    expect(true).toBe(true);
  });
});
`,
    },

    {
        file: path.join(featureRoot, "__tests__/components", `${FeaturePascal}List.spec.jsx`),
        content: `import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ${FeaturePascal}List } from '../components/${FeaturePascal}List';

describe('${FeaturePascal}List', () => {
  it('renders', () => {
    const { getByTestId } = render(<${FeaturePascal}List />);
    expect(getByTestId('${featureKebab}-list')).toBeTruthy();
  });
});
`,
    },

    // e2e
    {
        file: path.join(featureRoot, "e2e", `${featureKebab}.spec.js`),
        content: `describe('${FeaturePascal} flows', () => {
  it('loads ${featureKebab} page', () => {
    cy.visit('/${featureKebab}');
    cy.get('[data-testid=${featureKebab}-page]').should('exist');
  });
});
`,
    },

    // README
    {
        file: path.join(featureRoot, "README.md"),
        content: `# ${FeaturePascal} Feature

Carpeta generada automáticamente.

Estructura:
- pages/: páginas principales
- components/: UI específica
- hooks/: lógica react-query o de estado local
- services/: consumo de API
- schemas/: validaciones y DTOs
- utils/: helpers internos
- constants/: valores específicos del dominio
- __tests__/: pruebas unitarias
- e2e/: pruebas end-to-end

⚠️ Si esta feature crece mucho, divídela en una nueva carpeta a nivel de /features.
`,
    },
];

async function ensureDir (p) {
    await fs.mkdir(p, { recursive: true });
}

async function writeIfNotExists (filePath, content) {
    const stat = await fs.stat(filePath);
    if (stat && !force) {
        return;
    }
    await fs.writeFile(filePath, content, "utf8");
}

(async () => {
    try {
        for (const f of files) {
            await ensureDir(path.dirname(f.file));
            await writeIfNotExists(f.file, f.content);
        }
        // SONAR-EXC: NODEJS No expone logs porque es server-side
        console.log(`✅ Feature creada: src_v2/features/${featureKebab}`);

        // 🔧 Ejecutar prettier + eslint SOLO sobre la nueva carpeta
        const featurePath = `src_v2/features/${featureKebab}`;
        // SONAR-EXC: NODEJS No expone logs porque es server-side
        console.log(`🧹 Ejecutando Prettier y ESLint sobre: ${featurePath}...`);

        exec(
            `npx prettier --write "${featurePath}"`,
            (prettierErr, prettierOut, prettierErrOut) => {
                if (prettierErr) {
                    // SONAR-EXC: NODEJS No expone logs porque es server-side
                    console.warn("⚠️ Prettier falló, revisa la configuración o instalación.");
                    console.warn(prettierErrOut || prettierErr.message);
                } else {
                    // SONAR-EXC: NODEJS No expone logs porque es server-side
                    console.log("✅ Prettier completado.");
                    if (prettierOut.trim()) {
                        // SONAR-EXC: NODEJS No expone logs porque es server-side
                        console.log(prettierOut.trim());
                    }
                }
            }
        );
    } catch (err) {
        // SONAR-EXC: NODEJS No expone logs porque es server-side
        console.error("❌ Error:", err.message);
        process.exit(1);
    }
})();

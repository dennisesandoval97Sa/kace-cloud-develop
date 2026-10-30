import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import { viteExternalsPlugin } from 'vite-plugin-externals';

const ALLOWED_ENVS = Object.freeze({
  loc: 'local',
  dev: 'development',
  prd: 'production',
});
const projectRoot = import.meta.dirname;
const sourcePath = resolve(projectRoot, 'src');
const pluginsPath = resolve(sourcePath, 'plugins');
const server = { port: 5174, open: true, hmr: true, historyApiFallback: true };
const envPrefixes = [
  'VITE_',
  'OS_',
  // Add here new prefixes for each plugin
  'EXAMPLE_',
];

/**
 * These dependencies shouldn't be added to the bundle
 * because they are already included in OneScript.
 */
const externalDeps = {
  react: 'react',
  'react-dom': 'reactDOMClient',
  formiojs: 'formiojs',
};

export default defineConfig(({ mode, command }) => {
  const environment = ALLOWED_ENVS[mode] ?? ALLOWED_ENVS.dev;
  const { OS_PLUGIN_NAME: pluginName = 'kace' } = loadEnv(
    mode,
    projectRoot,
    envPrefixes
  );
  const externals = mode === 'prd' || mode === 'production' ? externalDeps : {};
  const build = {
    // UMD de un solo archivo: ~1 MB es habitual; el umbral 500 kB de Vite no aplica igual que en SPAs.
    chunkSizeWarningLimit: 1200,
    sourcemap: true,
    rollupOptions: {
      input: { [pluginName]: resolve(pluginsPath, pluginName, 'plugin.js') },
      output: {
        entryFileNames: '[name].plugin.umd.js',
        format: 'umd',
      },
    },
  };

  return {
    envPrefix: envPrefixes,
    mode: environment,
    plugins: [react(), viteExternalsPlugin(externals)],
    css: { modules: { localsConvention: 'camelCaseOnly' } },
    resolve: { alias: { '#': sourcePath } },
    ...(command === 'serve' && { server }),
    ...(command === 'build' && { build }),
  };
});

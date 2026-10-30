import { argv } from 'node:process';
import { createPlugin } from './create-plugin.impl.js';

const [, , pluginName, ...componentNames] = argv;
createPlugin(pluginName, ...componentNames);

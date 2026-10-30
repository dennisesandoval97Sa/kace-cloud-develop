import { AsistenciaNotificacionesRoboticaStack } from '../lib/asistencia_notificaciones_robotica-stack';
import { config } from 'dotenv';
import path from 'node:path'; // SONAR-EXC: importación nativa de NODE, no requiere dependencia.
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { App } from 'aws-cdk-lib';

config({ path: '../../.env' });

const app = new App();
const props = {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION,
    },
};

const kProps: KApiStackProps = {
    ...KApiStack.KProps(),
    pathHandler: path.join(__dirname, '../src/handler.mjs'),
};

new AsistenciaNotificacionesRoboticaStack(app, 'AsistenciaNotificacionesRoboticaStack', props, kProps); // SONAR-EXC

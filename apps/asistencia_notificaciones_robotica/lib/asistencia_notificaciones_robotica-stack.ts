import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { Duration, StackProps } from 'aws-cdk-lib';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';

export class AsistenciaNotificacionesRoboticaStack extends KApiStack {
    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        const path = 'asistencia-notificaciones-robotica';

        const lambdaFunction = this.getNodejsFunction(path, {
            timeout: Duration.seconds(30),
            memorySize: 256,
            bundling: {
                nodeModules: ['pg', 'knex', 'nodemailer'],
                forceDockerBundling: true,
            },
        });

        // KApiStack solo inyecta DB_* en environment === 'local'; en staging/prod hay que inyectarlas aquí.
        lambdaFunction.addEnvironment('DB_HOST', process.env.DB_HOST as string);
        lambdaFunction.addEnvironment('DB_PORT', process.env.DB_PORT as string);
        lambdaFunction.addEnvironment('DB_USER', process.env.DB_USER as string);
        lambdaFunction.addEnvironment('DB_PASSWORD', process.env.DB_PASSWORD as string);
        lambdaFunction.addEnvironment('DB_DATABASE', process.env.DB_DATABASE as string);

        lambdaFunction.addEnvironment('ROBOTICA_DB_SCHEMA', process.env.ROBOTICA_DB_SCHEMA ?? 'asistencia');
        lambdaFunction.addEnvironment('ROBOTICA_THRESHOLD_MINUTES', process.env.ROBOTICA_THRESHOLD_MINUTES ?? '30');
        lambdaFunction.addEnvironment('ROBOTICA_ALERT_RECIPIENTS', process.env.ROBOTICA_ALERT_RECIPIENTS as string);

        lambdaFunction.addEnvironment('SMTP_HOST', process.env.SMTP_HOST as string);
        lambdaFunction.addEnvironment('SMTP_PORT', process.env.SMTP_PORT as string);
        lambdaFunction.addEnvironment('SMTP_USER', process.env.SMTP_USER as string);
        lambdaFunction.addEnvironment('SMTP_PASSWORD', process.env.SMTP_PASS as string);
        lambdaFunction.addEnvironment('SMTP_FROM', process.env.SMTP_EMAIL as string);
        lambdaFunction.addEnvironment('SMTP_SECURE', process.env.SMTP_SECURE ?? '');

        const scheduleRule = new Rule(this, `${path}ScheduleRule`, {
            schedule: Schedule.expression('cron(*/10 * * * ? *)'), // cada 10 minutos
            description:
                'Heartbeat monitor de aux_notificaciones_robotica: alerta por SMTP si MAX(updated_at) supera el umbral',
        });

        scheduleRule.addTarget(new LambdaFunction(lambdaFunction));
    }
}

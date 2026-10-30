import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { StackProps } from 'aws-cdk-lib';

export class CaseReclassifyPrecheckStack extends KApiStack {
    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        // Servicio propio y no una ruta de 'case-reclassification', que es priority:true y
        // leeria del primary.
        this.setDefaultOptions('case-reclassification-precheck');
    }
}

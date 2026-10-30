import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { StackProps } from 'aws-cdk-lib';

export class FieldListStack extends KApiStack {
    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        this.setDefaultOptions('schema-fields');
    }

    public corsPreflightDefaultOptions() {
        const base = super.corsPreflightDefaultOptions();
        base.allowHeaders.push('X-Public-Key')
        return base;
    }
}

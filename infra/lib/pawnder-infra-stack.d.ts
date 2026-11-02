import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as lightsail from 'aws-cdk-lib/aws-lightsail';
import { Construct } from 'constructs';
export interface PawnderInfraStackProps extends cdk.StackProps {
    domainName: string;
    certificateArn?: string;
    availabilityZone?: string;
    bundleId?: string;
    blueprintId?: string;
}
export declare class PawnderInfraStack extends cdk.Stack {
    readonly frontendBucket: s3.Bucket;
    readonly distribution: cloudfront.Distribution;
    readonly lightsailInstance: lightsail.CfnInstance;
    readonly lightsailStaticIp: lightsail.CfnStaticIp;
    constructor(scope: Construct, id: string, props: PawnderInfraStackProps);
}

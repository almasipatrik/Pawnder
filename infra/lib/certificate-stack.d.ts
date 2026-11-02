import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';
export interface CertificateStackProps extends cdk.StackProps {
    domainName: string;
}
/**
 * Creates an ACM SSL certificate in us-east-1 (required for CloudFront distributions).
 * Uses DNS validation. CloudFormation will output the CNAME record name and value
 * that needs to be added to the Rackhost DNS manager.
 */
export declare class CertificateStack extends cdk.Stack {
    readonly certificate: acm.ICertificate;
    readonly certificateArn: string;
    constructor(scope: Construct, id: string, props: CertificateStackProps);
}

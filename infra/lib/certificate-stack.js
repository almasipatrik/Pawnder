"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CertificateStack = void 0;
const cdk = require("aws-cdk-lib");
const acm = require("aws-cdk-lib/aws-certificatemanager");
const ssm = require("aws-cdk-lib/aws-ssm");
/**
 * Creates an ACM SSL certificate in us-east-1 (required for CloudFront distributions).
 * Uses DNS validation. CloudFormation will output the CNAME record name and value
 * that needs to be added to the Rackhost DNS manager.
 */
class CertificateStack extends cdk.Stack {
    certificate;
    certificateArn;
    constructor(scope, id, props) {
        super(scope, id, props);
        const { domainName } = props;
        // Request wildcard SSL certificate covering pawnder.hu and *.pawnder.hu
        const cert = new acm.Certificate(this, 'PawnderWildcardCertificate', {
            domainName,
            subjectAlternativeNames: [`*.${domainName}`],
            validation: acm.CertificateValidation.fromDns(),
        });
        this.certificate = cert;
        this.certificateArn = cert.certificateArn;
        // Store certificate ARN in SSM Parameter Store in us-east-1 for cross-stack reference
        new ssm.StringParameter(this, 'PawnderCertArnParam', {
            parameterName: '/pawnder/acm/cert-arn',
            stringValue: cert.certificateArn,
            description: `ACM Wildcard Certificate ARN for ${domainName}`,
        });
        // Outputs for the user
        new cdk.CfnOutput(this, 'CertificateArnOutput', {
            value: cert.certificateArn,
            description: 'ACM Certificate ARN (us-east-1)',
            exportName: 'PawnderCertificateArn',
        });
        new cdk.CfnOutput(this, 'RackhostDnsValidationNote', {
            value: `Please check AWS Certificate Manager console in us-east-1 to copy the validation CNAME record to Rackhost DNS!`,
            description: 'Rackhost DNS validation instruction',
        });
    }
}
exports.CertificateStack = CertificateStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2VydGlmaWNhdGUtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJjZXJ0aWZpY2F0ZS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtQ0FBbUM7QUFDbkMsMERBQTBEO0FBQzFELDJDQUEyQztBQU8zQzs7OztHQUlHO0FBQ0gsTUFBYSxnQkFBaUIsU0FBUSxHQUFHLENBQUMsS0FBSztJQUM3QixXQUFXLENBQW1CO0lBQzlCLGNBQWMsQ0FBUztJQUV2QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQTRCO1FBQ3BFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sRUFBRSxVQUFVLEVBQUUsR0FBRyxLQUFLLENBQUM7UUFFN0Isd0VBQXdFO1FBQ3hFLE1BQU0sSUFBSSxHQUFHLElBQUksR0FBRyxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsNEJBQTRCLEVBQUU7WUFDbkUsVUFBVTtZQUNWLHVCQUF1QixFQUFFLENBQUMsS0FBSyxVQUFVLEVBQUUsQ0FBQztZQUM1QyxVQUFVLEVBQUUsR0FBRyxDQUFDLHFCQUFxQixDQUFDLE9BQU8sRUFBRTtTQUNoRCxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQztRQUN4QixJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUM7UUFFMUMsc0ZBQXNGO1FBQ3RGLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDbkQsYUFBYSxFQUFFLHVCQUF1QjtZQUN0QyxXQUFXLEVBQUUsSUFBSSxDQUFDLGNBQWM7WUFDaEMsV0FBVyxFQUFFLG9DQUFvQyxVQUFVLEVBQUU7U0FDOUQsQ0FBQyxDQUFDO1FBRUgsdUJBQXVCO1FBQ3ZCLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsc0JBQXNCLEVBQUU7WUFDOUMsS0FBSyxFQUFFLElBQUksQ0FBQyxjQUFjO1lBQzFCLFdBQVcsRUFBRSxpQ0FBaUM7WUFDOUMsVUFBVSxFQUFFLHVCQUF1QjtTQUNwQyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLDJCQUEyQixFQUFFO1lBQ25ELEtBQUssRUFBRSxnSEFBZ0g7WUFDdkgsV0FBVyxFQUFFLHFDQUFxQztTQUNuRCxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUF0Q0QsNENBc0NDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGFjbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2VydGlmaWNhdGVtYW5hZ2VyJztcbmltcG9ydCAqIGFzIHNzbSBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc3NtJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIENlcnRpZmljYXRlU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgZG9tYWluTmFtZTogc3RyaW5nO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYW4gQUNNIFNTTCBjZXJ0aWZpY2F0ZSBpbiB1cy1lYXN0LTEgKHJlcXVpcmVkIGZvciBDbG91ZEZyb250IGRpc3RyaWJ1dGlvbnMpLlxuICogVXNlcyBETlMgdmFsaWRhdGlvbi4gQ2xvdWRGb3JtYXRpb24gd2lsbCBvdXRwdXQgdGhlIENOQU1FIHJlY29yZCBuYW1lIGFuZCB2YWx1ZVxuICogdGhhdCBuZWVkcyB0byBiZSBhZGRlZCB0byB0aGUgUmFja2hvc3QgRE5TIG1hbmFnZXIuXG4gKi9cbmV4cG9ydCBjbGFzcyBDZXJ0aWZpY2F0ZVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IGNlcnRpZmljYXRlOiBhY20uSUNlcnRpZmljYXRlO1xuICBwdWJsaWMgcmVhZG9ubHkgY2VydGlmaWNhdGVBcm46IHN0cmluZztcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogQ2VydGlmaWNhdGVTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zdCB7IGRvbWFpbk5hbWUgfSA9IHByb3BzO1xuXG4gICAgLy8gUmVxdWVzdCB3aWxkY2FyZCBTU0wgY2VydGlmaWNhdGUgY292ZXJpbmcgcGF3bmRlci5odSBhbmQgKi5wYXduZGVyLmh1XG4gICAgY29uc3QgY2VydCA9IG5ldyBhY20uQ2VydGlmaWNhdGUodGhpcywgJ1Bhd25kZXJXaWxkY2FyZENlcnRpZmljYXRlJywge1xuICAgICAgZG9tYWluTmFtZSxcbiAgICAgIHN1YmplY3RBbHRlcm5hdGl2ZU5hbWVzOiBbYCouJHtkb21haW5OYW1lfWBdLFxuICAgICAgdmFsaWRhdGlvbjogYWNtLkNlcnRpZmljYXRlVmFsaWRhdGlvbi5mcm9tRG5zKCksXG4gICAgfSk7XG5cbiAgICB0aGlzLmNlcnRpZmljYXRlID0gY2VydDtcbiAgICB0aGlzLmNlcnRpZmljYXRlQXJuID0gY2VydC5jZXJ0aWZpY2F0ZUFybjtcblxuICAgIC8vIFN0b3JlIGNlcnRpZmljYXRlIEFSTiBpbiBTU00gUGFyYW1ldGVyIFN0b3JlIGluIHVzLWVhc3QtMSBmb3IgY3Jvc3Mtc3RhY2sgcmVmZXJlbmNlXG4gICAgbmV3IHNzbS5TdHJpbmdQYXJhbWV0ZXIodGhpcywgJ1Bhd25kZXJDZXJ0QXJuUGFyYW0nLCB7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnL3Bhd25kZXIvYWNtL2NlcnQtYXJuJyxcbiAgICAgIHN0cmluZ1ZhbHVlOiBjZXJ0LmNlcnRpZmljYXRlQXJuLFxuICAgICAgZGVzY3JpcHRpb246IGBBQ00gV2lsZGNhcmQgQ2VydGlmaWNhdGUgQVJOIGZvciAke2RvbWFpbk5hbWV9YCxcbiAgICB9KTtcblxuICAgIC8vIE91dHB1dHMgZm9yIHRoZSB1c2VyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0NlcnRpZmljYXRlQXJuT3V0cHV0Jywge1xuICAgICAgdmFsdWU6IGNlcnQuY2VydGlmaWNhdGVBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0FDTSBDZXJ0aWZpY2F0ZSBBUk4gKHVzLWVhc3QtMSknLFxuICAgICAgZXhwb3J0TmFtZTogJ1Bhd25kZXJDZXJ0aWZpY2F0ZUFybicsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUmFja2hvc3REbnNWYWxpZGF0aW9uTm90ZScsIHtcbiAgICAgIHZhbHVlOiBgUGxlYXNlIGNoZWNrIEFXUyBDZXJ0aWZpY2F0ZSBNYW5hZ2VyIGNvbnNvbGUgaW4gdXMtZWFzdC0xIHRvIGNvcHkgdGhlIHZhbGlkYXRpb24gQ05BTUUgcmVjb3JkIHRvIFJhY2tob3N0IEROUyFgLFxuICAgICAgZGVzY3JpcHRpb246ICdSYWNraG9zdCBETlMgdmFsaWRhdGlvbiBpbnN0cnVjdGlvbicsXG4gICAgfSk7XG4gIH1cbn1cblxuIl19
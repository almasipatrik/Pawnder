"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PawnderInfraStack = void 0;
const cdk = require("aws-cdk-lib");
const s3 = require("aws-cdk-lib/aws-s3");
const cloudfront = require("aws-cdk-lib/aws-cloudfront");
const origins = require("aws-cdk-lib/aws-cloudfront-origins");
const acm = require("aws-cdk-lib/aws-certificatemanager");
const lightsail = require("aws-cdk-lib/aws-lightsail");
class PawnderInfraStack extends cdk.Stack {
    frontendBucket;
    distribution;
    lightsailInstance;
    lightsailStaticIp;
    constructor(scope, id, props) {
        super(scope, id, props);
        const { domainName, certificateArn, availabilityZone = 'eu-central-1a', bundleId = 'micro_3_0', blueprintId = 'ubuntu_24_04', } = props;
        // =========================================================================
        // 1. FRONTEND: S3 BUCKET (Private + Encrypted)
        // =========================================================================
        this.frontendBucket = new s3.Bucket(this, 'PawnderFrontendBucket', {
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: false,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            enforceSSL: true,
        });
        // =========================================================================
        // 2. FRONTEND: CLOUDFRONT DISTRIBUTION (CDN + SSL)
        // =========================================================================
        let certificate;
        let customDomainNames;
        if (certificateArn) {
            certificate = acm.Certificate.fromCertificateArn(this, 'PawnderCertificate', certificateArn);
            customDomainNames = [domainName, `www.${domainName}`];
        }
        const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(this.frontendBucket);
        this.distribution = new cloudfront.Distribution(this, 'PawnderCloudFrontDistribution', {
            comment: 'Pawnder Frontend CDN Distribution (S3 + Next.js static export)',
            defaultRootObject: 'index.html',
            certificate,
            domainNames: customDomainNames,
            defaultBehavior: {
                origin: s3Origin,
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
                cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
                compress: true,
            },
            // Client-side single page app routing for Next.js (403/404 -> /index.html)
            errorResponses: [
                {
                    httpStatus: 403,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html',
                    ttl: cdk.Duration.minutes(5),
                },
                {
                    httpStatus: 404,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html',
                    ttl: cdk.Duration.minutes(5),
                },
            ],
        });
        // =========================================================================
        // 3. BACKEND: AWS LIGHTSAIL INSTANCE (Docker host for NestJS + DB + Scraper)
        // =========================================================================
        const userDataScript = `#!/bin/bash
set -e

# Update system packages
apt-get update -y
apt-get install -y ca-certificates curl gnupg git ufw

# Set up 2GB swap space (crucial for 1GB RAM instance to safely run Docker builds/Postgres)
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# Install official Docker Engine & Docker Compose
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable docker
systemctl start docker
usermod -aG docker ubuntu

# Setup Pawnder application directory
mkdir -p /opt/pawnder
chown -R ubuntu:ubuntu /opt/pawnder

# Firewall rules
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "Pawnder Lightsail instance provisioning completed successfully!" > /var/log/pawnder-init.log
`;
        this.lightsailInstance = new lightsail.CfnInstance(this, 'PawnderBackendInstance', {
            instanceName: 'pawnder-backend-server',
            availabilityZone,
            bundleId,
            blueprintId,
            userData: userDataScript,
            networking: {
                ports: [
                    { fromPort: 22, toPort: 22, protocol: 'tcp' },
                    { fromPort: 80, toPort: 80, protocol: 'tcp' },
                    { fromPort: 443, toPort: 443, protocol: 'tcp' },
                ],
            },
            tags: [
                { key: 'Project', value: 'Pawnder' },
                { key: 'Component', value: 'Backend-API-Database' },
            ],
        });
        // Fixed Static IPv4 address for the Lightsail instance
        this.lightsailStaticIp = new lightsail.CfnStaticIp(this, 'PawnderBackendStaticIp', {
            staticIpName: 'pawnder-backend-static-ip',
            attachedTo: this.lightsailInstance.instanceName,
        });
        this.lightsailStaticIp.addDependency(this.lightsailInstance);
        // =========================================================================
        // 4. CLOUDFORMATION OUTPUTS (All DNS records needed for Rackhost)
        // =========================================================================
        new cdk.CfnOutput(this, 'FrontendS3BucketName', {
            value: this.frontendBucket.bucketName,
            description: 'S3 Bucket name for frontend static deployment',
        });
        new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
            value: this.distribution.distributionId,
            description: 'CloudFront Distribution ID',
        });
        new cdk.CfnOutput(this, 'CloudFrontDomainName', {
            value: this.distribution.distributionDomainName,
            description: 'CloudFront Domain Name (Target for pawnder.hu CNAME / ALIAS in Rackhost)',
        });
        new cdk.CfnOutput(this, 'LightsailStaticIpAddress', {
            value: this.lightsailStaticIp.attrIpAddress,
            description: 'Lightsail Static Public IP (Target for api.pawnder.hu A-record in Rackhost)',
        });
        new cdk.CfnOutput(this, 'RackhostDnsConfigSummary', {
            value: `1) CNAME pawnder.hu -> ${this.distribution.distributionDomainName} | 2) A-record api.pawnder.hu -> ${this.lightsailStaticIp.attrIpAddress}`,
            description: 'Quick Rackhost DNS instructions',
        });
    }
}
exports.PawnderInfraStack = PawnderInfraStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGF3bmRlci1pbmZyYS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInBhd25kZXItaW5mcmEtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBQ25DLHlDQUF5QztBQUN6Qyx5REFBeUQ7QUFDekQsOERBQThEO0FBQzlELDBEQUEwRDtBQUMxRCx1REFBdUQ7QUFXdkQsTUFBYSxpQkFBa0IsU0FBUSxHQUFHLENBQUMsS0FBSztJQUM5QixjQUFjLENBQVk7SUFDMUIsWUFBWSxDQUEwQjtJQUN0QyxpQkFBaUIsQ0FBd0I7SUFDekMsaUJBQWlCLENBQXdCO0lBRXpELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBNkI7UUFDckUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxFQUNKLFVBQVUsRUFDVixjQUFjLEVBQ2QsZ0JBQWdCLEdBQUcsZUFBZSxFQUNsQyxRQUFRLEdBQUcsV0FBVyxFQUN0QixXQUFXLEdBQUcsY0FBYyxHQUM3QixHQUFHLEtBQUssQ0FBQztRQUVWLDRFQUE0RTtRQUM1RSwrQ0FBK0M7UUFDL0MsNEVBQTRFO1FBQzVFLElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBSSxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtZQUNqRSxhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxPQUFPO1lBQ3hDLGlCQUFpQixFQUFFLEtBQUs7WUFDeEIsaUJBQWlCLEVBQUUsRUFBRSxDQUFDLGlCQUFpQixDQUFDLFNBQVM7WUFDakQsVUFBVSxFQUFFLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVO1lBQzFDLFVBQVUsRUFBRSxJQUFJO1NBQ2pCLENBQUMsQ0FBQztRQUVILDRFQUE0RTtRQUM1RSxtREFBbUQ7UUFDbkQsNEVBQTRFO1FBQzVFLElBQUksV0FBeUMsQ0FBQztRQUM5QyxJQUFJLGlCQUF1QyxDQUFDO1FBRTVDLElBQUksY0FBYyxFQUFFLENBQUM7WUFDbkIsV0FBVyxHQUFHLEdBQUcsQ0FBQyxXQUFXLENBQUMsa0JBQWtCLENBQzlDLElBQUksRUFDSixvQkFBb0IsRUFDcEIsY0FBYyxDQUNmLENBQUM7WUFDRixpQkFBaUIsR0FBRyxDQUFDLFVBQVUsRUFBRSxPQUFPLFVBQVUsRUFBRSxDQUFDLENBQUM7UUFDeEQsQ0FBQztRQUVELE1BQU0sUUFBUSxHQUFHLE9BQU8sQ0FBQyxjQUFjLENBQUMsdUJBQXVCLENBQzdELElBQUksQ0FBQyxjQUFjLENBQ3BCLENBQUM7UUFFRixJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksVUFBVSxDQUFDLFlBQVksQ0FDN0MsSUFBSSxFQUNKLCtCQUErQixFQUMvQjtZQUNFLE9BQU8sRUFBRSxnRUFBZ0U7WUFDekUsaUJBQWlCLEVBQUUsWUFBWTtZQUMvQixXQUFXO1lBQ1gsV0FBVyxFQUFFLGlCQUFpQjtZQUM5QixlQUFlLEVBQUU7Z0JBQ2YsTUFBTSxFQUFFLFFBQVE7Z0JBQ2hCLG9CQUFvQixFQUNsQixVQUFVLENBQUMsb0JBQW9CLENBQUMsaUJBQWlCO2dCQUNuRCxjQUFjLEVBQUUsVUFBVSxDQUFDLGNBQWMsQ0FBQyxzQkFBc0I7Z0JBQ2hFLGFBQWEsRUFBRSxVQUFVLENBQUMsYUFBYSxDQUFDLHNCQUFzQjtnQkFDOUQsV0FBVyxFQUFFLFVBQVUsQ0FBQyxXQUFXLENBQUMsaUJBQWlCO2dCQUNyRCxRQUFRLEVBQUUsSUFBSTthQUNmO1lBQ0QsMkVBQTJFO1lBQzNFLGNBQWMsRUFBRTtnQkFDZDtvQkFDRSxVQUFVLEVBQUUsR0FBRztvQkFDZixrQkFBa0IsRUFBRSxHQUFHO29CQUN2QixnQkFBZ0IsRUFBRSxhQUFhO29CQUMvQixHQUFHLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2lCQUM3QjtnQkFDRDtvQkFDRSxVQUFVLEVBQUUsR0FBRztvQkFDZixrQkFBa0IsRUFBRSxHQUFHO29CQUN2QixnQkFBZ0IsRUFBRSxhQUFhO29CQUMvQixHQUFHLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2lCQUM3QjthQUNGO1NBQ0YsQ0FDRixDQUFDO1FBRUYsNEVBQTRFO1FBQzVFLDZFQUE2RTtRQUM3RSw0RUFBNEU7UUFDNUUsTUFBTSxjQUFjLEdBQUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQXVDMUIsQ0FBQztRQUVFLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLFNBQVMsQ0FBQyxXQUFXLENBQ2hELElBQUksRUFDSix3QkFBd0IsRUFDeEI7WUFDRSxZQUFZLEVBQUUsd0JBQXdCO1lBQ3RDLGdCQUFnQjtZQUNoQixRQUFRO1lBQ1IsV0FBVztZQUNYLFFBQVEsRUFBRSxjQUFjO1lBQ3hCLFVBQVUsRUFBRTtnQkFDVixLQUFLLEVBQUU7b0JBQ0wsRUFBRSxRQUFRLEVBQUUsRUFBRSxFQUFFLE1BQU0sRUFBRSxFQUFFLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRTtvQkFDN0MsRUFBRSxRQUFRLEVBQUUsRUFBRSxFQUFFLE1BQU0sRUFBRSxFQUFFLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRTtvQkFDN0MsRUFBRSxRQUFRLEVBQUUsR0FBRyxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRTtpQkFDaEQ7YUFDRjtZQUNELElBQUksRUFBRTtnQkFDSixFQUFFLEdBQUcsRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRTtnQkFDcEMsRUFBRSxHQUFHLEVBQUUsV0FBVyxFQUFFLEtBQUssRUFBRSxzQkFBc0IsRUFBRTthQUNwRDtTQUNGLENBQ0YsQ0FBQztRQUVGLHVEQUF1RDtRQUN2RCxJQUFJLENBQUMsaUJBQWlCLEdBQUcsSUFBSSxTQUFTLENBQUMsV0FBVyxDQUNoRCxJQUFJLEVBQ0osd0JBQXdCLEVBQ3hCO1lBQ0UsWUFBWSxFQUFFLDJCQUEyQjtZQUN6QyxVQUFVLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFlBQVk7U0FDaEQsQ0FDRixDQUFDO1FBQ0YsSUFBSSxDQUFDLGlCQUFpQixDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQztRQUU3RCw0RUFBNEU7UUFDNUUsa0VBQWtFO1FBQ2xFLDRFQUE0RTtRQUM1RSxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHNCQUFzQixFQUFFO1lBQzlDLEtBQUssRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLFVBQVU7WUFDckMsV0FBVyxFQUFFLCtDQUErQztTQUM3RCxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLDBCQUEwQixFQUFFO1lBQ2xELEtBQUssRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLGNBQWM7WUFDdkMsV0FBVyxFQUFFLDRCQUE0QjtTQUMxQyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHNCQUFzQixFQUFFO1lBQzlDLEtBQUssRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLHNCQUFzQjtZQUMvQyxXQUFXLEVBQ1QsMEVBQTBFO1NBQzdFLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsMEJBQTBCLEVBQUU7WUFDbEQsS0FBSyxFQUFFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxhQUFhO1lBQzNDLFdBQVcsRUFDVCw2RUFBNkU7U0FDaEYsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSwwQkFBMEIsRUFBRTtZQUNsRCxLQUFLLEVBQUUsMEJBQTBCLElBQUksQ0FBQyxZQUFZLENBQUMsc0JBQXNCLG9DQUFvQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsYUFBYSxFQUFFO1lBQ25KLFdBQVcsRUFBRSxpQ0FBaUM7U0FDL0MsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBOUxELDhDQThMQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0ICogYXMgY2xvdWRmcm9udCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udCc7XG5pbXBvcnQgKiBhcyBvcmlnaW5zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250LW9yaWdpbnMnO1xuaW1wb3J0ICogYXMgYWNtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jZXJ0aWZpY2F0ZW1hbmFnZXInO1xuaW1wb3J0ICogYXMgbGlnaHRzYWlsIGZyb20gJ2F3cy1jZGstbGliL2F3cy1saWdodHNhaWwnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGF3bmRlckluZnJhU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgZG9tYWluTmFtZTogc3RyaW5nO1xuICBjZXJ0aWZpY2F0ZUFybj86IHN0cmluZztcbiAgYXZhaWxhYmlsaXR5Wm9uZT86IHN0cmluZztcbiAgYnVuZGxlSWQ/OiBzdHJpbmc7XG4gIGJsdWVwcmludElkPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgUGF3bmRlckluZnJhU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgZnJvbnRlbmRCdWNrZXQ6IHMzLkJ1Y2tldDtcbiAgcHVibGljIHJlYWRvbmx5IGRpc3RyaWJ1dGlvbjogY2xvdWRmcm9udC5EaXN0cmlidXRpb247XG4gIHB1YmxpYyByZWFkb25seSBsaWdodHNhaWxJbnN0YW5jZTogbGlnaHRzYWlsLkNmbkluc3RhbmNlO1xuICBwdWJsaWMgcmVhZG9ubHkgbGlnaHRzYWlsU3RhdGljSXA6IGxpZ2h0c2FpbC5DZm5TdGF0aWNJcDtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogUGF3bmRlckluZnJhU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgY29uc3Qge1xuICAgICAgZG9tYWluTmFtZSxcbiAgICAgIGNlcnRpZmljYXRlQXJuLFxuICAgICAgYXZhaWxhYmlsaXR5Wm9uZSA9ICdldS1jZW50cmFsLTFhJyxcbiAgICAgIGJ1bmRsZUlkID0gJ21pY3JvXzNfMCcsXG4gICAgICBibHVlcHJpbnRJZCA9ICd1YnVudHVfMjRfMDQnLFxuICAgIH0gPSBwcm9wcztcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyAxLiBGUk9OVEVORDogUzMgQlVDS0VUIChQcml2YXRlICsgRW5jcnlwdGVkKVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICB0aGlzLmZyb250ZW5kQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnUGF3bmRlckZyb250ZW5kQnVja2V0Jywge1xuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIGF1dG9EZWxldGVPYmplY3RzOiBmYWxzZSxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXG4gICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXG4gICAgICBlbmZvcmNlU1NMOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIDIuIEZST05URU5EOiBDTE9VREZST05UIERJU1RSSUJVVElPTiAoQ0ROICsgU1NMKVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICBsZXQgY2VydGlmaWNhdGU6IGFjbS5JQ2VydGlmaWNhdGUgfCB1bmRlZmluZWQ7XG4gICAgbGV0IGN1c3RvbURvbWFpbk5hbWVzOiBzdHJpbmdbXSB8IHVuZGVmaW5lZDtcblxuICAgIGlmIChjZXJ0aWZpY2F0ZUFybikge1xuICAgICAgY2VydGlmaWNhdGUgPSBhY20uQ2VydGlmaWNhdGUuZnJvbUNlcnRpZmljYXRlQXJuKFxuICAgICAgICB0aGlzLFxuICAgICAgICAnUGF3bmRlckNlcnRpZmljYXRlJyxcbiAgICAgICAgY2VydGlmaWNhdGVBcm4sXG4gICAgICApO1xuICAgICAgY3VzdG9tRG9tYWluTmFtZXMgPSBbZG9tYWluTmFtZSwgYHd3dy4ke2RvbWFpbk5hbWV9YF07XG4gICAgfVxuXG4gICAgY29uc3QgczNPcmlnaW4gPSBvcmlnaW5zLlMzQnVja2V0T3JpZ2luLndpdGhPcmlnaW5BY2Nlc3NDb250cm9sKFxuICAgICAgdGhpcy5mcm9udGVuZEJ1Y2tldCxcbiAgICApO1xuXG4gICAgdGhpcy5kaXN0cmlidXRpb24gPSBuZXcgY2xvdWRmcm9udC5EaXN0cmlidXRpb24oXG4gICAgICB0aGlzLFxuICAgICAgJ1Bhd25kZXJDbG91ZEZyb250RGlzdHJpYnV0aW9uJyxcbiAgICAgIHtcbiAgICAgICAgY29tbWVudDogJ1Bhd25kZXIgRnJvbnRlbmQgQ0ROIERpc3RyaWJ1dGlvbiAoUzMgKyBOZXh0LmpzIHN0YXRpYyBleHBvcnQpJyxcbiAgICAgICAgZGVmYXVsdFJvb3RPYmplY3Q6ICdpbmRleC5odG1sJyxcbiAgICAgICAgY2VydGlmaWNhdGUsXG4gICAgICAgIGRvbWFpbk5hbWVzOiBjdXN0b21Eb21haW5OYW1lcyxcbiAgICAgICAgZGVmYXVsdEJlaGF2aW9yOiB7XG4gICAgICAgICAgb3JpZ2luOiBzM09yaWdpbixcbiAgICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTpcbiAgICAgICAgICAgIGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfR0VUX0hFQURfT1BUSU9OUyxcbiAgICAgICAgICBjYWNoZWRNZXRob2RzOiBjbG91ZGZyb250LkNhY2hlZE1ldGhvZHMuQ0FDSEVfR0VUX0hFQURfT1BUSU9OUyxcbiAgICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX09QVElNSVpFRCxcbiAgICAgICAgICBjb21wcmVzczogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgLy8gQ2xpZW50LXNpZGUgc2luZ2xlIHBhZ2UgYXBwIHJvdXRpbmcgZm9yIE5leHQuanMgKDQwMy80MDQgLT4gL2luZGV4Lmh0bWwpXG4gICAgICAgIGVycm9yUmVzcG9uc2VzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgaHR0cFN0YXR1czogNDAzLFxuICAgICAgICAgICAgcmVzcG9uc2VIdHRwU3RhdHVzOiAyMDAsXG4gICAgICAgICAgICByZXNwb25zZVBhZ2VQYXRoOiAnL2luZGV4Lmh0bWwnLFxuICAgICAgICAgICAgdHRsOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGh0dHBTdGF0dXM6IDQwNCxcbiAgICAgICAgICAgIHJlc3BvbnNlSHR0cFN0YXR1czogMjAwLFxuICAgICAgICAgICAgcmVzcG9uc2VQYWdlUGF0aDogJy9pbmRleC5odG1sJyxcbiAgICAgICAgICAgIHR0bDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgKTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyAzLiBCQUNLRU5EOiBBV1MgTElHSFRTQUlMIElOU1RBTkNFIChEb2NrZXIgaG9zdCBmb3IgTmVzdEpTICsgREIgKyBTY3JhcGVyKVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICBjb25zdCB1c2VyRGF0YVNjcmlwdCA9IGAjIS9iaW4vYmFzaFxuc2V0IC1lXG5cbiMgVXBkYXRlIHN5c3RlbSBwYWNrYWdlc1xuYXB0LWdldCB1cGRhdGUgLXlcbmFwdC1nZXQgaW5zdGFsbCAteSBjYS1jZXJ0aWZpY2F0ZXMgY3VybCBnbnVwZyBnaXQgdWZ3XG5cbiMgU2V0IHVwIDJHQiBzd2FwIHNwYWNlIChjcnVjaWFsIGZvciAxR0IgUkFNIGluc3RhbmNlIHRvIHNhZmVseSBydW4gRG9ja2VyIGJ1aWxkcy9Qb3N0Z3JlcylcbmlmIFsgISAtZiAvc3dhcGZpbGUgXTsgdGhlblxuICBmYWxsb2NhdGUgLWwgMkcgL3N3YXBmaWxlXG4gIGNobW9kIDYwMCAvc3dhcGZpbGVcbiAgbWtzd2FwIC9zd2FwZmlsZVxuICBzd2Fwb24gL3N3YXBmaWxlXG4gIGVjaG8gJy9zd2FwZmlsZSBub25lIHN3YXAgc3cgMCAwJyA+PiAvZXRjL2ZzdGFiXG5maVxuXG4jIEluc3RhbGwgb2ZmaWNpYWwgRG9ja2VyIEVuZ2luZSAmIERvY2tlciBDb21wb3NlXG5pbnN0YWxsIC1tIDA3NTUgLWQgL2V0Yy9hcHQva2V5cmluZ3NcbmN1cmwgLWZzU0wgaHR0cHM6Ly9kb3dubG9hZC5kb2NrZXIuY29tL2xpbnV4L3VidW50dS9ncGcgfCBncGcgLS1kZWFybW9yIC1vIC9ldGMvYXB0L2tleXJpbmdzL2RvY2tlci5ncGdcbmNobW9kIGErciAvZXRjL2FwdC9rZXlyaW5ncy9kb2NrZXIuZ3BnXG5lY2hvIFwiZGViIFthcmNoPSQoZHBrZyAtLXByaW50LWFyY2hpdGVjdHVyZSkgc2lnbmVkLWJ5PS9ldGMvYXB0L2tleXJpbmdzL2RvY2tlci5ncGddIGh0dHBzOi8vZG93bmxvYWQuZG9ja2VyLmNvbS9saW51eC91YnVudHUgJChsc2JfcmVsZWFzZSAtY3MpIHN0YWJsZVwiID4gL2V0Yy9hcHQvc291cmNlcy5saXN0LmQvZG9ja2VyLmxpc3RcbmFwdC1nZXQgdXBkYXRlIC15XG5hcHQtZ2V0IGluc3RhbGwgLXkgZG9ja2VyLWNlIGRvY2tlci1jZS1jbGkgY29udGFpbmVyZC5pbyBkb2NrZXItYnVpbGR4LXBsdWdpbiBkb2NrZXItY29tcG9zZS1wbHVnaW5cblxuc3lzdGVtY3RsIGVuYWJsZSBkb2NrZXJcbnN5c3RlbWN0bCBzdGFydCBkb2NrZXJcbnVzZXJtb2QgLWFHIGRvY2tlciB1YnVudHVcblxuIyBTZXR1cCBQYXduZGVyIGFwcGxpY2F0aW9uIGRpcmVjdG9yeVxubWtkaXIgLXAgL29wdC9wYXduZGVyXG5jaG93biAtUiB1YnVudHU6dWJ1bnR1IC9vcHQvcGF3bmRlclxuXG4jIEZpcmV3YWxsIHJ1bGVzXG51ZncgYWxsb3cgMjIvdGNwXG51ZncgYWxsb3cgODAvdGNwXG51ZncgYWxsb3cgNDQzL3RjcFxudWZ3IC0tZm9yY2UgZW5hYmxlXG5cbmVjaG8gXCJQYXduZGVyIExpZ2h0c2FpbCBpbnN0YW5jZSBwcm92aXNpb25pbmcgY29tcGxldGVkIHN1Y2Nlc3NmdWxseSFcIiA+IC92YXIvbG9nL3Bhd25kZXItaW5pdC5sb2dcbmA7XG5cbiAgICB0aGlzLmxpZ2h0c2FpbEluc3RhbmNlID0gbmV3IGxpZ2h0c2FpbC5DZm5JbnN0YW5jZShcbiAgICAgIHRoaXMsXG4gICAgICAnUGF3bmRlckJhY2tlbmRJbnN0YW5jZScsXG4gICAgICB7XG4gICAgICAgIGluc3RhbmNlTmFtZTogJ3Bhd25kZXItYmFja2VuZC1zZXJ2ZXInLFxuICAgICAgICBhdmFpbGFiaWxpdHlab25lLFxuICAgICAgICBidW5kbGVJZCxcbiAgICAgICAgYmx1ZXByaW50SWQsXG4gICAgICAgIHVzZXJEYXRhOiB1c2VyRGF0YVNjcmlwdCxcbiAgICAgICAgbmV0d29ya2luZzoge1xuICAgICAgICAgIHBvcnRzOiBbXG4gICAgICAgICAgICB7IGZyb21Qb3J0OiAyMiwgdG9Qb3J0OiAyMiwgcHJvdG9jb2w6ICd0Y3AnIH0sXG4gICAgICAgICAgICB7IGZyb21Qb3J0OiA4MCwgdG9Qb3J0OiA4MCwgcHJvdG9jb2w6ICd0Y3AnIH0sXG4gICAgICAgICAgICB7IGZyb21Qb3J0OiA0NDMsIHRvUG9ydDogNDQzLCBwcm90b2NvbDogJ3RjcCcgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgICB0YWdzOiBbXG4gICAgICAgICAgeyBrZXk6ICdQcm9qZWN0JywgdmFsdWU6ICdQYXduZGVyJyB9LFxuICAgICAgICAgIHsga2V5OiAnQ29tcG9uZW50JywgdmFsdWU6ICdCYWNrZW5kLUFQSS1EYXRhYmFzZScgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgKTtcblxuICAgIC8vIEZpeGVkIFN0YXRpYyBJUHY0IGFkZHJlc3MgZm9yIHRoZSBMaWdodHNhaWwgaW5zdGFuY2VcbiAgICB0aGlzLmxpZ2h0c2FpbFN0YXRpY0lwID0gbmV3IGxpZ2h0c2FpbC5DZm5TdGF0aWNJcChcbiAgICAgIHRoaXMsXG4gICAgICAnUGF3bmRlckJhY2tlbmRTdGF0aWNJcCcsXG4gICAgICB7XG4gICAgICAgIHN0YXRpY0lwTmFtZTogJ3Bhd25kZXItYmFja2VuZC1zdGF0aWMtaXAnLFxuICAgICAgICBhdHRhY2hlZFRvOiB0aGlzLmxpZ2h0c2FpbEluc3RhbmNlLmluc3RhbmNlTmFtZSxcbiAgICAgIH0sXG4gICAgKTtcbiAgICB0aGlzLmxpZ2h0c2FpbFN0YXRpY0lwLmFkZERlcGVuZGVuY3kodGhpcy5saWdodHNhaWxJbnN0YW5jZSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gNC4gQ0xPVURGT1JNQVRJT04gT1VUUFVUUyAoQWxsIEROUyByZWNvcmRzIG5lZWRlZCBmb3IgUmFja2hvc3QpXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdGcm9udGVuZFMzQnVja2V0TmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmZyb250ZW5kQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1MzIEJ1Y2tldCBuYW1lIGZvciBmcm9udGVuZCBzdGF0aWMgZGVwbG95bWVudCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ2xvdWRGcm9udERpc3RyaWJ1dGlvbklkJywge1xuICAgICAgdmFsdWU6IHRoaXMuZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbklkLFxuICAgICAgZGVzY3JpcHRpb246ICdDbG91ZEZyb250IERpc3RyaWJ1dGlvbiBJRCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ2xvdWRGcm9udERvbWFpbk5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5kaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uRG9tYWluTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOlxuICAgICAgICAnQ2xvdWRGcm9udCBEb21haW4gTmFtZSAoVGFyZ2V0IGZvciBwYXduZGVyLmh1IENOQU1FIC8gQUxJQVMgaW4gUmFja2hvc3QpJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdMaWdodHNhaWxTdGF0aWNJcEFkZHJlc3MnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5saWdodHNhaWxTdGF0aWNJcC5hdHRySXBBZGRyZXNzLFxuICAgICAgZGVzY3JpcHRpb246XG4gICAgICAgICdMaWdodHNhaWwgU3RhdGljIFB1YmxpYyBJUCAoVGFyZ2V0IGZvciBhcGkucGF3bmRlci5odSBBLXJlY29yZCBpbiBSYWNraG9zdCknLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1JhY2tob3N0RG5zQ29uZmlnU3VtbWFyeScsIHtcbiAgICAgIHZhbHVlOiBgMSkgQ05BTUUgcGF3bmRlci5odSAtPiAke3RoaXMuZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWV9IHwgMikgQS1yZWNvcmQgYXBpLnBhd25kZXIuaHUgLT4gJHt0aGlzLmxpZ2h0c2FpbFN0YXRpY0lwLmF0dHJJcEFkZHJlc3N9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUXVpY2sgUmFja2hvc3QgRE5TIGluc3RydWN0aW9ucycsXG4gICAgfSk7XG4gIH1cbn0iXX0=
# Testing the HTML to PDF Lambda Function

This directory contains tests for the HTML to PDF Lambda function. Here's how to use them:

## Automated Tests with Jest

Run the automated tests using Jest:

```bash
npm test
```

These tests mock dependencies like chrome-aws-lambda and AWS SDK to test the function's behavior without making actual external calls.

## Local Manual Testing

There are two local test scripts:

### 1. Simple Local Test

This test uses the original Lambda function but saves the PDF locally:

```bash
npm run test:local
```

This will:
- Call the Lambda handler function with a test URL
- Save the resulting PDF as `test/local-output.pdf`
- If you uncomment the S3 upload section, it will test uploading to S3 (requires AWS credentials)

### 2. Puppeteer Local Test

This test uses a modified version of the Lambda function that uses local Puppeteer instead of chrome-aws-lambda:

```bash
npm run test:puppeteer
```

This is helpful because chrome-aws-lambda isn't optimized for local development environments.

## Testing with AWS SAM or Serverless Framework

For a more complete testing flow, consider using AWS SAM or Serverless Framework:

### AWS SAM

```bash
# Install AWS SAM CLI
# Then run:
sam local invoke -e events/test-event.json
```

### Serverless Framework

```bash
# Install Serverless Framework
# Then run:
serverless invoke local --function html-to-pdf --path events/test-event.json
```

## Test Event Structure

Create a test event file with structure like:

```json
{
  "url": "https://example.com",
  "outputBucket": "my-test-bucket",
  "outputKey": "test.pdf"
}
```

## Configuring AWS Credentials for Local Testing

If you need to test with S3 upload functionality:

1. Configure AWS credentials locally:
   ```
   aws configure
   ```
   
2. Or set environment variables:
   ```
   set AWS_ACCESS_KEY_ID=your_access_key
   set AWS_SECRET_ACCESS_KEY=your_secret_key
   set AWS_REGION=us-east-1
   ``` 
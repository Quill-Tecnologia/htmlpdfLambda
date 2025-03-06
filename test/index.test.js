const AWS = require('aws-sdk');
const AWSMock = require('aws-sdk-mock');
const sinon = require('sinon');
const { handler } = require('../index');

// Mock chrome-aws-lambda
jest.mock('chrome-aws-lambda', () => {
  return {
    puppeteer: {
      launch: jest.fn().mockImplementation(() => {
        return Promise.resolve({
          newPage: jest.fn().mockImplementation(() => {
            return Promise.resolve({
              setUserAgent: jest.fn().mockResolvedValue(undefined),
              setViewport: jest.fn().mockResolvedValue(undefined),
              setRequestInterception: jest.fn().mockResolvedValue(undefined),
              on: jest.fn(),
              goto: jest.fn().mockResolvedValue(undefined),
              waitForSelector: jest.fn().mockResolvedValue(undefined),
              evaluate: jest.fn().mockResolvedValue(undefined),
              pdf: jest.fn().mockResolvedValue(Buffer.from('fake pdf content')),
              close: jest.fn().mockResolvedValue(undefined)
            });
          }),
          close: jest.fn().mockResolvedValue(undefined)
        });
      })
    },
    args: ['--no-sandbox'],
    defaultViewport: { width: 1280, height: 800 },
    executablePath: Promise.resolve('/path/to/chrome'),
    headless: true
  };
});

describe('HTML to PDF Lambda function', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AWSMock.restore();
  });

  test('should return 400 if URL is not provided', async () => {
    const event = {};
    const result = await handler(event, {});

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe('URL parameter is required');
  });

  test('should generate PDF and return base64 when no bucket provided', async () => {
    const event = { url: 'https://example.com' };
    const result = await handler(event, {});

    expect(result.statusCode).toBe(200);
    expect(result.isBase64Encoded).toBe(true);
    expect(result.headers['Content-Type']).toBe('application/pdf');
    expect(result.body).toBeTruthy();
  });

  test('should upload PDF to S3 when bucket is provided', async () => {
    const s3PutObjectMock = jest.fn().mockImplementation(() => {
      return {
        promise: () => Promise.resolve({ ETag: 'mockedETag' })
      };
    });

    AWSMock.setSDKInstance(AWS);
    AWSMock.mock('S3', 'putObject', s3PutObjectMock);

    const event = {
      url: 'https://example.com',
      outputBucket: 'test-bucket',
      outputKey: 'test-key.pdf'
    };

    const result = await handler(event, {});

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).message).toBe('PDF created successfully');
    expect(JSON.parse(result.body).location).toBe('s3://test-bucket/test-key.pdf');
    expect(s3PutObjectMock).toHaveBeenCalledWith({
      Bucket: 'test-bucket',
      Key: 'test-key.pdf',
      Body: expect.any(Buffer),
      ContentType: 'application/pdf'
    });
  });

  test('should handle errors gracefully', async () => {
    const mockError = new Error('Test error');
    jest.requireMock('chrome-aws-lambda').puppeteer.launch.mockRejectedValueOnce(mockError);

    const event = { url: 'https://example.com' };
    const result = await handler(event, {});

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body).error).toBe('Test error');
  });
}); 
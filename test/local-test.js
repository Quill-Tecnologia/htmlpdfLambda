const { handler } = require('../index');
const fs = require('fs');
const path = require('path');

async function runLocalTest() {
  try {
    // Set your test URL
    const url = 'https://us-central1-infosimples-data.cloudfunctions.net/infosimples-storage/5BqXbTz8vFxoyaHPtDPltS7ieC6dKAnCXRRGHwL3t9E=/1741825062/omfRe0/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL2luZm9zaW1wbGVzLWFwaS10bXAvYXBpL3BnZS9zcC9kaXZpZGEtYXRpdmEvMjAyNTAzMDUyMTE3NDIvNmotLUp2Y2lrWk5yb2Y4LWNGTnlZWVNSTExXUGFBRS0vZTFjODU3NjUwMTc3ZWFlZjQyMGI1Y2U3YWYwNDBjZjFfMF92Y00=.html';

    // Test without S3 upload (direct PDF return)
    console.log('Testing direct PDF output...');
    const directResult = await handler({ url }, {});
    
    if (directResult.statusCode === 200) {
      const buffer = Buffer.from(directResult.body, 'base64');
      fs.writeFileSync(path.join(__dirname, 'local-output.pdf'), buffer);
      console.log('PDF saved to test/local-output.pdf');
    } else {
      console.error('Error:', directResult.body);
    }

    // Test with S3 upload (requires valid AWS credentials)
    console.log('\nTesting S3 upload...');
    
    // Comment/uncomment this block if you want to test S3 upload with real AWS credentials
    /*
    const s3Result = await handler({
      url,
      outputBucket: 'your-test-bucket',  // Change to your bucket
      outputKey: `test-pdf-${Date.now()}.pdf`
    }, {});
    
    console.log('S3 Result:', JSON.stringify(s3Result, null, 2));
    */
  } catch (error) {
    console.error('Test execution error:', error);
  }
}

// Run the test
runLocalTest().catch(console.error); 
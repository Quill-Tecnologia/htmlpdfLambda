const puppeteer = require("puppeteer-extra");
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

 puppeteer.use(StealthPlugin());

 const proxyUser = "brd-customer-hl_1526f663-zone-isp";
 const proxyPass = "n73vywjo51c8";
 const proxy = 'brd.superproxy.io:33335';
// Local version of the Lambda function using regular Puppeteer
async function localHandler(event, context) {
  let browser = null;
  
  try {
    const url = event.url;
    if (!url) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'URL parameter is required' })
      };
    }
  
    const outputBucket = event.outputBucket;
    const outputKey = event.outputKey || `pdf-${Date.now()}.pdf`;
 

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--proxy-server=' + proxy]
    });
    
    

    const pdfBuffer = await scrapeWebsite(browser, url);
    
    if (outputBucket) {
      const s3 = new AWS.S3();
      await s3.putObject({
        Bucket: outputBucket,
        Key: outputKey,
        Body: pdfBuffer,
        ContentType: 'application/pdf'
      }).promise();
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'PDF created successfully',
          location: `s3://${outputBucket}/${outputKey}`
        })
      };
    } else {
      const localPath = path.join(__dirname, 'local-output.pdf');
      fs.writeFileSync(localPath, pdfBuffer);
      console.log(`PDF saved locally to: ${localPath}`);
      
      return {
        statusCode: 200,
        body: pdfBuffer.toString('base64'),
        isBase64Encoded: true,
        headers: {
          'Content-Type': 'application/pdf'
        }
      };
    }
  } catch (error) {
    console.error('Error during execution:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }
}

async function scrapeWebsite(browser, url) {
  const page = await browser.newPage();
  await page.authenticate({
    username: proxyUser,
    password: proxyPass
  });
  
  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.setViewport({ width: 1366, height: 768 });
    await page.setRequestInterception(true);
    
    const pendingRequests = new Set();
    
    page.on('request', request => {
      pendingRequests.add(request);
      request.continue();
    });
    
    page.on('requestfinished', request => {
      pendingRequests.delete(request);
    });
    
    page.on('requestfailed', request => {
      pendingRequests.delete(request);
      console.log('Request failed:', request.url());
    });
    
    await page.goto(url, { timeout: 30000 });
    
    await page.waitForSelector('p', { timeout: 15000 }).catch(() => {
      console.log('Default selector not found, continuing execution');
    });
    
    await autoScroll(page);
    await waitForNetworkIdle(page, pendingRequests, 30000);
    
    await page.evaluate(() => {
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        if (img.complete) return;
        img.src = img.src;
      });
      return new Promise(resolve => setTimeout(resolve, 30000));
    });
    
    const pdfBuffer = await page.pdf({ format: 'A4' });
    return pdfBuffer;
  } finally {
    await page.close();
  }
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        
        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}

async function waitForNetworkIdle(page, pendingRequests, timeout = 30000) {
  if (pendingRequests.size === 0) return;
  
  await new Promise(resolve => {
    let timeoutId = setTimeout(resolve, timeout);
    const checkInterval = setInterval(() => {
      if (pendingRequests.size === 0) {
        clearInterval(checkInterval);
        clearTimeout(timeoutId);
        resolve();
      }
    }, 100);
  });
}

// Run the local test
async function runTest() {
  try {
    const result = await localHandler({ 
      url: 'https://us-central1-infosimples-data.cloudfunctions.net/infosimples-storage/Lhb3BCVGR5jh6bvPkllZmA_NpecZjjgWFnrhn5PZLYM=/1741999024/w2Nhzg/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL2luZm9zaW1wbGVzLWFwaS10bXAvYXBpL3RyaWJ1bmFsL3RyZjMvY2VydGlkYW8tZGlzdHIvMjAyNTAzMDcyMTM3MDQvQW5PVS04czNHakZ4d1VaR2dyOTVNcXd3Rl9RTFZsQTIvOGE5MWJhMmRhNjI1NWY5MzcwNzI2NzQ5ZTM2MTkxMzhfMF9nYkk=.html'
    }, {});
    
    console.log('Status code:', result.statusCode);
    console.log('Headers:', result.headers);
    console.log('Base64 encoded:', result.isBase64Encoded);
    console.log('PDF created successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

runTest(); 
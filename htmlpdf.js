const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-extra");
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const StealthPlugin = require('puppeteer-extra-plugin-stealth')

puppeteer.use(StealthPlugin())

exports.handler = async (event, context) => {
    let browser = null;
    
    try {
        const url = event.url;
        if (!url) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'URL parameter is required' })
            };
        }
        
        const outputBucket = event.outputBucket || process.env.OUTPUT_BUCKET;
        const outputKey = event.outputKey || `pdf-${Date.now()}.pdf`;
        
        browser = await puppeteer.launch({
            args: [
                ...chromium.args,
                '--disable-features=IsolateOrigins',
                '--disable-site-isolation-trials',
                '--disable-web-security',
                '--disable-features=CrossSiteDocumentBlockingIfIsolating',
                '--no-sandbox'
            ],
            defaultViewport: { width: 1366, height: 1024 },
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
            ignoreDefaultArgs: ['--disable-extensions']
        });
        const pdfBuffer = await scrapeWebsite(browser, url);
        
        if (outputBucket) {
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
                    outputKey: `${outputKey}`
                })
            };
        } else {
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
};

async function scrapeWebsite(browser, url) {
    const page = await browser.newPage();
    
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
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Referer': 'https://google.com/'
        });
        await page.goto(url, { timeout: 40000 });
        
        await page.waitForSelector('p.row:nth-child(2)', { timeout: 15000 }).catch(() => {
            console.log('Selector not found, continuing execution');
        });
        
        await autoScroll(page);
        await waitForNetworkIdle(page, pendingRequests, 3000);
        
        await page.evaluate(() => {
            const images = document.querySelectorAll('img');
            images.forEach(img => {
                if (img.complete) return;
                img.src = img.src;
            });
            return new Promise(resolve => setTimeout(resolve, 5000));
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
            }, 50);
        });
    });
}

async function waitForNetworkIdle(page, pendingRequests, timeout = 3000) {
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
import puppeteer from 'puppeteer';

const TARGET_URL = 'https://player.embed-api.stream/?id=812583';

(async () => {
    console.log('🚀 Starting Puppeteer in HEADED mode...');

    const browser = await puppeteer.launch({
        headless: false, // HEADED mode - visible browser
        devtools: false, // Don't open devtools
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ]
    });

    const page = await browser.newPage();

    // Strong anti-detection
    await page.evaluateOnNewDocument(() => {
        // Hide webdriver
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

        // Override permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
        );

        // Chrome runtime object
        window.chrome = {
            runtime: {},
            loadTimes: function () { },
            csi: function () { },
            app: {}
        };

        // Languages
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });

        // Disable devtools detection
        Object.defineProperty(window, 'outerWidth', { get: () => window.innerWidth });
        Object.defineProperty(window, 'outerHeight', { get: () => window.innerHeight });
    });

    await page.setViewport({ width: 1920, height: 1080 });

    await page.setExtraHTTPHeaders({
        'Referer': 'https://mappl.tv/',
        'Accept-Language': 'en-US,en;q=0.9'
    });

    const m3u8Urls = [];

    // Monitor CDP to intercept ALL network requests
    const client = await page.target().createCDPSession();
    await client.send('Network.enable');

    client.on('Network.responseReceived', async (event) => {
        const url = event.response.url;
        const contentType = event.response.headers['content-type'] || '';

        if (url.includes('.m3u8') || contentType.includes('mpegurl')) {
            console.log('🎬 [CDP] M3U8 Response:', url);
            m3u8Urls.push(url);
        }
    });

    client.on('Network.requestWillBeSent', (event) => {
        const url = event.request.url;
        if (url.includes('.m3u8') || url.includes('/hls/') || url.includes('master') || url.includes('playlist')) {
            console.log('🎬 [CDP] M3U8 Request:', url);
            m3u8Urls.push(url);
        }
    });

    // Also intercept fetch responses
    page.on('response', async response => {
        const url = response.url();
        try {
            const contentType = response.headers()['content-type'] || '';

            if (url.includes('.m3u8') || contentType.includes('mpegurl')) {
                console.log('🎬 M3U8:', url);
                m3u8Urls.push(url);
            }

            // Check JSON/text responses
            if (contentType.includes('json') || contentType.includes('text')) {
                const text = await response.text();
                const matches = text.match(/https?:\/\/[^\s"'<>\\]+\.m3u8[^\s"'<>\\]*/gi);
                if (matches) {
                    console.log('🎯 Found M3U8 in response:', matches[0]);
                    m3u8Urls.push(...matches);
                }

                // Look for source/file in JSON
                if (text.includes('"file"') || text.includes('"source"')) {
                    const fileMatch = text.match(/"(?:file|source)":\s*"([^"]+)"/i);
                    if (fileMatch && fileMatch[1]) {
                        console.log('📦 Found file/source:', fileMatch[1]);
                        if (fileMatch[1].includes('.m3u8')) {
                            m3u8Urls.push(fileMatch[1]);
                        }
                    }
                }
            }
        } catch (e) { }
    });

    console.log('📍 Navigating to:', TARGET_URL);

    try {
        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

        console.log('⏳ Waiting for page to load...');
        await new Promise(r => setTimeout(r, 5000));

        // Wait for video element or click to play
        try {
            await page.waitForSelector('video', { timeout: 10000 });
            console.log('Found video element');
            await page.click('video');
        } catch (e) {
            console.log('No video found, trying other clicks...');
        }

        // Try clicking center of page
        try {
            await page.mouse.click(960, 540);
            console.log('Clicked center of page');
        } catch (e) { }

        // Wait longer for video to start
        console.log('⏳ Waiting 20 seconds for video to load...');
        await new Promise(r => setTimeout(r, 20000));

        // Check video source
        const videoInfo = await page.evaluate(() => {
            const video = document.querySelector('video');
            if (video) {
                return {
                    src: video.src,
                    currentSrc: video.currentSrc,
                    readyState: video.readyState,
                    paused: video.paused
                };
            }
            return null;
        });

        console.log('\n📹 Video info:', videoInfo);

        // Check for HLS.js
        const hlsInfo = await page.evaluate(() => {
            if (window.Hls) {
                return 'HLS.js is loaded';
            }
            if (window.hls) {
                return 'hls object exists';
            }
            return 'No HLS detected';
        });

        console.log('📺 HLS status:', hlsInfo);

    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 FINAL RESULTS');
    console.log('='.repeat(60));

    const uniqueM3u8 = [...new Set(m3u8Urls)];
    if (uniqueM3u8.length > 0) {
        console.log('\n🎬 M3U8 URLs FOUND:');
        uniqueM3u8.forEach((url, i) => console.log(`   ${i + 1}. ${url}`));
    } else {
        console.log('\n❌ No M3U8 URLs found.');
    }

    // Keep browser open for a bit so we can see what's happening
    console.log('\n👀 Keeping browser open for 10 more seconds...');
    await new Promise(r => setTimeout(r, 10000));

    await browser.close();
    console.log('\n✅ Done!');
})();

import { connect } from 'puppeteer-real-browser';

const MAPPLE_TV_URL = 'https://mappletv.uk/watch/movie/812583?autoPlay=true';

(async () => {
    console.log('🚀 Starting Real Browser with Stealth Mode...');

    const { browser, page } = await connect({
        headless: false,
        turnstile: true,
        fingerprint: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--window-size=1280,720',
            '--disable-dev-shm-usage'
        ]
    });

    console.log('[Browser] ✅ Browser launched');

    // Set up request interception
    await page.setRequestInterception(true);
    page.on('request', req => req.continue());

    // 🛡️ POPUP KILLER
    browser.on('targetcreated', async (target) => {
        if (target.type() === 'page') {
            try {
                const newPage = await target.page();
                if (newPage && newPage !== page) {
                    console.log('[Popup] 🚫 Closing popup tab');
                    await newPage.close();
                    if (page && !page.isClosed()) await page.bringToFront();
                }
            } catch (e) { }
        }
    });

    // Collect M3U8 URLs
    const m3u8Urls = [];
    let foundMedia = null;
    let capturedReferer = null;

    // Network Response Handler - Monitor ALL responses
    const responseHandler = async (response) => {
        const url = response.url();
        const contentType = response.headers()['content-type'] || '';

        // Capture M3U8 / MP4
        if ((url.includes('.m3u8') || url.includes('.mp4') || contentType.includes('mpegurl')) && !url.includes('sk-')) {
            const isMaster = url.includes('master') || url.includes('playlist') || url.includes('index');
            console.log(`[Target] 🎯 Found Media: ${url.substring(0, 100)}...`);

            if (!foundMedia || (isMaster && !foundMedia.includes('master'))) {
                foundMedia = url;
                m3u8Urls.push(url);
                try {
                    capturedReferer = response.request().headers()['referer'] || page.url();
                } catch (e) {
                    capturedReferer = page.url();
                }
            }
        }

        // Also check JSON/text responses for embedded M3U8 URLs
        if (contentType.includes('json') || contentType.includes('text/html') || contentType.includes('javascript')) {
            try {
                const text = await response.text();
                // Look for M3U8 URLs in response content
                const m3u8Pattern = /https?:\/\/[^\s"'<>\\]+\.m3u8[^\s"'<>\\]*/gi;
                const matches = text.match(m3u8Pattern);
                if (matches) {
                    matches.forEach(m => {
                        if (!m3u8Urls.includes(m)) {
                            console.log(`[Target] 🎯 Found M3U8 in response: ${m.substring(0, 80)}...`);
                            m3u8Urls.push(m);
                            if (!foundMedia) foundMedia = m;
                        }
                    });
                }
            } catch (e) { }
        }
    };

    page.on('response', responseHandler);

    console.log(`\n📍 Navigating to: ${MAPPLE_TV_URL}`);

    try {
        await page.goto(MAPPLE_TV_URL, { waitUntil: 'networkidle2', timeout: 60000 });
        console.log('[Page] ✅ Page loaded');
        console.log('[Page] Current URL:', page.url());
        console.log('[Page] Title:', await page.title());

        // Wait briefly
        await new Promise(r => setTimeout(r, 3000));

        // Check ALL frames on the page
        console.log('\n[Frames] 🔍 Scanning all frames...');
        const allFrames = page.frames();
        console.log(`[Frames] Found ${allFrames.length} frames`);

        for (const frame of allFrames) {
            const frameUrl = frame.url();
            if (frameUrl && frameUrl !== 'about:blank') {
                console.log(`[Frame] 📺 ${frameUrl.substring(0, 80)}`);
            }
        }

        // Look for vidfast or other player iframes in the DOM
        const playerFrames = await page.evaluate(() => {
            const iframes = document.querySelectorAll('iframe');
            return Array.from(iframes).map(f => ({
                src: f.src,
                id: f.id,
                className: f.className
            }));
        });
        console.log('[DOM] Iframes in DOM:', JSON.stringify(playerFrames, null, 2));

        // Try clicking play buttons
        console.log('\n[Clicker] 🎬 Looking for play button...');
        await tryClickPlay(page);

        // Wait and monitor
        console.log('[Wait] ⏳ Waiting for video stream...');

        let attempts = 0;
        const MAX_ATTEMPTS = 60;

        while (attempts < MAX_ATTEMPTS) {
            if (foundMedia) {
                console.log(`[Success] 🎉 Found media after ${attempts}s`);
                // Wait a bit more for better quality stream
                await new Promise(r => setTimeout(r, 3000));
                break;
            }

            // Try interacting with frames
            if (attempts === 10 || attempts === 20) {
                console.log('[Frames] 🔄 Checking frames for video player...');
                for (const frame of page.frames()) {
                    try {
                        // Try clicking inside frames
                        await frame.click('video').catch(() => { });
                        await frame.click('.play-button').catch(() => { });
                        await frame.click('[class*="play"]').catch(() => { });
                    } catch (e) { }
                }
            }

            // Periodically try clicking play
            if (attempts > 0 && attempts % 10 === 0) {
                console.log(`[Pulse] 💓 ${attempts}s: Re-clicking play...`);
                await tryClickPlay(page);
            }

            await new Promise(r => setTimeout(r, 1000));
            attempts++;
        }

        page.off('response', responseHandler);

        // RESULTS
        console.log('\n' + '='.repeat(60));
        console.log('📋 FINAL RESULTS');
        console.log('='.repeat(60));

        if (m3u8Urls.length > 0) {
            console.log('\n🎬 M3U8 URLs FOUND:');
            m3u8Urls.forEach((url, i) => console.log(`   ${i + 1}. ${url}`));
            console.log(`\n📎 Referer: ${capturedReferer}`);
        } else {
            console.log('\n❌ No M3U8 URLs found.');

            // Debug info
            console.log('\n[Debug] Checking page structure...');
            const pageInfo = await page.evaluate(() => {
                return {
                    url: window.location.href,
                    hasVideo: !!document.querySelector('video'),
                    videoSrc: document.querySelector('video')?.src || null,
                    iframeCount: document.querySelectorAll('iframe').length,
                    iframeSrcs: Array.from(document.querySelectorAll('iframe')).map(f => f.src),
                    bodyClasses: document.body.className,
                    scripts: Array.from(document.querySelectorAll('script[src]')).map(s => s.src).slice(0, 10)
                };
            });
            console.log('[Debug] Page info:', JSON.stringify(pageInfo, null, 2));
        }

        console.log('\n👀 Keeping browser open for 10 more seconds...');
        await new Promise(r => setTimeout(r, 10000));

    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    await browser.close();
    console.log('\n✅ Done!');
})();

async function tryClickPlay(page) {
    const playSelectors = [
        '#play-button', '.play-button', '.play-btn',
        'button[class*="play"]', 'div[class*="play"]',
        '.jw-display-icon-container', '.plyr__control--overlaid',
        'button.vjs-big-play-button', '.player-overlay button',
        '[data-plyr="play"]', 'video',
        '.loading', // Try clicking loading overlay
        'main', // Try clicking main content area
    ];

    for (const sel of playSelectors) {
        try {
            const el = await page.$(sel);
            if (el) {
                const box = await el.boundingBox();
                if (box && box.width > 0 && box.height > 0) {
                    console.log(`[Click] 🖱️ Clicking: ${sel}`);
                    await el.click();
                    await new Promise(r => setTimeout(r, 500));
                    return true;
                }
            }
        } catch (e) { }
    }

    // Fallback: Click center of page
    try {
        console.log('[Click] 🖱️ Clicking center of page');
        await page.mouse.click(640, 360);
    } catch (e) { }

    return false;
}

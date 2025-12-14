import { connect } from 'puppeteer-real-browser';
import fs from 'fs';

async function run() {
    console.log('[Reverse] Launching Subtitle API Hunter...');
    const { browser, page } = await connect({
        headless: false,
        turnstile: true,
        fingerprint: true,
        args: ['--no-sandbox']
    });

    try {
        // 🛡️ POPUP KILLER
        browser.on('targetcreated', async (target) => {
            if (target.type() === 'page') {
                try {
                    const newPage = await target.page();
                    if (newPage && newPage !== page) {
                        await newPage.close();
                        await page.bringToFront();
                    }
                } catch (e) { }
            }
        });

        // Network Monitor
        page.on('response', async (res) => {
            const url = res.url();
            if (url.includes('.vtt') || url.includes('.srt') || url.includes('subtitle') || url.includes('cloudnestra')) {
                console.log(`[Network] 🎯 Potential Subtitle/API: ${url}`);

                const logEntry = { url, type: res.request().resourceType(), time: new Date().toISOString() };
                fs.appendFileSync('subtitle_api_dump.json', JSON.stringify(logEntry, null, 2) + ',\n');

                // If it's a JSON response, log it
                if (res.headers()['content-type']?.includes('json')) {
                    try {
                        const json = await res.json();
                        console.log('[Network] Body:', JSON.stringify(json).substring(0, 200));
                        fs.appendFileSync('subtitle_api_dump.json', JSON.stringify({ body: json }, null, 2) + ',\n');
                    } catch (e) { }
                }
            }
        });

        console.log('[Reverse] Navigating...');
        await page.goto('https://vidsrc-embed.ru/embed/movie?tmdb=533533', { waitUntil: 'domcontentloaded' });
        await new Promise(r => setTimeout(r, 6000));

        // 1. Play Button (Cloudnestra)
        let cloudFrame = page.frames().find(f => f.url().includes('cloudnestra'));
        if (!cloudFrame) throw new Error("Cloudnestra frame not found");

        console.log('[Reverse] Clicking Play...');
        const btn = await cloudFrame.waitForSelector('#pl_but, .fa-play', { timeout: 5000 });
        if (btn) await btn.click();

        console.log('[Reverse] Waiting for Player (Prorcp)...');
        await new Promise(r => setTimeout(r, 8000));

        // 2. Find Prorcp Frame
        let prorcpFrame = page.frames().find(f => f.url().includes('prorcp'));
        if (!prorcpFrame) {
            // Retry finding frame
            prorcpFrame = page.frames().find(f => f.url().includes('hash='));
        }

        if (!prorcpFrame) throw new Error("Prorcp frame not found");
        console.log(`[Reverse] Found Player Frame: ${prorcpFrame.url()}`);

        // 3. Click CC Button
        console.log('[Reverse] Clicking CC Button...');
        const ccBtn = await prorcpFrame.waitForSelector('#player_parent_control_showSubtitles', { visible: true, timeout: 5000 });
        if (ccBtn) {
            await ccBtn.click();
            await new Promise(r => setTimeout(r, 1000));
        } else {
            console.log('[Reverse] CC Button not visible, trying hover...');
            await prorcpFrame.hover('#player_parent');
            await new Promise(r => setTimeout(r, 500));
            await prorcpFrame.click('#player_parent_control_showSubtitles');
        }

        // 4. Click English
        console.log('[Reverse] Clicking English...');
        const engBtn = await prorcpFrame.waitForSelector('.lang[data-subkey="eng"]', { visible: true, timeout: 5000 });
        if (engBtn) {
            await engBtn.click();
            console.log('[Reverse] Selected English. Listening for traffic...');
            await new Promise(r => setTimeout(r, 5000)); // Wait for network request
        } else {
            console.log('[Reverse] English option not found!');
        }

    } catch (e) {
        console.error('[Reverse] Error:', e);
    } finally {
        await browser.close();
        process.exit(0);
    }
}

run();

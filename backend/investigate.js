import { connect } from 'puppeteer-real-browser';
import fs from 'fs';

async function run() {
    console.log('[Investigate] Launching Smart Hunter...');
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

        console.log('[Investigate] Navigating to Tron...');
        await page.goto('https://vidsrc-embed.ru/embed/movie?tmdb=533533', { waitUntil: 'domcontentloaded' });
        await new Promise(r => setTimeout(r, 6000));

        // 1. Find Cloudnestra Frame
        let cloudFrame = null;
        for (const frame of page.frames()) {
            if (frame.url().includes('cloudnestra')) {
                cloudFrame = frame;
                break;
            }
        }

        if (cloudFrame) {
            console.log('[Investigate] Found Cloudnestra frame. Clicking play button...');
            try {
                // Try multiple selectors for the play button
                const btn = await cloudFrame.waitForSelector('#pl_but, .fa-play', { timeout: 5000 });
                if (btn) await btn.click();
            } catch (e) {
                console.log('[Investigate] Play button error: ' + e.message);
                // Backup clean click
                await page.mouse.click(640, 360);
            }
        } else {
            console.log('[Investigate] Cloudnestra frame NOT found!');
        }

        console.log('[Investigate] Waiting for Prorcp frame...');
        await new Promise(r => setTimeout(r, 10000));

        // 2. Find Prorcp Frame
        let prorcpFrame = null;
        for (const frame of page.frames()) {
            if (frame.url().includes('prorcp') || frame.url().includes('hash=')) {
                prorcpFrame = frame;
                break;
            }
        }

        if (prorcpFrame) {
            console.log(`[Investigate] 🎯 Found Prorcp Frame: ${prorcpFrame.url()}`);
            const html = await prorcpFrame.content();
            fs.writeFileSync('prorcp_dump.html', html);
            console.log('[Investigate] Saved prorcp_dump.html');

            // Log globals in this frame
            const globals = await prorcpFrame.evaluate(() => {
                return Object.keys(window).filter(k => k.match(/player|jw|clappr|videojs/i));
            });
            console.log('[Investigate] Prorcp Globals:', globals);

        } else {
            console.log('[Investigate] ❌ Prorcp frame still missing.');
            // Dump all frame URLs
            page.frames().forEach(f => console.log(' - ' + f.url()));
        }

    } catch (e) {
        console.error('[Investigate] Error:', e);
    } finally {
        await browser.close();
        process.exit(0);
    }
}

run();

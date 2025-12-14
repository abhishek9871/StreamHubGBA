// Investigation to capture subtitle network requests when selecting English
import { connect } from 'puppeteer-real-browser';
import fs from 'fs';

const TMDB_ID = '66732'; // Stranger Things
const SEASON = '1';
const EPISODE = '1';

const capturedRequests = [];

async function investigate() {
    console.log('[Investigate] Capturing subtitle network requests...');

    const { browser, page } = await connect({
        headless: false,
        turnstile: true,
        fingerprint: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,720']
    });

    // Popup killer
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

    // Capture ALL network requests
    await page.setRequestInterception(true);
    page.on('request', req => {
        const url = req.url();
        if (url.includes('opensubtitle') || url.includes('subtitle') ||
            url.includes('.vtt') || url.includes('.srt') ||
            url.includes('sub') && !url.includes('submit')) {
            console.log('[Request]', req.method(), url.substring(0, 120));
            capturedRequests.push({
                type: 'request',
                method: req.method(),
                url: url,
                headers: req.headers()
            });
        }
        req.continue();
    });

    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('opensubtitle') || url.includes('.vtt') || url.includes('.srt')) {
            let body = null;
            try {
                body = await response.text();
                if (body.length > 500) body = body.substring(0, 500) + '...';
            } catch (e) { }

            console.log('[Response]', response.status(), url.substring(0, 100));
            capturedRequests.push({
                type: 'response',
                status: response.status(),
                url: url,
                body: body
            });
        }
    });

    const url = `https://vidsrc-embed.ru/embed/tv?tmdb=${TMDB_ID}&season=${SEASON}&episode=${EPISODE}`;
    console.log('[Investigate] Navigating to:', url);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Click to start video
    console.log('[Investigate] Clicking play...');
    for (let i = 0; i < 3; i++) {
        await page.mouse.click(640, 360);
        await new Promise(r => setTimeout(r, 2000));
    }

    // Wait for player
    await new Promise(r => setTimeout(r, 8000));

    // Find the prorcp frame
    const frames = page.frames();
    let playerFrame = null;

    for (const frame of frames) {
        if (frame.url().includes('prorcp')) {
            playerFrame = frame;
            break;
        }
    }

    if (!playerFrame) {
        console.log('[Investigate] ERROR: Player frame not found!');
        await browser.close();
        return;
    }

    // First, click CC button
    console.log('\n=== CLICKING CC BUTTON ===');
    await playerFrame.evaluate(() => {
        const ccBtn = document.querySelector('[class*="subtitle"]') ||
            document.querySelector('.pljssubk') ||
            document.querySelector('button[class*="sub"]');
        if (ccBtn) {
            ccBtn.click();
            return 'CC clicked';
        }
        return 'CC not found';
    });

    await new Promise(r => setTimeout(r, 2000));

    // Now try to select English from the menu
    console.log('=== SELECTING ENGLISH ===');
    const selectResult = await playerFrame.evaluate(() => {
        // Look for English option in subtitle menu
        const menuItems = document.querySelectorAll('[class*="sub"] li, [class*="caption"] li, .pljssubitems li, div[class*="menu"] div, span[class*="lang"]');

        for (const item of menuItems) {
            const text = item.textContent?.toLowerCase() || '';
            if (text.includes('english') || text.includes('eng')) {
                item.click();
                return { clicked: true, text: item.textContent };
            }
        }

        // Try calling getSubtitle directly with 'eng'
        if (typeof window.getSubtitle === 'function') {
            try {
                window.getSubtitle('eng');
                return { calledGetSubtitle: 'eng' };
            } catch (e) {
                return { error: e.message };
            }
        }

        return { found: false, menuItems: menuItems.length };
    });

    console.log('Select result:', JSON.stringify(selectResult));

    // Wait for subtitle to load
    console.log('\n=== WAITING FOR SUBTITLE LOAD ===');
    await new Promise(r => setTimeout(r, 5000));

    // Check what subtitles are now loaded
    const finalSubs = await playerFrame.evaluate(() => {
        const result = {};
        if (window.the_subtitles) {
            result.the_subtitles = JSON.stringify(window.the_subtitles);
        }
        if (window.db_subs) {
            result.db_subs = JSON.stringify(window.db_subs);
        }
        if (window.current_sub) {
            result.current_sub = JSON.stringify(window.current_sub);
        }

        // Also check track elements
        const tracks = [];
        document.querySelectorAll('track').forEach(t => {
            tracks.push({ label: t.label, src: t.src?.substring(0, 100) });
        });
        result.tracks = tracks;

        return result;
    });

    console.log('Final subtitles:', JSON.stringify(finalSubs, null, 2));

    // Save all captured requests
    fs.writeFileSync('tv_subtitle_network.json', JSON.stringify({
        capturedRequests,
        selectResult,
        finalSubs
    }, null, 2));

    console.log('\n[Investigate] Saved', capturedRequests.length, 'requests to tv_subtitle_network.json');

    await browser.close();
}

investigate().catch(console.error);

import { connect } from 'puppeteer-real-browser';
import fs from 'fs';

async function run() {
    console.log('[Analyze] Launching Deep Network Logger...');
    const { browser, page } = await connect({
        headless: false,
        turnstile: true,
        fingerprint: true,
        args: ['--no-sandbox']
    });

    const networkLog = [];

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

        // Intercept all responses
        page.on('response', async (response) => {
            const url = response.url();
            const type = response.request().resourceType();

            // Filter out images/fonts/css to reduce noise
            if (['image', 'font', 'stylesheet'].includes(type)) return;

            try {
                // Try JSON first
                let body = null;
                const contentType = response.headers()['content-type'] || '';

                if (contentType.includes('json') || url.includes('.json')) {
                    body = await response.json();
                } else if (contentType.includes('text') || contentType.includes('javascript') || contentType.includes('xml')) {
                    const text = await response.text();
                    // Only keep if it looks interesting
                    if (text.includes('English') || text.includes('.vtt') || text.includes('tracks')) {
                        body = text.substring(0, 1000); // Truncate
                    }
                }

                if (body) {
                    console.log(`[Network] Captured ${type}: ${url}`);
                    networkLog.push({
                        url,
                        type,
                        body: typeof body === 'object' ? JSON.stringify(body).substring(0, 500) : body
                    });
                }
            } catch (e) {
                // Ignore parsing errors for binary/other
            }
        });

        console.log('[Analyze] Navigating to Tron (533533)...');
        await page.goto('https://vidsrc-embed.ru/embed/movie?tmdb=533533', { waitUntil: 'networkidle2', timeout: 30000 });

        console.log('[Analyze] Waiting for lazy loads...');
        await new Promise(r => setTimeout(r, 8000));

        // Click Logic (Simplified to trigger traffic)
        try { await page.mouse.click(640, 360); } catch (e) { }

        console.log('[Analyze] Writing network_dump.json');
        fs.writeFileSync('network_dump.json', JSON.stringify(networkLog, null, 2));

    } catch (e) {
        console.error('[Analyze] Error:', e);
    } finally {
        await browser.close();
        process.exit(0);
    }
}

run();

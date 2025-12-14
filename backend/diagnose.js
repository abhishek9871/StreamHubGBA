import { connect } from 'puppeteer-real-browser';
import fs from 'fs';

// Configuration
const TEST_CASES = [
    // Two and a Half Men ID (Found via manual check: 2691)
    { name: 'Two and a Half Men', id: '2691', type: 'tv', season: 1, episode: 1 },
    { name: 'Lost in Space (2018)', id: '75758', type: 'tv', season: 1, episode: 1 },
    { name: 'Tron: Ares', id: '533533', type: 'movie' },
    { name: 'Bugonia', id: '701387', type: 'movie' }
];

const LOG_FILE = 'diagnosis_log.txt';

function log(msg) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${msg}`;
    console.log(line);
    fs.appendFileSync(LOG_FILE, line + '\n');
}

async function runDiagnosis() {
    log('Starting Diagnosis (with Interaction)...');

    const { browser, page } = await connect({
        headless: false,
        turnstile: true,
        fingerprint: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--window-size=1280,720',
        ]
    });

    try {
        await page.setRequestInterception(true);

        page.on('request', req => {
            req.continue();
        });

        page.on('response', async res => {
            const url = res.url();
            if (url.includes('.m3u8')) {
                log(`🎯 FOUND M3U8: ${url} (${res.status()})`);
            }
            if (url.includes('/api/source/')) {
                log(`🎯 FOUND Vidsrc Source API: ${url} (${res.status()})`);
            }
        });

        for (const test of TEST_CASES) {
            log(`\n--- Testing: ${test.name} ---`);
            const url = test.type === 'movie'
                ? `https://vidsrc-embed.ru/embed/movie/${test.id}`
                : `https://vidsrc-embed.ru/embed/tv/${test.id}/${test.season}/${test.episode}`;

            log(`Navigating to: ${url}`);

            try {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

                // Interaction: Check Title
                const title = await page.title();
                log(`Page Title: ${title}`);

                if (title.includes('Just a moment')) {
                    log('🛡️ Cloudflare detected.');
                    await new Promise(r => setTimeout(r, 5000));
                }

                // Interaction: Click Play
                log('Attempting to click Play button...');
                const playSelectors = ['#player_code', '.play-btn', '#play-button', 'div[class*="play"]', 'button'];
                let clicked = false;
                for (const sel of playSelectors) {
                    try {
                        const el = await page.$(sel);
                        if (el && await el.isVisible()) {
                            await el.click();
                            log(`Clicked ${sel}`);
                            clicked = true;
                            await new Promise(r => setTimeout(r, 1000));
                        }
                    } catch (e) { }
                }

                if (!clicked) {
                    // Center click backup
                    try {
                        await page.mouse.click(640, 360);
                        log('Clicked center screen (blind)');
                    } catch (e) { }
                }

                // Wait for potential m3u8
                log('Waiting for network activity...');
                await new Promise(r => setTimeout(r, 15000));

            } catch (e) {
                log(`❌ Error: ${e.message}`);
            }
        }

    } catch (e) {
        log(`CRITICAL ERROR: ${e.message}`);
    } finally {
        await browser.close();
        log('Diagnosis Complete.');
    }
}

runDiagnosis();

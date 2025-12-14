
const axios = require('axios');

async function testScraper() {
    console.log('Testing extraction for Tron: Ares (TMDB 533533)...');
    try {
        const res = await axios.get('http://localhost:7860/api/extract?tmdbId=533533&type=movie');
        console.log('Result:', {
            success: res.data.success,
            m3u8: res.data.m3u8Url ? 'Found' : 'Missing',
            subtitles: res.data.subtitles?.length || 0,
            subtitle_samples: res.data.subtitles?.slice(0, 3)
        });
    } catch (e) {
        console.error('Error:', e.message);
        if (e.response) console.error('Data:', e.response.data);
    }
}

testScraper();

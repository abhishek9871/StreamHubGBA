import express from 'express';

const app = express();
const PORT = 7860;

app.get('/', (req, res) => res.send('Hello from Minimal Server'));
app.get('/health', (req, res) => res.json({ status: 'ok', type: 'minimal' }));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`SIMPLE SERVER LISTENING ON PORT ${PORT}`);
    console.log('If you see this, basic deployment works!');
});

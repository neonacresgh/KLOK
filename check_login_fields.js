
const https = require('https');
const fs = require('fs');

const hostelAgent = new https.Agent({ rejectUnauthorized: false });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function debug() {
    return new Promise((resolve, reject) => {
        const req = https.get({
            hostname: 'upsahostels.com',
            port: 443,
            path: '/index.php?r=site/login',
            agent: hostelAgent,
            headers: { 'User-Agent': UA }
        }, (res) => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
                const body = Buffer.concat(chunks).toString('utf-8');
                console.log('--- LOGIN FORM ANALYSIS ---');
                const inputs = body.match(/<input[^>]+name="([^"]+)"/g);
                if (inputs) {
                    inputs.forEach(i => {
                        const name = i.match(/name="([^"]+)"/)[1];
                        console.log('Found Input:', name);
                    });
                } else {
                    console.log('No inputs found.');
                    // console.log(body.substring(0, 1000));
                }
                resolve();
            });
        });
        req.on('error', reject);
    });
}
debug().catch(console.error);

import https from 'https';
import fs from 'fs';

function request(options, data = null) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({
                status: res.statusCode,
                headers: res.headers,
                body
            }));
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

async function run() {
    try {
        console.log('--- 1. GET /site/login ---');
        const getRes = await request({
            hostname: 'upsahostels.com',
            path: '/index.php?r=site/login',
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'en-US,en;q=0.9',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            }
        });

        console.log('GET Status:', getRes.status);
        console.log('GET Headers:', JSON.stringify(getRes.headers, null, 2));

        let initialCookies = getRes.headers['set-cookie'] || [];
        let cookieStr = initialCookies.map(c => c.split(';')[0]).join('; ');

        // Some Yii apps set multiple cookies. We must send them exactly as received.
        console.log('Extracted Cookies to Send:', cookieStr);

        const csrfMatch = getRes.body.match(/<meta name="csrf-token" content="([^"]+)">/);
        const csrf = csrfMatch ? csrfMatch[1] : '';
        console.log('Extracted CSRF Token:', csrf);

        const fd = `_csrf-frontend=${encodeURIComponent(csrf)}&LoginForm%5Busername%5D=10287532&LoginForm%5Bpassword%5D=Feb%402003&login-button=`;

        console.log('\n--- 2. POST /site/login ---');
        console.log('Payload Data:', fd);

        const postOptions = {
            hostname: 'upsahostels.com',
            path: '/index.php?r=site/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(fd),
                'Cookie': cookieStr,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Origin': 'https://upsahostels.com',
                'Referer': 'https://upsahostels.com/index.php?r=site/login',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'max-age=0',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            }
        };

        console.log('POST Headers:', JSON.stringify(postOptions.headers, null, 2));

        const loginRes = await request(postOptions, fd);

        console.log('\n--- 3. LOGIN RESULT ---');
        console.log('Login Status:', loginRes.status);
        console.log('Login Headers:', JSON.stringify(loginRes.headers, null, 2));

        if (loginRes.status === 500) {
            console.log('Writing error response to 500_error.html');
            fs.writeFileSync('500_error.html', loginRes.body);
        }

    } catch (err) {
        console.error(err);
    }
}

run();

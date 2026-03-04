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

function parseCookies(cookieArray) {
    if (!cookieArray) return '';
    return cookieArray.map(c => c.split(';')[0]).join('; ');
}

async function run() {
    try {
        console.log('1. Getting login page...');
        const initRes = await request({
            hostname: 'upsahostels.com',
            path: '/index.php?r=site/login',
            method: 'GET'
        });

        // UPSA sets an initial PHP session ID
        let currentCookies = initRes.headers['set-cookie'] || [];
        let cookieStr = parseCookies(currentCookies);

        console.log('Cookies attached:', cookieStr);

        const csrfMatch = initRes.body.match(/<meta name="csrf-token" content="([^"]+)">/);
        const csrf = csrfMatch ? csrfMatch[1] : '';
        console.log('CSRF Token:', csrf);

        console.log('2. Posting login...');
        const fd = `_csrf-frontend=${encodeURIComponent(csrf)}&LoginForm%5Busername%5D=10287532&LoginForm%5Bpassword%5D=Feb%402003&login-button=`;
        const loginRes = await request({
            hostname: 'upsahostels.com',
            path: '/index.php?r=site/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': fd.length,
                'Cookie': cookieStr,
                'Origin': 'https://upsahostels.com',
                'Referer': 'https://upsahostels.com/index.php?r=site/login',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }, fd);

        console.log('Login Status:', loginRes.status);

        // Collect the new authenticated cookie
        let authCookies = loginRes.headers['set-cookie'] || [];
        let finalAuthCookies = [];

        // We want the new PHPSESSID or _identity-frontend
        const cookieMap = {};
        currentCookies.concat(authCookies).forEach(c => {
            const key = c.split('=')[0];
            cookieMap[key] = c.split(';')[0];
        });

        const combinedCookieStr = Object.values(cookieMap).join('; ');
        console.log('Combined Auth Cookies:', combinedCookieStr);

        console.log('3. Searching registration list manually...');
        const searchPath = `/index.php?r=student%2Fregistration-list%2Findex`;

        const searchRes = await request({
            hostname: 'upsahostels.com',
            path: searchPath,
            method: 'GET',
            headers: {
                'Cookie': combinedCookieStr,
                'Referer': 'https://upsahostels.com/index.php?r=site/login',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        console.log('Search Status:', searchRes.status);
        const body = searchRes.body;
        fs.writeFileSync('hostel_body.html', body);

        if (body.includes('grid-view') || body.includes('<table')) {
            console.log('Table found in response. Dumping structure...');
            const tableMatch = body.match(/<table[^>]*>([\s\S]*?)<\/table>/);
            if (tableMatch) {
                console.log(tableMatch[0].slice(0, 800));
            }
        } else {
            console.log('No table in response. See hostel_body.html');
        }

    } catch (err) {
        console.error(err);
    }
}

run();

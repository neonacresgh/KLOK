
const https = require('https');

const hostelAgent = new https.Agent({ rejectUnauthorized: false });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function hostelRequest(path, method, headers, body) {
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'upsahostels.com',
            port: 443,
            path,
            method,
            headers,
            agent: hostelAgent
        }, (res) => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
                resolve({
                    status: res.statusCode ?? 0,
                    headers: res.headers,
                    body: Buffer.concat(chunks).toString('utf-8')
                });
            });
            res.on('error', reject);
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

function updateCookies(cookieJar, h) {
    if (!h) return;
    const arr = Array.isArray(h) ? h : [h];
    arr.forEach(c => {
        const parts = c.split(';')[0].split('=');
        if (parts.length >= 2) cookieJar.set(parts[0].trim(), parts[1].trim());
    });
}

async function debug() {
    const username = '812510';
    const password = '1klKma1r';
    const cookieJar = new Map();
    const getCookieHeader = () => Array.from(cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');

    console.log('--- Step 1: GET Login Page ---');
    const getRes = await hostelRequest('/index.php?r=site/login', 'GET', { 'User-Agent': UA });
    updateCookies(cookieJar, getRes.headers['set-cookie']);
    const csrfMatch = getRes.body.match(/name="_csrf-frontend" value="([^"]+)"/);
    if (!csrfMatch) {
        console.log('Body snippet:', getRes.body.substring(0, 500));
        throw new Error('Failed to find CSRF token');
    }
    const csrfToken = csrfMatch[1];
    console.log('CSRF Token:', csrfToken);

    console.log('\n--- Step 2: POST Login ---');
    // Testing the user's new field names
    const loginBody = `_csrf-frontend=${encodeURIComponent(csrfToken)}&LoginForm%5Busername%5D=${encodeURIComponent(username)}&LoginForm%5Bpassword%5D=${encodeURIComponent(password)}&login-button=`;
    const loginRes = await hostelRequest('/index.php?r=site/login', 'POST', {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(loginBody).toString(),
        'Cookie': getCookieHeader(),
        'User-Agent': UA,
        'Origin': 'https://upsahostels.com',
        'Referer': 'https://upsahostels.com/index.php?r=site/login',
    }, loginBody);

    updateCookies(cookieJar, loginRes.headers['set-cookie']);
    console.log('Login Status:', loginRes.status);
    console.log('Login Redirect:', loginRes.headers['location']);

    console.log('\n--- Step 3: Fetch Registration List ---');
    const searchRes = await hostelRequest('/index.php?r=student/registration-list/index', 'GET', {
        'Cookie': getCookieHeader(),
        'User-Agent': UA,
    });
    console.log('Search Status:', searchRes.status);
    console.log('Includes Logout:', searchRes.body.includes('Logout'));

    if (searchRes.body.includes('Sorry') || !searchRes.body.includes('<tbody>')) {
        console.log('FAILED to load private area.');
        // console.log('Body snippet:', searchRes.body.substring(0, 1000));
    } else {
        console.log('SUCCESS: Private area loaded.');
        const rowsCount = (searchRes.body.match(/<tr/g) || []).length;
        console.log('Found approx tr count:', rowsCount);
    }
}

debug().catch(e => console.error('Error:', e));

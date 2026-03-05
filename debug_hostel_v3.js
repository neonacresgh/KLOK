
const https = require('https');
const fs = require('fs');

const hostelAgent = new https.Agent({ rejectUnauthorized: false });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function log(msg) {
    console.log(msg);
    fs.appendFileSync('hostel_debug_v3.txt', msg + '\n');
}

if (fs.existsSync('hostel_debug_v3.txt')) fs.unlinkSync('hostel_debug_v3.txt');

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

    log('--- Step 1: GET Login Page ---');
    const getRes = await hostelRequest('/index.php?r=site/login', 'GET', { 'User-Agent': UA });
    updateCookies(cookieJar, getRes.headers['set-cookie']);

    // Check for CSRF
    const csrfMatch = getRes.body.match(/name="_csrf-frontend" value="([^"]+)"/);
    if (!csrfMatch) {
        log('FAILED: CSRF token not found.');
        return;
    }
    const csrfToken = csrfMatch[1];
    log('CSRF Token: ' + csrfToken);

    // Look for input names
    const inputs = getRes.body.match(/<input[^>]+name="([^"]+)"/g);
    log('Detected input names: ' + (inputs ? inputs.map(i => i.match(/name="([^"]+)"/)[1]).join(', ') : 'None'));

    log('\n--- Step 2: POST Login ---');
    // Try both formats if first fails? No, let's just log what we see.
    // The user used: LoginForm%5Busername%5D which is LoginForm[username]
    let loginBody = `_csrf-frontend=${encodeURIComponent(csrfToken)}&LoginForm%5Busername%5D=${encodeURIComponent(username)}&LoginForm%5Bpassword%5D=${encodeURIComponent(password)}&login-button=`;

    const loginRes = await hostelRequest('/index.php?r=site/login', 'POST', {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': getCookieHeader(),
        'User-Agent': UA,
        'Referer': 'https://upsahostels.com/index.php?r=site/login',
    }, loginBody);

    updateCookies(cookieJar, loginRes.headers['set-cookie']);
    log('Login Status: ' + loginRes.status);
    log('Location: ' + loginRes.headers['location']);

    if (loginRes.status === 200) {
        log('Login returned 200 (likely validation error). Checking body for error messages...');
        if (getRes.body.includes('incorrect')) log('Found "incorrect" in body.');
    }

    log('\n--- Step 3: Registration Index ---');
    const searchRes = await hostelRequest('/index.php?r=student/registration-list/index', 'GET', {
        'Cookie': getCookieHeader(),
        'User-Agent': UA,
    });
    log('Search Status: ' + searchRes.status);
    log('Authenticated (Logout link): ' + searchRes.body.includes('Logout'));

    if (searchRes.body.includes('<tbody>')) {
        log('SUCCESS: Table found.');
    } else {
        log('FAILURE: Table not found.');
        // log('Body: ' + searchRes.body);
    }
}

debug().catch(console.error);

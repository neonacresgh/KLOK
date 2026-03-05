
const https = require('https');
const fs = require('fs');

const hostelAgent = new https.Agent({ rejectUnauthorized: false });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function log(msg) {
    console.log(msg);
    fs.appendFileSync('hostel_debug_detailed.txt', msg + '\n');
}

if (fs.existsSync('hostel_debug_detailed.txt')) fs.unlinkSync('hostel_debug_detailed.txt');

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

    log('--- Task: Testing Hostel Portal Connection ---');

    log('Step 1: Fetching login page for CSRF...');
    const getRes = await hostelRequest('/index.php?r=site/login', 'GET', { 'User-Agent': UA });
    updateCookies(cookieJar, getRes.headers['set-cookie']);
    const csrfMatch = getRes.body.match(/name="_csrf-frontend" value="([^"]+)"/);
    if (!csrfMatch) {
        log('CRITICAL: CSFR token not found in body.');
        return;
    }
    const csrfToken = csrfMatch[1];
    log('CSRF Token found: ' + csrfToken);

    log('\nStep 2: Attempting POST Login...');
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
    log('Login Response Status: ' + loginRes.status);
    log('Login Location: ' + loginRes.headers['location']);

    log('\nStep 3: Accessing Protected Registration Index...');
    const searchRes = await hostelRequest('/index.php?r=student/registration-list/index', 'GET', {
        'Cookie': getCookieHeader(),
        'User-Agent': UA,
    });
    log('Index Status: ' + searchRes.status);
    const hasLogout = searchRes.body.includes('Logout');
    log('Authenticated (has Logout link): ' + hasLogout);

    if (hasLogout) {
        log('SUCCESS: Authenticated access confirmed.');
        const hasTable = searchRes.body.includes('<tbody>');
        log('Has results table: ' + hasTable);
        if (hasTable) {
            const rows = (searchRes.body.match(/<tr/g) || []).length;
            log('Estimated table rows: ' + rows);
        }
    } else {
        log('FAILURE: Could not confirm authenticated session.');
    }
}

debug().catch(e => log('UNEXPECTED ERROR: ' + e.stack));

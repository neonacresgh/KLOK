
const https = require('https');
const fs = require('fs');

const hostelAgent = new https.Agent({ rejectUnauthorized: false });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function log(msg) {
    console.log(msg);
    fs.appendFileSync('hostel_debug_v4.txt', msg + '\n');
}

if (fs.existsSync('hostel_debug_v4.txt')) fs.unlinkSync('hostel_debug_v4.txt');

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

    log('--- Task: Table Structure Analysis ---');

    log('Step 1: Login...');
    const getRes = await hostelRequest('/index.php?r=site/login', 'GET', { 'User-Agent': UA });
    updateCookies(cookieJar, getRes.headers['set-cookie']);
    const csrfMatch = getRes.body.match(/name="_csrf-frontend" value="([^"]+)"/);
    if (!csrfMatch) throw new Error('CSRF not found');
    const csrfToken = csrfMatch[1];

    const loginBody = `_csrf-frontend=${encodeURIComponent(csrfToken)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&login-button=`;
    const loginRes = await hostelRequest('/index.php?r=site/login', 'POST', {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': getCookieHeader(),
        'User-Agent': UA,
        'Referer': 'https://upsahostels.com/index.php?r=site/login',
    }, loginBody);
    updateCookies(cookieJar, loginRes.headers['set-cookie']);

    log('Step 2: Fetching List...');
    const searchRes = await hostelRequest('/index.php?r=student/registration-list/index', 'GET', {
        'Cookie': getCookieHeader(),
        'User-Agent': UA,
    });

    if (searchRes.body.includes('Logout')) {
        log('Authenticated successfully.');

        // Find Table Headers
        const theadMatch = searchRes.body.match(/<thead>([\s\S]*?)<\/thead>/);
        if (theadMatch) {
            const headers = theadMatch[1].split(/<th[^>]*>/).slice(1).map(th => th.split('</th>')[0].replace(/<[^>]*>/g, '').trim());
            log('Table Headers: ' + headers.join(' | '));
            headers.forEach((h, i) => log(`Index ${i}: ${h}`));
        } else {
            log('Thead not found.');
        }

        // Find First Data Row
        const tbodyMatch = searchRes.body.match(/<tbody>([\s\S]*?)<\/tbody>/);
        if (tbodyMatch) {
            const firstRowMatch = tbodyMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/);
            if (firstRowMatch) {
                const tds = firstRowMatch[1].split(/<td[^>]*>/).slice(1).map(td => td.split('</td>')[0].replace(/<[^>]*>/g, '').trim());
                log('First Row Data: ' + tds.join(' | '));
            }
        }
    } else {
        log('Authentication failed.');
    }
}

debug().catch(e => log('Error: ' + e.message));

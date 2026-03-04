import https from 'https';
import fs from 'fs';

const agent = new https.Agent({ rejectUnauthorized: false });

function request(options, body) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve({
                status: res.statusCode,
                headers: res.headers,
                body: Buffer.concat(chunks).toString('utf-8')
            }));
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

const parseCookies = (setCookieHeader) => {
    if (!setCookieHeader) return '';
    const arr = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    return arr.map(c => c.split(';')[0]).join('; ');
};

async function run() {
    try {
        console.log('1. Fetching login page...');
        const r1 = await request({
            hostname: 'upsahostels.com',
            path: '/index.php?r=site/login',
            method: 'GET',
            agent,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        const csrfMatch = r1.body.match(/name="_csrf-frontend" value="([^"]+)"/);
        if (!csrfMatch) throw new Error('No CSRF token found');
        const csrf = csrfMatch[1];
        const initialCookie = parseCookies(r1.headers['set-cookie']);

        const body = `_csrf-frontend=${encodeURIComponent(csrf)}&LoginForm%5Busername%5D=812510&LoginForm%5Bpassword%5D=1klKma1r&login-button=`;

        console.log('2. Performing login...');
        const r2 = await request({
            hostname: 'upsahostels.com',
            path: '/index.php?r=site/login',
            method: 'POST',
            agent,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': initialCookie,
                'Content-Length': Buffer.byteLength(body).toString(),
                'User-Agent': 'Mozilla/5.0'
            }
        }, body);

        const authCookie = parseCookies(r2.headers['set-cookie']) || initialCookie;
        console.log('Login Status:', r2.status);

        console.log('3. Fetching Roommates (ID=1322)...');
        // Based on the user screenshot: Request Method is POST, URL contains id=1322
        const r3 = await request({
            hostname: 'upsahostels.com',
            path: '/index.php?r=//hostel/dependent/getroommates&id=1322',
            method: 'POST',
            agent,
            headers: {
                'Cookie': authCookie,
                'User-Agent': 'Mozilla/5.0',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': '0',
                'Accept': '*/*, text/javascript, text/html'
            }
        });

        console.log('Get Roommates Status:', r3.status);
        fs.writeFileSync('hostel_roommates_1322.html', r3.body);
        console.log('Output length:', r3.body.length);

        const r4 = await request({
            hostname: 'upsahostels.com',
            path: '/index.php?r=//hostel/dependent/getroommates&id=1323',
            method: 'POST',
            agent,
            headers: {
                'Cookie': authCookie,
                'User-Agent': 'Mozilla/5.0',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': '0',
                'Accept': '*/*, text/javascript, text/html'
            }
        });
        console.log('Get Roommates (1323) Status:', r4.status);
        fs.writeFileSync('hostel_roommates_1323.html', r4.body);
        console.log('Output length (1323):', r4.body.length);


    } catch (e) {
        console.error('Error:', e.message);
    }
}

run();

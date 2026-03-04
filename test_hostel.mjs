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
        console.log('Redirect Header:', r2.headers.location);

        console.log('3. Fetching Rooms View...');
        const r3 = await request({
            hostname: 'upsahostels.com',
            path: '/index.php?r=hostel%2Frooms%2Froomsview',
            method: 'GET',
            agent,
            headers: {
                'Cookie': authCookie,
                'User-Agent': 'Mozilla/5.0'
            }
        });

        console.log('Rooms View Status:', r3.status);
        fs.writeFileSync('hostel_rooms_test.html', r3.body);
        console.log('File written to hostel_rooms_test.html');

    } catch (e) {
        console.error('Error:', e.message);
    }
}

run();

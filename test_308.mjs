import https from 'https';

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

async function checkRoom(roomId) {
    try {
        console.log(`Checking Room ID: ${roomId}...`);

        // 1. Login
        const r1 = await request({
            hostname: 'upsahostels.com',
            path: '/index.php?r=site/login',
            method: 'GET',
            agent,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        const csrfMatch = r1.body.match(/name="_csrf-frontend" value="([^"]+)"/);
        const csrf = csrfMatch[1];
        const initialCookie = parseCookies(r1.headers['set-cookie']);

        const loginBody = `_csrf-frontend=${encodeURIComponent(csrf)}&LoginForm%5Busername%5D=812510&LoginForm%5Bpassword%5D=1klKma1r&login-button=`;
        const r2 = await request({
            hostname: 'upsahostels.com',
            path: '/index.php?r=site/login',
            method: 'POST',
            agent,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': initialCookie,
                'Content-Length': Buffer.byteLength(loginBody).toString(),
                'User-Agent': 'Mozilla/5.0'
            }
        }, loginBody);

        const authCookie = parseCookies(r2.headers['set-cookie']) || initialCookie;

        // 2. Get roommates
        const r3 = await request({
            hostname: 'upsahostels.com',
            path: `/index.php?r=//hostel/dependent/getroommates&id=${roomId}`,
            method: 'POST',
            agent,
            headers: {
                'Cookie': authCookie,
                'User-Agent': 'Mozilla/5.0',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        console.log('Status:', r3.status);
        console.log('Body snippet:', r3.body.substring(0, 500));

        if (r3.body.includes('These rooms are not in the system')) {
            console.log('Detected error message: "These rooms are not in the system"');
        } else {
            console.log('No error message detected.');
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
}

// Room 308 ID from the snippet
checkRoom('1424');

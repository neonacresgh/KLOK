import https from 'https';

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
        const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0';
        console.log('1. Fetching login page...');
        const initRes = await request({
            hostname: 'upsahostels.com',
            path: '/index.php?r=site/login',
            method: 'GET',
            headers: { 'User-Agent': UA }
        });

        let cookies = initRes.headers['set-cookie'] || [];
        let cookieStr = parseCookies(cookies);
        const csrfMatch = initRes.body.match(/<meta name="csrf-token" content="([^"]+)">/);
        let csrfToken = csrfMatch ? csrfMatch[1] : '';

        console.log('2. Performing Login POST...');
        const fd = `_csrf-frontend=${encodeURIComponent(csrfToken)}&LoginForm%5Busername%5D=10287532&LoginForm%5Bpassword%5D=Feb%402003&login-button=`;

        const loginRes = await request({
            hostname: 'upsahostels.com',
            path: '/index.php?r=site/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(fd),
                'Cookie': cookieStr,
                'User-Agent': UA,
                'Origin': 'https://upsahostels.com',
                'Referer': 'https://upsahostels.com/index.php?r=site/login',
            }
        }, fd);

        if (loginRes.headers['set-cookie']) {
            const authCookies = parseCookies(loginRes.headers['set-cookie']);
            const map = {};
            cookieStr.split('; ').concat(authCookies.split('; ')).forEach(c => map[c.split('=')[0]] = c);
            cookieStr = Object.values(map).join('; ');
        }

        console.log('3. Fetching registration-list to grab form fields...');
        const regInit = await request({
            hostname: 'upsahostels.com',
            path: '/index.php?r=student/registration-list/index',
            method: 'GET',
            headers: {
                'Cookie': cookieStr,
                'User-Agent': UA,
            }
        });

        // Extract all <input> and <select> names to see exactly what UPSA expects in the POST
        const nameRegex = /name="(RegistrationListSearch\[[^\]]+\])"/g;
        let match;
        const fields = new Set();
        while ((match = nameRegex.exec(regInit.body)) !== null) {
            fields.add(match[1]);
        }

        console.log('--- EXPECTED FORM FIELDS ---');
        console.log(Array.from(fields).join('\n'));
        console.log('----------------------------');
        console.log('HTTP Status:', regInit.status);
        console.log('Body snippet:\n', regInit.body.slice(0, 500));

    } catch (err) {
        console.error(err);
    }
}

run();

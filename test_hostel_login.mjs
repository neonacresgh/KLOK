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
        console.log('1. Fetching login page...');
        const initRes = await request({
            hostname: 'upsahostels.com',
            path: '/index.php?r=site/login',
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const initialCookies = initRes.headers['set-cookie'] || [];
        const csrfMatch = initRes.body.match(/<meta name="csrf-token" content="([^"]+)">/);
        const csrf = csrfMatch ? csrfMatch[1] : '';

        console.log('Got CSRF:', csrf);

        const fd = `_csrf-frontend=${encodeURIComponent(csrf)}&LoginForm%5Busername%5D=10287532&LoginForm%5Bpassword%5D=Feb%402003&login-button=`;

        console.log('2. Attempting POST login...');
        console.log('Payload:', fd);

        // Crucial step: The Hostels portal actually returns a 302 Redirect on successful login
        const loginRes = await request({
            hostname: 'upsahostels.com',
            path: '/index.php?r=site/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(fd),
                'Cookie': parseCookies(initialCookies),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Origin': 'https://upsahostels.com',
                'Referer': 'https://upsahostels.com/index.php?r=site/login',
            }
        }, fd);

        console.log('Login Response Status:', loginRes.status);
        console.log('Login Response Location Header:', loginRes.headers['location']);

        // Check if it's returning the login page back to us (failed login)
        if (loginRes.body && loginRes.body.includes('Incorrect username or password')) {
            console.log('FAILED: Incorrect username or password.');
        } else if (loginRes.status === 302) {
            console.log('SUCCESS: Got 302 Redirect! Login worked.');
        } else {
            console.log('Unexpected response:', loginRes.status);
        }

    } catch (err) {
        console.error(err);
    }
}

run();

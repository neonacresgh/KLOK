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
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'
            }
        });

        const cookieStr = parseCookies(initRes.headers['set-cookie']);
        const csrfMatch = initRes.body.match(/<meta name="csrf-token" content="([^"]+)">/);
        const csrf = csrfMatch ? csrfMatch[1] : '';

        console.log('2. Attempting multipart POST...');
        // Build multipart body
        const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
        let body = '';

        // Add CSRF
        body += `--${boundary}\r\n`;
        body += `Content-Disposition: form-data; name="_csrf-frontend"\r\n\r\n`;
        body += `${csrf}\r\n`;

        // Add Username
        body += `--${boundary}\r\n`;
        body += `Content-Disposition: form-data; name="LoginForm[username]"\r\n\r\n`;
        body += `10287532\r\n`;

        // Add Password
        body += `--${boundary}\r\n`;
        body += `Content-Disposition: form-data; name="LoginForm[password]"\r\n\r\n`;
        body += `Feb@2003\r\n`;

        // Add Login Button
        body += `--${boundary}\r\n`;
        body += `Content-Disposition: form-data; name="login-button"\r\n\r\n`;
        body += `\r\n`;

        body += `--${boundary}--\r\n`;

        const loginRes = await request({
            hostname: 'upsahostels.com',
            path: '/index.php?r=site/login',
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': Buffer.byteLength(body),
                'Cookie': cookieStr,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
                'Origin': 'https://upsahostels.com',
                'Referer': 'https://upsahostels.com/index.php?r=site/login',
            }
        }, body);

        console.log('Login Status:', loginRes.status);
        console.log('Location:', loginRes.headers['location']);

    } catch (err) {
        console.error(err);
    }
}

run();

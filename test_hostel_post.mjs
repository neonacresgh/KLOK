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
            // simple merge for auth
            const map = {};
            cookieStr.split('; ').concat(authCookies.split('; ')).forEach(c => map[c.split('=')[0]] = c);
            cookieStr = Object.values(map).join('; ');
        }

        console.log('3. Fetching registration-list to get fresh CSRF...');
        const regInit = await request({
            hostname: 'upsahostels.com',
            path: '/index.php?r=student/registration-list/index',
            method: 'GET',
            headers: {
                'Cookie': cookieStr,
                'User-Agent': UA,
            }
        });

        const csrfMatch2 = regInit.body.match(/<meta name="csrf-token" content="([^"]+)">/);
        csrfToken = csrfMatch2 ? csrfMatch2[1] : csrfToken;
        console.log('Fresh CSRF:', csrfToken);

        console.log('4. Searching via POST for "owusu"...');
        const query = 'owusu';
        const reqBody = `_csrf-frontend=${encodeURIComponent(csrfToken)}` +
            `&RegistrationListSearch%5Bstu_index_number%5D=` +
            `&RegistrationListSearch%5Bname%5D=${encodeURIComponent(query)}` +
            `&RegistrationListSearch%5Blevel_name%5D=` +
            `&RegistrationListSearch%5Bhostels_name%5D=` +
            `&RegistrationListSearch%5Bhall_name%5D=` +
            `&RegistrationListSearch%5Brooms_name%5D=` +
            `&RegistrationListSearch%5Bbeds_name%5D=` +
            `&RegistrationListSearch%5Buser_id%5D=`;

        const searchRes = await request({
            hostname: 'upsahostels.com',
            path: '/index.php?r=student%2Fregistration-list%2Findex',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(reqBody),
                'Cookie': cookieStr,
                'User-Agent': UA,
                'Origin': 'https://upsahostels.com',
                'Referer': 'https://upsahostels.com/index.php?r=student/registration-list/index',
            }
        }, reqBody);

        console.log('Search HTTP Status:', searchRes.status);
        import('fs').then(fs => fs.writeFileSync('hostel_search_post.html', searchRes.body));
        console.log('Wrote response to hostel_search_post.html');

        if (searchRes.body.includes('owusu')) {
            console.log('Found owusu in body!');
        } else {
            console.log('Owusu NOT found in body.');
        }

    } catch (err) {
        console.error(err);
    }
}

run();

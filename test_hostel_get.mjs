import https from 'https';
import fs from 'fs';

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
        const fd = `_csrf-frontend=${encodeURIComponent(csrfToken)}&LoginForm%5Busername%5D=812510&LoginForm%5Bpassword%5D=1klKma1r&login-button=`;

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

        console.log('3. Searching via GET for "10322330"...');
        const query = '10322330';

        const searchPath = `/index.php?r=student/registration-list/index&RegistrationListSearch[stu_index_number]=${query}`;

        const searchRes = await request({
            hostname: 'upsahostels.com',
            path: searchPath,
            method: 'GET',
            headers: {
                'Cookie': cookieStr,
                'User-Agent': UA,
                'Referer': 'https://upsahostels.com/index.php?r=student/registration-list/index',
            }
        });

        console.log('Search HTTP Status:', searchRes.status);
        fs.writeFileSync('hostel_search_get.html', searchRes.body);
        console.log('Wrote response to hostel_search_get.html');

        const tableBodyMatch = searchRes.body.match(/<tbody>([\s\S]*?)<\/tbody>/);
        if (tableBodyMatch) {
            console.log('Found table body!');
            const trs = tableBodyMatch[1].split(/<tr[^>]*>/).slice(1);
            console.log('Num rows:', trs.length);
            if (trs.length > 0) {
                const tds = trs[0].split(/<td[^>]*>/).slice(1).map(td => td.split('</td>')[0].replace(/<[^>]*>/g, '').trim());
                console.log('First row columns:', tds.length);
                console.log('Data:', tds);
            }
        } else {
            console.log('Table body NOT found.');
        }

    } catch (err) {
        console.error(err);
    }
}

run();

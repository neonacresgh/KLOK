import https from 'https';
import fs from 'fs';

const agent = new https.Agent({ rejectUnauthorized: false });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function request(path, method, headers, body) {
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'upsahostels.com',
            port: 443,
            path,
            method,
            headers,
            agent
        }, (res) => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve({
                status: res.statusCode,
                headers: res.headers,
                body: Buffer.concat(chunks).toString('utf-8')
            }));
        });
        if (body) req.write(body);
        req.end();
    });
}

const parseCookies = (h) => (Array.isArray(h) ? h : [h]).map(c => c.split(';')[0]).join('; ');

async function trace(indexNum) {
    console.log(`\n=== TRACING SEARCH FOR: ${indexNum} ===`);

    // 1. LOGIN
    const username = '812510';
    const password = '1klKma1r';

    console.log('1. Initial GET /site/login');
    const initRes = await request('/index.php?r=site/login', 'GET', { 'User-Agent': UA });
    const initialCookies = parseCookies(initRes.headers['set-cookie']);
    const csrfMatch = initRes.body.match(/name="_csrf-frontend" value="([^"]+)"/);
    if (!csrfMatch) {
        console.log('FAILED: No CSRF in login page.');
        fs.writeFileSync('trace_login_fail.html', initRes.body);
        return;
    }
    const csrf = csrfMatch[1];
    console.log('Got CSRF:', csrf);

    const loginBody = `_csrf-frontend=${encodeURIComponent(csrf)}&LoginForm%5Busername%5D=${encodeURIComponent(username)}&LoginForm%5Bpassword%5D=${encodeURIComponent(password)}&login-button=`;
    console.log('2. POST /site/login');
    const loginRes = await request('/index.php?r=site/login', 'POST', {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': initialCookies,
        'User-Agent': UA,
        'Referer': 'https://upsahostels.com/index.php?r=site/login'
    }, loginBody);

    console.log('Login Result:', loginRes.status);
    const authCookies = parseCookies(loginRes.headers['set-cookie']) || initialCookies;

    // 3. WARMUP (Go to registration list page first)
    console.log('3. GET /registration-list/index (Warmup)');
    const warmupRes = await request('/index.php?r=student/registration-list/index', 'GET', {
        'Cookie': authCookies,
        'User-Agent': UA
    });
    console.log('Warmup Status:', warmupRes.status);
    if (warmupRes.body.includes('Sorry !!, There was no Connection found !!')) {
        console.log('FAILED: "No Connection found" during warmup.');
        fs.writeFileSync('trace_warmup_fail.html', warmupRes.body);
        return;
    }

    // 4. SEARCH
    console.log('4. GET SEARCH');
    // We use the exact same path format as the API
    const searchPath = `/index.php?RegistrationListSearch%5Bstu_index_number%5D=${indexNum}&RegistrationListSearch%5Bname%5D=&RegistrationListSearch%5Brooms_name%5D=&RegistrationListSearch%5Bbeds_name%5D=&RegistrationListSearch%5Buser_id%5D=&r=student%2Fregistration-list%2Findex&_tog7f728364=page`;
    const searchRes = await request(searchPath, 'GET', {
        'Cookie': authCookies,
        'User-Agent': UA,
        'Referer': 'https://upsahostels.com/index.php?r=student/registration-list/index'
    });

    console.log('Search Status:', searchRes.status);
    if (searchRes.body.includes(indexNum)) {
        console.log('SUCCESS: Student found in result table!');
        const roomMatch = searchRes.body.match(/getroommates&id=(\d+)/);
        console.log('Room ID:', roomMatch ? roomMatch[1] : 'NOT FOUND');
    } else {
        console.log('FAILURE: Student not found.');
        fs.writeFileSync('trace_search_fail.html', searchRes.body);
        console.log('Saved search body to trace_search_fail.html');
    }
}

// Start trace
trace('10325100').then(() => trace('10318870'));

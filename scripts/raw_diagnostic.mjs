import https from 'https';

const agent = new https.Agent({ rejectUnauthorized: false });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function request(path, method, headers, body) {
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

const parseCookies = (h) => {
    if (!h) return '';
    const arr = Array.isArray(h) ? h : [h];
    return arr.map(c => c ? c.split(';')[0] : '').filter(Boolean).join('; ');
};

async function rawTest() {
    console.log('--- RAW LOGIN ---');
    const loginPage = await request('/index.php?r=site/login', 'GET', { 'User-Agent': UA });
    const initialCookies = parseCookies(loginPage.headers['set-cookie']);

    // Try both regexes
    let csrfToken = '';
    const csrfMatch1 = loginPage.body.match(/<meta name="csrf-token" content="([^"]+)">/);
    const csrfMatch2 = loginPage.body.match(/name="_csrf-frontend" value="([^"]+)"/);
    if (csrfMatch1) csrfToken = csrfMatch1[1];
    else if (csrfMatch2) csrfToken = csrfMatch2[1];

    if (!csrfToken) {
        console.log('FAILED to find CSRF token');
        console.log('Body snippet:', loginPage.body.slice(0, 1000));
        return;
    }
    console.log('Got CSRF:', csrfToken);

    const loginBody = `_csrf-frontend=${encodeURIComponent(csrfToken)}&LoginForm%5Busername%5D=812510&LoginForm%5Bpassword%5D=1klKma1r&login-button=`;
    const loginRes = await request('/index.php?r=site/login', 'POST', {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': initialCookies,
        'User-Agent': UA,
        'Referer': 'https://upsahostels.com/index.php?r=site/login',
        'Origin': 'https://upsahostels.com'
    }, loginBody);

    console.log('Login Status:', loginRes.status);
    const authCookies = parseCookies(loginRes.headers['set-cookie']) || initialCookies;

    console.log('--- RAW SEARCH ---');
    // Search for 10325100
    const indexNum = '10325100';
    const searchPath = `/index.php?RegistrationListSearch%5Bstu_index_number%5D=${indexNum}&RegistrationListSearch%5Bname%5D=&r=student%2Fregistration-list%2Findex`;
    const searchRes = await request(searchPath, 'GET', {
        'Cookie': authCookies,
        'User-Agent': UA,
        'Referer': 'https://upsahostels.com/index.php?r=student%2Fregistration-list%2Findex'
    });

    console.log('Search Status:', searchRes.status);
    if (searchRes.body.includes(indexNum)) {
        console.log(`SUCCESS: Student ${indexNum} found in HTML!`);
        const roomMatch = searchRes.body.match(/getroommates&id=(\d+)/);
        console.log('Room ID Match:', roomMatch ? roomMatch[1] : 'NOT FOUND');
    } else {
        console.log(`FAILURE: Student ${indexNum} NOT found in HTML.`);
        if (searchRes.body.includes('grid-view')) {
            console.log('Table found but index missing. Table content snippet:');
            const tableMatch = searchRes.body.match(/<tbody>([\s\S]*?)<\/tbody>/);
            if (tableMatch) console.log(tableMatch[1].replace(/<[^>]*>/g, '').trim().slice(0, 500));
        } else {
            console.log('Snippet of body:', searchRes.body.slice(0, 500));
        }
    }
}

rawTest();

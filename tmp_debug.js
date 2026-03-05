
const https = require('https');

const upsaAgent = new https.Agent({ rejectUnauthorized: false });
const indexNum = '10327320'; // From screenshot
const dob = '24-07-2007'; // From screenshot: July 24, 2007

async function upsaRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const reqOpts = {
            hostname: parsed.hostname,
            port: parsed.port || 443,
            path: parsed.pathname + (parsed.search || ''),
            method: options.method || 'GET',
            headers: {
                ...(options.body ? { 'Content-Length': Buffer.byteLength(options.body).toString() } : {}),
                ...options.headers,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
            },
            agent: upsaAgent,
        };

        const req = https.request(reqOpts, (res) => {
            if (!options.readBody) {
                res.destroy();
                resolve({ status: res.statusCode, headers: res.headers, body: '' });
                return;
            }
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf-8') }));
        });

        req.on('error', reject);
        if (options.body) req.write(options.body);
        req.end();
    });
}

async function debug() {
    const cookieJar = new Map();
    const updateCookies = (setCookieHeaders) => {
        if (!setCookieHeaders) return;
        const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
        headers.forEach(h => {
            const parts = h.split(';')[0].split('=');
            if (parts.length >= 2) cookieJar.set(parts[0].trim(), parts[1].trim());
        });
    };
    const getCookieHeader = () => Array.from(cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');

    console.log('--- Step 1: Warmup ---');
    const warmRes = await upsaRequest('https://upsasip.com/', { readBody: false });
    updateCookies(warmRes.headers['set-cookie']);
    console.log('Warmup Status:', warmRes.status);
    console.log('Cookies:', getCookieHeader());

    console.log('\n--- Step 2: Reset Password ---');
    const resetRes = await upsaRequest('https://upsasip.com/home/processStudPassReset/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': 'https://upsasip.com/home/studPassReset/',
            'Origin': 'https://upsasip.com',
            'Cookie': getCookieHeader(),
        },
        body: `index_num=${indexNum}`,
        readBody: true
    });
    updateCookies(resetRes.headers['set-cookie']);
    console.log('Reset Status:', resetRes.status);
    console.log('Reset Response Length:', resetRes.body.length);

    console.log('\nWaiting 3s for portal sync...');
    await new Promise(r => setTimeout(r, 3000));

    console.log('\n--- Step 3: Login ---');
    const loginRes = await upsaRequest('https://upsasip.com/home/processStudentLogin/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': 'https://upsasip.com/home/',
            'Origin': 'https://upsasip.com',
            'Cookie': getCookieHeader(),
        },
        body: `index_num=${indexNum}&stud_pswrd=${dob}`,
        readBody: false
    });
    updateCookies(loginRes.headers['set-cookie']);
    console.log('Login Status:', loginRes.status);
    console.log('Login Redirect:', loginRes.headers['location']);

    if (loginRes.status === 302 || loginRes.status === 301) {
        console.log('\n--- Step 4: Fetch Transcript ---');
        const transRes = await upsaRequest('https://upsasip.com/examination/generateStudentTrans', {
            method: 'POST',
            headers: {
                'Cookie': getCookieHeader(),
                'Referer': 'https://upsasip.com/student/',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: '',
            readBody: true
        });
        console.log('Transcript Status:', transRes.status);
        console.log('Transcript Body Preview:', transRes.body.substring(0, 500));

        if (transRes.body.includes('UPSA') || transRes.body.includes('TRANSCRIPT')) {
            console.log('\nSUCCESS: Transcript content detected.');
        } else {
            console.log('\nFAILURE: Transcript content NOT detected in body.');
        }
    } else {
        console.log('\nFAILURE: Login rejected or failed.');
    }
}

debug().catch(console.error);

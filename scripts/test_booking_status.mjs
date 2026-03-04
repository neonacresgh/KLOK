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

async function testBookingStatus(indexNum) {
    console.log(`\n=== TESTING BOOKING STATUS FOR: ${indexNum} ===`);

    // 1. LOGIN
    const username = '812510';
    const password = '1klKma1r';

    const initRes = await request('/index.php?r=site/login', 'GET', { 'User-Agent': UA });
    const initialCookies = parseCookies(initRes.headers['set-cookie']);

    let csrf = '';
    const m1 = initRes.body.match(/<meta name="csrf-token" content="([^"]+)">/);
    const m2 = initRes.body.match(/name="_csrf-frontend" value="([^"]+)"/);
    if (m1) csrf = m1[1];
    else if (m2) csrf = m2[1];

    if (!csrf) {
        console.log('No CSRF');
        return;
    }

    const loginBody = `_csrf-frontend=${encodeURIComponent(csrf)}&LoginForm%5Busername%5D=${encodeURIComponent(username)}&LoginForm%5Bpassword%5D=${encodeURIComponent(password)}&login-button=`;
    const loginRes = await request('/index.php?r=site/login', 'POST', {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': initialCookies,
        'User-Agent': UA
    }, loginBody);

    const authCookies = parseCookies(loginRes.headers['set-cookie']) || initialCookies;

    // 2. SEARCH IN BOOKING STATUS
    const searchPath = `/index.php?BookingStatusSearch%5Bstu_index_number%5D=${indexNum}&r=student%2Fbooking-status%2Findex`;
    const searchRes = await request(searchPath, 'GET', {
        'Cookie': authCookies,
        'User-Agent': UA
    });

    console.log('Search Status:', searchRes.status);
    if (searchRes.body.includes('Sorry !!, There was no Connection found !!')) {
        console.log('FAILED: "No Connection found" again.');
    } else if (searchRes.body.includes(indexNum)) {
        console.log('SUCCESS: Student found in Booking Status!');
        // Look for roommates link or room ID
        const roomMatch = searchRes.body.match(/getroommates&id=(\d+)/);
        console.log('Room ID:', roomMatch ? roomMatch[1] : 'NOT FOUND');
    } else {
        console.log('FAILURE: Student not found or table empty.');
        fs.writeFileSync('booking_status_fail.html', searchRes.body);
    }
}

testBookingStatus('10322330'); // Use known registered student

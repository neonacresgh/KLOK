import https from 'https';
import fs from 'fs';

const agent = new https.Agent({ rejectUnauthorized: false });

async function upsaSipLogin(indexNum, password) {
    console.log(`\n=== Testing SIP Login for ${indexNum} (Pass: ${password}) ===`);
    const cookieJar = new Map();
    const updateCookies = (h) => {
        if (!h) return;
        const arr = Array.isArray(h) ? h : [h];
        arr.forEach(c => {
            const part = c.split(';')[0];
            const [k, v] = part.split('=');
            if (k && v) cookieJar.set(k.trim(), v.trim());
        });
    };
    const getCookies = () => Array.from(cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');

    const request = (url, method, headers = {}, body = null) => {
        return new Promise((resolve, reject) => {
            const u = new URL(url);
            const req = https.request({
                hostname: u.hostname,
                port: 443,
                path: u.pathname + u.search,
                method,
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    ...headers,
                    'Cookie': getCookies()
                },
                agent
            }, res => {
                updateCookies(res.headers['set-cookie']);
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
    };

    try {
        // 1. Warm up
        console.log('--- 1. Warming up ---');
        await request('https://upsasip.com/', 'GET');

        // 2. Login
        console.log('--- 2. Logging in ---');
        const loginBody = `index_num=${encodeURIComponent(indexNum)}&stud_pswrd=${encodeURIComponent(password)}`;
        const res = await request('https://upsasip.com/home/processStudentLogin/', 'POST', {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': 'https://upsasip.com/home/'
        }, loginBody);

        console.log('Login Status:', res.status);
        console.log('Location Header:', res.headers.location);

        if (res.status === 302) {
            let nextPath = res.headers.location;
            if (nextPath.startsWith('/')) nextPath = 'https://upsasip.com' + nextPath;

            console.log('--- 3. Following Redirect to:', nextPath);
            const redirectRes = await request(nextPath, 'GET');
            console.log('Redirect Result Status:', redirectRes.status);

            fs.writeFileSync('sip_dashboard.html', redirectRes.body);
            console.log('Saved SIP Dashboard to sip_dashboard.html');

            const dashboardProgramMatch = redirectRes.body.match(/Program(me)?\s*:\s*(<b>)?([^<]+)(<\/b>)?/i);
            console.log('Dashboard Found Program:', dashboardProgramMatch ? dashboardProgramMatch[3].trim() : 'NOT FOUND');

            // 4. Try to get student info specifically
            console.log('--- 4. Fetching Student Profile (upsasip.com/student/) ---');
            const infoRes = await request('https://upsasip.com/student/', 'GET');

            console.log('Profile Fetch Status:', infoRes.status);
            console.log('Profile Body Length:', infoRes.body.length);

            // fs.writeFileSync('sip_student_info.html', infoRes.body);
            // console.log('Saved SIP Student Info to sip_student_info.html');

            const dashboardLevelMatch = infoRes.body.match(/Level\s*:\s*(<b>)?(\d+)(<\/b>)?/i);
            console.log('Dashboard Found Level:', dashboardLevelMatch ? dashboardLevelMatch[2] : 'NOT FOUND');

            // 5. Try to get student transcript specifically (Best source for Program & Level)
            console.log('--- 5. Fetching Student Transcript (upsasip.com/examination/generateStudentTrans) ---');
            const transRes = await request('https://upsasip.com/examination/generateStudentTrans', 'POST', {
                'Referer': 'https://upsasip.com/student/',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Origin': 'https://upsasip.com'
            }, '');

            console.log('Transcript Fetch Status:', transRes.status);
            console.log('Transcript Body Length:', transRes.body.length);

            fs.writeFileSync('sip_transcript.html', transRes.body);
            console.log('Saved SIP Transcript to sip_transcript.html');

            const levelMatch = transRes.body.match(/Level\s*:\s*([^<]+)/i);
            const programMatch = transRes.body.match(/Program(me)?\s*:\s*([^<]+)/i);

            console.log('Transcript Found Level:', levelMatch ? levelMatch[1].trim() : 'NOT FOUND');
            console.log('Transcript Found Program:', programMatch ? programMatch[2].trim() : 'NOT FOUND');
        } else {
            console.log('FAILED: Login did not return 302 redirect.');
        }
    } catch (err) {
        console.error('Error during SIP login:', err);
    }
}

// Try specific students
async function test() {
    await upsaSipLogin('10322330', '19/08/2004'); // Using 10322330 with a sample DOB
    await upsaSipLogin('10325100', '03/09/2007');
}

test();

import https from 'https';

const agent = new https.Agent({ rejectUnauthorized: false });

function request(options, body) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve({
                status: res.statusCode,
                headers: res.headers,
                body: Buffer.concat(chunks).toString('utf-8')
            }));
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

const parseCookies = (setCookieHeader) => {
    if (!setCookieHeader) return '';
    const arr = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    return arr.map(c => c.split(';')[0]).join('; ');
};

// Parse roommates from HTML (same logic as the API)
function parseRoommates(html) {
    const members = [];
    const boxRegex = /<div class='info-box-content'>([\s\S]*?)<\/div>/g;
    const imgRegex = /<img src='([^']+)'/g;

    let boxMatch;
    let imgMatch = imgRegex.exec(html);

    while ((boxMatch = boxRegex.exec(html)) !== null) {
        const content = boxMatch[1];

        // Extract text fields
        const nameMatch = content.match(/<span class='info-box-number'>([^<]+)<\/span>/);
        const telMatch = content.match(/Tel:\s*([^<]+)<\/span>/);
        const dobMatch = content.match(/DOB:\s*([^<]+)<\/span>/);
        const hallMatch = content.match(/Hall:\s*([^<]+)<\/span>/);
        const bedMatch = content.match(/Bed:\s*([^<]+)<\/span>/);
        const levelMatch = content.match(/Level:\s*([^<]+)<\/span>/);

        const imageUrl = imgMatch ? imgMatch[1] : null;

        // Extract the index number from the image URL if possible (e.g., .../10330335.jpg)
        let indexNumber = '';
        if (imageUrl) {
            const parts = imageUrl.split('/');
            const filename = parts[parts.length - 1];
            indexNumber = filename.split('.')[0];
        }

        members.push({
            full_name: nameMatch ? nameMatch[1].trim() : 'Unknown',
            index_num: indexNumber,
            phone: telMatch ? telMatch[1].trim() : '',
            dob: dobMatch ? dobMatch[1].trim() : '',
            hall: hallMatch ? hallMatch[1].trim() : '',
            bed: bedMatch ? bedMatch[1].trim() : '',
            level: levelMatch ? levelMatch[1].trim() : '',
            imageUrl: imageUrl || ''
        });

        imgMatch = imgRegex.exec(html);
    }

    return members;
}

async function testRoom(roomId) {
    try {
        console.log(`\n=== Testing Room ID: ${roomId} ===\n`);

        // 1. Login
        const r1 = await request({
            hostname: 'upsahostels.com',
            path: '/index.php?r=site/login',
            method: 'GET',
            agent,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        const csrfMatch = r1.body.match(/name="_csrf-frontend" value="([^"]+)"/);
        const csrf = csrfMatch[1];
        const initialCookie = parseCookies(r1.headers['set-cookie']);

        const loginBody = `_csrf-frontend=${encodeURIComponent(csrf)}&LoginForm%5Busername%5D=812510&LoginForm%5Bpassword%5D=1klKma1r&login-button=`;
        const r2 = await request({
            hostname: 'upsahostels.com',
            path: '/index.php?r=site/login',
            method: 'POST',
            agent,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': initialCookie,
                'Content-Length': Buffer.byteLength(loginBody).toString(),
                'User-Agent': 'Mozilla/5.0'
            }
        }, loginBody);

        const authCookie = parseCookies(r2.headers['set-cookie']) || initialCookie;

        // 2. Get roommates
        const r3 = await request({
            hostname: 'upsahostels.com',
            path: `/index.php?r=//hostel/dependent/getroommates&id=${roomId}`,
            method: 'POST',
            agent,
            headers: {
                'Cookie': authCookie,
                'User-Agent': 'Mozilla/5.0',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        console.log('Response Status:', r3.status);

        if (r3.body.includes('These rooms are not in the system')) {
            console.log('❌ Error: These rooms are not in the system');
            return;
        }

        // 3. Parse roommates
        const roommates = parseRoommates(r3.body);

        console.log(`✅ Found ${roommates.length} roommate(s):\n`);
        roommates.forEach((mate, i) => {
            console.log(`  ${i + 1}. ${mate.full_name}`);
            console.log(`     Index: ${mate.index_num}`);
            console.log(`     Phone: ${mate.phone || 'N/A'}`);
            console.log(`     DOB: ${mate.dob || 'N/A'}`);
            console.log(`     Hall: ${mate.hall || 'N/A'}`);
            console.log(`     Bed: ${mate.bed || 'N/A'}`);
            console.log(`     Level: ${mate.level || 'N/A'}`);
            console.log(`     Image: ${mate.imageUrl || 'N/A'}`);
            console.log('');
        });

    } catch (e) {
        console.error('Error:', e.message);
    }
}

// Test with Room 308 (ID: 1424)
testRoom('1424');

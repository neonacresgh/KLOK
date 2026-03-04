import { NextResponse } from 'next/server';
import https from 'https';

const hostelAgent = new https.Agent({ rejectUnauthorized: false });

function hostelRequest(
    path: string,
    method: 'GET' | 'POST',
    headers: Record<string, string>,
    body?: string
): Promise<{ status: number; headers: Record<string, string | string[]>; body: string }> {
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'upsahostels.com',
            port: 443,
            path,
            method,
            headers,
            agent: hostelAgent
        }, (res) => {
            const chunks: Buffer[] = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
                resolve({
                    status: res.statusCode ?? 0,
                    headers: res.headers as Record<string, string | string[]>,
                    body: Buffer.concat(chunks).toString('utf-8')
                });
            });
            res.on('error', reject);
        });

        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

const parseCookies = (setCookieHeader: string | string[] | undefined) => {
    if (!setCookieHeader) return '';
    const arr = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    return arr.map(c => c.split(';')[0]).join('; ');
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function freshLogin(): Promise<string> {
    const username = '812510';
    const password = '1klKma1r';

    const cookieJar = new Map<string, string>();
    const updateCookies = (h: string | string[] | undefined) => {
        if (!h) return;
        const arr = Array.isArray(h) ? h : [h];
        arr.forEach(c => {
            const parts = c.split(';')[0].split('=');
            if (parts.length >= 2) cookieJar.set(parts[0].trim(), parts[1].trim());
        });
    };
    const getCookieHeader = () => Array.from(cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');

    // GET login page for CSRF token
    const getRes = await hostelRequest('/index.php?r=site/login', 'GET', { 'User-Agent': UA });
    updateCookies(getRes.headers['set-cookie']);
    const csrfMatch = getRes.body.match(/name="_csrf-frontend" value="([^"]+)"/);
    if (!csrfMatch) throw new Error('Failed to find CSRF token');
    const csrfToken = csrfMatch[1];

    // POST login
    const loginBody = `_csrf-frontend=${encodeURIComponent(csrfToken)}&LoginForm%5Busername%5D=${encodeURIComponent(username)}&LoginForm%5Bpassword%5D=${encodeURIComponent(password)}&login-button=`;
    const loginRes = await hostelRequest('/index.php?r=site/login', 'POST', {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(loginBody).toString(),
        'Cookie': getCookieHeader(),
        'User-Agent': UA,
        'Origin': 'https://upsahostels.com',
        'Referer': 'https://upsahostels.com/index.php?r=site/login',
    }, loginBody);
    updateCookies(loginRes.headers['set-cookie']);
    return getCookieHeader();
}

export async function POST(request: Request) {
    try {
        const { roomId } = await request.json();
        if (!roomId) return NextResponse.json({ error: 'Room ID required' }, { status: 400 });

        // Always do a fresh login since serverless functions don't share memory
        let authCookie: string;

        try {
            authCookie = await freshLogin();
        } catch (loginErr) {
            console.error('Fresh login failed:', loginErr);
            return NextResponse.json({ error: 'Authentication failed' }, { status: 502 });
        }

        // 3. Fetch specific room roommates
        const searchRes = await hostelRequest(`/index.php?r=//hostel/dependent/getroommates&id=${roomId}`, 'POST', {
            'Cookie': authCookie,
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Requested-With': 'XMLHttpRequest', // Crucial for AJAX endpoints
            'User-Agent': UA
        }, '');

        if (searchRes.status !== 200) {
            return NextResponse.json({ error: 'Failed to fetch room data' }, { status: searchRes.status });
        }

        const html = searchRes.body;

        // 4. Parse the HTML into a clean JSON array
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
                const filename = parts[parts.length - 1]; // e.g. 10330335.jpg
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

            imgMatch = imgRegex.exec(html); // advance to the next image
        }

        return NextResponse.json({ roomId, roommates: members });

    } catch (e: any) {
        console.error('Hostel API error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import https from 'https';

const hostelAgent = new https.Agent({ rejectUnauthorized: false });

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

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

function parseCookies(setCookieHeader: string | string[] | undefined) {
    if (!setCookieHeader) return '';
    const arr = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    return arr.map(c => c.split(';')[0]).join('; ');
}

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
        const { query, hostelName, roomName } = await request.json();

        // Always do a fresh login since serverless functions don't share memory
        let cookie = await freshLogin();

        // 1. Fetch the page once to get the CSRF token needed for POST search
        let initRes = await hostelRequest('/index.php?r=student/registration-list/index', 'GET', {
            'Cookie': cookie,
            'User-Agent': UA,
        });

        // If session expired, login and re-fetch
        if (initRes.body.includes('Login') && initRes.body.includes('_csrf-frontend')) {
            console.log('Session expired, re-authenticating...');
            cookie = await freshLogin();
            initRes = await hostelRequest('/index.php?r=student/registration-list/index', 'GET', {
                'Cookie': cookie,
                'User-Agent': UA,
            });
        }

        const csrfMatch = initRes.body.match(/<meta name="csrf-token" content="([^"]+)">/);
        const csrfToken = csrfMatch ? csrfMatch[1] : '';

        if (!csrfToken) {
            console.error('CRITICAL: No search CSRF token found in warmup response');
            // Fallback: try to find it in the login response if warmup failed to show it
            const altCsrfMatch = initRes.body.match(/name="_csrf-frontend" value="([^"]+)"/);
            if (altCsrfMatch) console.log('Using fallback CSRF from body');
        }

        // Smart routing: send index number OR name — not both (portal ANDs them → no results)
        const isNumeric = /^\d+$/.test((query || '').trim());
        const indexParam = isNumeric ? encodeURIComponent(query || '') : '';
        const nameParam = isNumeric ? '' : encodeURIComponent(query || '');

        const searchPath = `/index.php?RegistrationListSearch%5Bstu_index_number%5D=${indexParam}&RegistrationListSearch%5Bname%5D=${nameParam}&RegistrationListSearch%5Brooms_name%5D=${encodeURIComponent(roomName || '')}&RegistrationListSearch%5Bbeds_name%5D=&RegistrationListSearch%5Buser_id%5D=&r=student%2Fregistration-list%2Findex&_tog7f728364=page`;

        let searchRes = await hostelRequest(searchPath, 'GET', {
            'Cookie': cookie,
            'User-Agent': UA,
            'Referer': 'https://upsahostels.com/index.php?r=student%2Fregistration-list%2Findex',
        });

        console.log('Search GET returned HTTP:', searchRes.status);
        if (searchRes.status !== 200 || !searchRes.body.includes('grid-view')) {
            console.log('RAW BODY START:\n', searchRes.body.slice(0, 800));
        }

        // Parse Results Table
        const rows: any[] = [];
        const tableBodyMatch = searchRes.body.match(/<tbody>([\s\S]*?)<\/tbody>/);
        if (tableBodyMatch) {
            const trs = tableBodyMatch[1].split(/<tr[^>]*>/).slice(1);
            trs.forEach(tr => {
                const tds = tr.split(/<td[^>]*>/).slice(1).map(td => td.split('</td>')[0].replace(/<[^>]*>/g, '').trim());
                // The new UPSA portal layout shows exactly 6 columns: #, Student ID, Name, Room, Bed, Porter
                if (tds.length >= 6) {
                    const roomMatch = tr.match(/getroommates&id=(\d+)/);
                    rows.push({
                        studentId: tds[1],
                        name: tds[2],
                        level: '',
                        hostel: hostelName || '', // We don't get the hostel name back in the table anymore
                        hall: '',
                        room: tds[3],
                        bed: tds[4],
                        status: 'Registered', // If they are in the registration list, they are registered
                        roomId: roomMatch ? roomMatch[1] : null
                    });
                }
            });
        }

        if (rows.length === 0) {
            return NextResponse.json({ results: rows, debugBody: searchRes.body.slice(0, 5000) });
        }

        return NextResponse.json({ results: rows });

    } catch (e: any) {
        console.error('Hostel Search Error:', e);
        return NextResponse.json({ error: e.message || 'Search failed' }, { status: 500 });
    }
}

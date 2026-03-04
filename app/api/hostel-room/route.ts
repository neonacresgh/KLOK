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

export async function GET(request: Request) {
    try {
        const indexNum = '812510';
        const password = '1klKma1r';

        // 1. Fetch login page to get CSRF token and initial session cookie
        const getRes = await hostelRequest('/index.php?r=site/login', 'GET', {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        });

        const csrfMatch = getRes.body.match(/name="_csrf-frontend" value="([^"]+)"/);
        if (!csrfMatch) {
            return new NextResponse('Failed CSRF', { status: 502 });
        }
        const csrfToken = csrfMatch[1];
        const initialCookie = parseCookies(getRes.headers['set-cookie']);

        // 2. Submit the login form with the CSRF token
        const loginBody = `_csrf-frontend=${encodeURIComponent(csrfToken)}&LoginForm%5Busername%5D=${encodeURIComponent(indexNum)}&LoginForm%5Bpassword%5D=${encodeURIComponent(password)}&login-button=`;

        const postRes = await hostelRequest('/index.php?r=site/login', 'POST', {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(loginBody).toString(),
            'Cookie': initialCookie,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Origin': 'https://upsahostels.com',
            'Referer': 'https://upsahostels.com/index.php?r=site/login',
        }, loginBody);

        const authCookieRaw = postRes.headers['set-cookie'];
        const authCookie = parseCookies(authCookieRaw) || initialCookie;

        // 3. Fetch specific room using query string or just the main room page.
        // For now, let's fetch the room view page to see what HTML builds the search bar.
        const searchRes = await hostelRequest('/index.php?r=hostel%2Frooms%2Froomsview', 'GET', {
            'Cookie': authCookie,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        });

        return new NextResponse(searchRes.body, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });

    } catch (e: any) {
        console.error('Hostel proxy error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import https from 'https';

const hostelAgent = new https.Agent({ rejectUnauthorized: false });

// Store session in memory (in production, use Redis or similar)
let globalSession: { cookie: string; timestamp: number } | null = null;
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

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

export async function POST() {
    try {
        // Check if we have a valid cached session
        if (globalSession && Date.now() - globalSession.timestamp < SESSION_TIMEOUT) {
            console.log('Using cached hostel session');
            return NextResponse.json({ success: true, cached: true });
        }

        const indexNum = '812510';
        const password = '1klKma1r';

        // 1. Fetch login page to get CSRF token
        const getRes = await hostelRequest('/index.php?r=site/login', 'GET', {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        });

        const csrfMatch = getRes.body.match(/name="_csrf-frontend" value="([^"]+)"/);
        if (!csrfMatch) {
            return NextResponse.json({ error: 'Failed to get CSRF token' }, { status: 502 });
        }
        const csrfToken = csrfMatch[1];
        const initialCookie = parseCookies(getRes.headers['set-cookie']);

        // 2. Submit the login form
        const loginBody = `_csrf-frontend=${encodeURIComponent(csrfToken)}&LoginForm%5Busername%5D=${encodeURIComponent(indexNum)}&LoginForm%5Bpassword%5D=${encodeURIComponent(password)}&login-button=`;

        const postRes = await hostelRequest('/index.php?r=site/login', 'POST', {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(loginBody).toString(),
            'Cookie': initialCookie,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Origin': 'https://upsahostels.com',
            'Referer': 'https://upsahostels.com/index.php?r=site/login',
        }, loginBody);

        const authCookie = parseCookies(postRes.headers['set-cookie']) || initialCookie;

        // Store the session
        globalSession = {
            cookie: authCookie,
            timestamp: Date.now()
        };

        console.log('Hostel login successful, session stored');
        return NextResponse.json({ success: true });

    } catch (e: any) {
        console.error('Hostel login error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// Export function to get current session for other routes
export function getHostelSession(): string | null {
    if (globalSession && Date.now() - globalSession.timestamp < SESSION_TIMEOUT) {
        return globalSession.cookie;
    }
    return null;
}

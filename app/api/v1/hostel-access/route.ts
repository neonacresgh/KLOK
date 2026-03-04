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

export async function POST(request: Request) {
    try {
        const body_json = await request.json().catch(() => ({}));
        let { indexNum, password, target } = body_json;

        // Default to admin credentials if not provided
        if (!indexNum || !password) {
            indexNum = '812510';
            password = '1klKma1r';
        }

        // 1. Fetch login page to get CSRF token and initial session cookie
        const getRes = await hostelRequest('/index.php?r=site/login', 'GET', {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        });

        const csrfMatch = getRes.body.match(/name="_csrf-frontend" value="([^"]+)"/);
        if (!csrfMatch) {
            return NextResponse.json({ error: 'Failed to retrieve CSRF token from hostel portal' }, { status: 502 });
        }
        const csrfToken = csrfMatch[1];
        const initialCookie = parseCookies(getRes.headers['set-cookie']);

        // 2. Submit the login form with the CSRF token
        const loginBody = `_csrf-frontend=${encodeURIComponent(csrfToken)}&LoginForm%5Busername%5D=${encodeURIComponent(indexNum)}&LoginForm%5Bpassword%5D=${encodeURIComponent(password)}&login-button=`;

        const postRes = await hostelRequest('/index.php?r=site/login', 'POST', {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(loginBody).toString(),
            'Cookie': initialCookie,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Origin': 'https://upsahostels.com',
            'Referer': 'https://upsahostels.com/index.php?r=site/login',
        }, loginBody);

        // 3. A successful login returns a 302 Redirect. A failure returns 200 (the login form again).
        if (postRes.status !== 302 && postRes.status !== 301) {
            return NextResponse.json({ error: 'Invalid index number or portal password' }, { status: 401 });
        }

        // The auth session cookie is returned in the POST response
        const authCookieRaw = postRes.headers['set-cookie'];

        // Target URL fallback
        const redirectUrl = target || 'https://upsahostels.com/index.php?r=hostel%2Frooms%2Froomsview';

        // Return a small HTML document that sets the cookie and redirects the browser, bypassing Same-Origin blocks
        const html = `
            <!DOCTYPE html>
            <html>
                <head><title>Logging into Hostel Portal...</title></head>
                <body style="background:#f9fafb; font-family:sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; flex-direction:column; gap:16px;">
                    <div style="width:40px; height:40px; border:4px solid #e5e7eb; border-top-color:#3b82f6; border-radius:50%; animation:spin 0.8s linear infinite;"></div>
                    <p style="color:#6b7280; font-size:14px; font-weight:600;">Authenticating with UPSA Hostel Portal...</p>
                    <script>
                        @keyframes spin { to { transform: rotate(360deg); } }
                        window.location.href = '${redirectUrl}';
                    </script>
                    <style>
                        @keyframes spin { to { transform: rotate(360deg); } }
                    </style>
                </body>
            </html>
        `;

        // Setting the proxy cookie strategy
        const response = new NextResponse(html, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });

        // Forward the authenticated cookie to the user's browser
        if (authCookieRaw) {
            const cookies = Array.isArray(authCookieRaw) ? authCookieRaw : [authCookieRaw];
            cookies.forEach(c => response.headers.append('Set-Cookie', c));
        }

        return response;

    } catch (e: any) {
        console.error('Hostel proxy error:', e);
        return NextResponse.json({ error: e.message || 'Failed to proxy login' }, { status: 500 });
    }
}

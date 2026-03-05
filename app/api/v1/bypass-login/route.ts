import { NextResponse } from 'next/server';
import https from 'https';

// upsasip.com has an incomplete certificate chain that Node.js rejects by default.
const upsaAgent = new https.Agent({ rejectUnauthorized: false });

const TIMEOUT_MS = 20_000;

/** Minimal https fetch that skips TLS verification for upsasip.com */
function upsaRequest(
    url: string,
    options: {
        method?: string;
        headers?: Record<string, string>;
        body?: string;
        readBody?: boolean;
    } = {}
): Promise<{ status: number; headers: Record<string, string | string[]>; body: string }> {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const reqOpts: https.RequestOptions = {
            hostname: parsed.hostname,
            port: parsed.port || 443,
            path: parsed.pathname + (parsed.search || ''),
            method: options.method || 'GET',
            headers: {
                ...(options.body
                    ? { 'Content-Length': Buffer.byteLength(options.body).toString() }
                    : {}),
                ...options.headers,
            },
            agent: upsaAgent,
        };

        const timer = setTimeout(() => {
            req.destroy(new Error(`Request timed out after ${TIMEOUT_MS}ms`));
        }, TIMEOUT_MS);

        const req = https.request(reqOpts, (res) => {
            if (!options.readBody) {
                clearTimeout(timer);
                res.destroy();
                resolve({
                    status: res.statusCode ?? 0,
                    headers: res.headers as Record<string, string | string[]>,
                    body: '',
                });
                return;
            }

            const chunks: Buffer[] = [];
            res.on('data', (c: Buffer) => chunks.push(c));
            res.on('end', () => {
                clearTimeout(timer);
                resolve({
                    status: res.statusCode ?? 0,
                    headers: res.headers as Record<string, string | string[]>,
                    body: Buffer.concat(chunks).toString('utf-8'),
                });
            });
            res.on('error', (e) => { clearTimeout(timer); reject(e); });
        });

        req.on('error', (e) => { clearTimeout(timer); reject(e); });
        if (options.body) req.write(options.body);
        req.end();
    });
}

export async function POST(request: Request) {
    try {
        const { indexNum, password } = await request.json();

        if (!indexNum || !password) {
            return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
        }

        const cookieJar = new Map<string, string>();

        const updateCookies = (setCookieHeaders: string | string[] | undefined) => {
            if (!setCookieHeaders) return;
            const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
            headers.forEach(h => {
                const parts = h.split(';')[0].split('=');
                if (parts.length >= 2) {
                    cookieJar.set(parts[0].trim(), parts[1].trim());
                }
            });
        };

        const getCookieHeader = () => Array.from(cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');

        console.log('Bypass: Starting password reset for', indexNum);

        // ── Step 0: Warm up session first ───────────────────────────────────────────
        const warmRes = await upsaRequest('https://upsasip.com/', {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            readBody: false,
        });
        updateCookies(warmRes.headers['set-cookie']);
        console.log('Bypass: Warmup done, cookies:', getCookieHeader());

        // ── Step 1: Password Reset ───────────────────────────────────────────────
        const resetBody = `index_num=${encodeURIComponent(indexNum)}`;
        const resetRes = await upsaRequest('https://upsasip.com/home/processStudPassReset/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Referer': 'https://upsasip.com/home/studPassReset/',
                'Origin': 'https://upsasip.com',
                'Cookie': getCookieHeader(),
            },
            body: resetBody,
            readBody: false,
        });
        updateCookies(resetRes.headers['set-cookie']);

        console.log('Bypass: Password reset response:', resetRes.status);

        // Wait for portal to process the reset
        console.log(`[Bypass] Reset Status: ${resetRes.status}. Waiting 3.5s for sync...`);
        await new Promise(r => setTimeout(r, 3500));

        // ── Step 2: Login with the password (DOB) ───────────────────────────────
        console.log(`[Bypass] Attempting login for ${indexNum}...`);
        const loginBody = `index_num=${encodeURIComponent(indexNum)}&stud_pswrd=${encodeURIComponent(password)}`;
        const loginRes = await upsaRequest('https://upsasip.com/home/processStudentLogin/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': 'https://upsasip.com/home/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
                'Origin': 'https://upsasip.com',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Cookie': getCookieHeader(),
            },
            body: loginBody,
            readBody: false,
        });
        updateCookies(loginRes.headers['set-cookie']);

        const location = (loginRes.headers['location'] as string) || '';
        console.log(`[Bypass] Login response: ${loginRes.status}, Redirect: ${location}`);

        // 3xx -> Success if redirected to dashboard; 200 -> Success if already on dashboard or similar
        const isLoginSuccessful =
            (loginRes.status >= 300 && loginRes.status < 400 && location.includes('/student') && !location.includes('/student-portal')) ||
            (loginRes.status === 200 && (getCookieHeader().includes('PHPSESSID')));

        if (!isLoginSuccessful && loginRes.status !== 302) {
            console.error(`[Bypass] Login failed for ${indexNum}. Status: ${loginRes.status}, Location: ${location}`);
            return NextResponse.json({
                error: 'Login failed. The date of birth may be incorrect or portal rejected the reset.',
                code: 'LOGIN_FAILED',
                portalStatus: loginRes.status,
                portalLocation: location
            }, { status: 401 });
        }

        // ── Step 3: Return success with redirect URL ────────────────────────────
        // Return JSON with the redirect URL and cookies
        const cookies = Array.from(cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');

        return NextResponse.json({
            success: true,
            redirectUrl: 'https://upsasip.com/student/',
            cookies: cookies
        });

    } catch (error: any) {
        console.error('Bypass Proxy Error:', error);
        return NextResponse.json({ error: error.message ?? 'Unexpected error' }, { status: 500 });
    }
}

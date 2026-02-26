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
        readBody?: boolean; // false = just get status+headers then close
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
            req.destroy(new Error(`Request to ${parsed.pathname} timed out after ${TIMEOUT_MS}ms`));
        }, TIMEOUT_MS);

        const req = https.request(reqOpts, (res) => {
            if (!options.readBody) {
                clearTimeout(timer);
                res.destroy(); // don't read body, we only need status+headers
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

        // ── Step 1: Login ──────────────────────────────────────────────────────────
        const loginBody = `index_num=${encodeURIComponent(indexNum)}&stud_pswrd=${encodeURIComponent(password)}`;

        const loginRes = await upsaRequest('https://upsasip.com/home/processStudentLogin/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': 'https://upsasip.com/home/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
                'Origin': 'https://upsasip.com',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            body: loginBody,
            readBody: false, // only need the redirect + cookie, no body
        });

        // Collect Set-Cookie header(s)
        const setCookieRaw = loginRes.headers['set-cookie'];
        const rawCookies: string[] = Array.isArray(setCookieRaw)
            ? setCookieRaw
            : setCookieRaw ? [setCookieRaw] : [];

        if (!rawCookies.length) {
            return NextResponse.json({ error: 'Login failed — no session cookie returned.' }, { status: 401 });
        }

        const cookieHeader = rawCookies
            .map(c => c.split(';')[0].trim())
            .filter(Boolean)
            .join('; ');

        // 302 → success; anything else = login page returned (wrong creds or portal down)
        if (loginRes.status !== 302 && loginRes.status !== 301) {
            return NextResponse.json(
                { error: `Login failed — portal returned ${loginRes.status}. Wrong credentials or portal is down.` },
                { status: 401 }
            );
        }

        // A failed login redirects back to /student-portal or /home; success → /student/
        const location = (loginRes.headers['location'] as string) || '';
        if (!location.includes('/student') || location.includes('/student-portal')) {
            return NextResponse.json(
                { error: 'Login failed — incorrect index number or date of birth.' },
                { status: 401 }
            );
        }

        // ── Step 2: Fetch the transcript ───────────────────────────────────────────
        const transRes = await upsaRequest('https://upsasip.com/examination/generateStudentTrans', {
            method: 'GET',
            headers: {
                'Cookie': cookieHeader,
                'Referer': 'https://upsasip.com/student/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            readBody: true,
        });

        const html = transRes.body;

        if (transRes.status < 200 || transRes.status >= 400) {
            return NextResponse.json(
                { error: `Portal returned ${transRes.status} when fetching transcript.` },
                { status: 502 }
            );
        }

        // If the portal redirected us back to the login page, session wasn't accepted
        if (!html || (html.includes('processStudentLogin') && !html.includes('generateStudentTrans'))) {
            return NextResponse.json(
                { error: 'Session not accepted — student may have wrong DOB or no portal access.' },
                { status: 401 }
            );
        }

        return new NextResponse(html, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });

    } catch (error: any) {
        console.error('UPSA Proxy Error:', error);
        return NextResponse.json({ error: error.message ?? 'Unexpected error' }, { status: 500 });
    }
}

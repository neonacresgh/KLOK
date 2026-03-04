// Vercel Redeploy Fix: 2026-02-26
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
        const { indexNum, password, bypass } = await request.json();

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

        // ── Step 0: Password Bypass (if requested) ──────────────────────────────────
        if (bypass) {
            const resetBody = `index_num=${encodeURIComponent(indexNum)}`;
            const resetRes = await upsaRequest('https://upsasip.com/home/processStudPassReset/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
                },
                body: resetBody,
                readBody: false,
            });
            updateCookies(resetRes.headers['set-cookie']);
            // Wait slightly for portal sync
            await new Promise(r => setTimeout(r, 1000));
        }

        // ── Step 1: Warm up the session ───────────────────────────────────────────
        const warmRes = await upsaRequest('https://upsasip.com/', {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Cookie': getCookieHeader(),
            },
            readBody: false,
        });
        updateCookies(warmRes.headers['set-cookie']);

        // ── Step 2: Login ──────────────────────────────────────────────────────────
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

        // 302 → success; anything else = login page returned
        if (loginRes.status !== 302 && loginRes.status !== 301) {
            return NextResponse.json(
                { error: `Login failed — portal returned ${loginRes.status}. Check credentials.` },
                { status: 401 }
            );
        }

        const location = (loginRes.headers['location'] as string) || '';
        if (!location.includes('/student') || location.includes('/student-portal')) {
            return NextResponse.json(
                { error: 'Login failed — incorrect index number or date of birth.' },
                { status: 401 }
            );
        }

        // ── Step 3: Fetch the transcript ───────────────────────────────────────────
        const transRes = await upsaRequest('https://upsasip.com/examination/generateStudentTrans', {
            method: 'POST',
            headers: {
                'Cookie': getCookieHeader(),
                'Referer': 'https://upsasip.com/student/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Origin': 'https://upsasip.com',
            },
            body: '',
            readBody: true,
        });

        const html = transRes.body;

        if (transRes.status < 200 || transRes.status >= 400) {
            return NextResponse.json({ error: `Portal error (${transRes.status}) during fetch.` }, { status: 502 });
        }

        if (!html || (html.includes('processStudentLogin') && !html.includes('generateStudentTrans'))) {
            return NextResponse.json(
                { error: 'Session not accepted — failed to reach transcript.' },
                { status: 401 }
            );
        }

        return new NextResponse(html, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });

    } catch (error: any) {
        console.error('UPSA Atomic Proxy Error:', error);
        return NextResponse.json({ error: error.message ?? 'Unexpected error' }, { status: 500 });
    }
}

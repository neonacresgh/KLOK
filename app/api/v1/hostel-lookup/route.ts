import { NextResponse } from 'next/server';
import https from 'https';

// In-memory session cache (for serverless environment)
let sessionCache: { cookie: string; expiresAt: number } | null = null;
const SESSION_DURATION = 5 * 60 * 1000; // 5 minutes

const hostelAgent = new https.Agent({ rejectUnauthorized: false });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function hostelRequest(
    path: string,
    method: 'GET' | 'POST',
    headers: Record<string, string>,
    body?: string
): Promise<{ status: number; headers: Record<string, string | string[]>; body: string }> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            req.destroy();
            reject(new Error(`Hostel Request timeout: ${path}`));
        }, 20000);

        const req = https.request({
            hostname: 'upsahostels.com',
            port: 443,
            path,
            method,
            headers,
            agent: hostelAgent
        }, (res) => {
            clearTimeout(timeout);
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

        req.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
        if (body) req.write(body);
        req.end();
    });
}

function parseCookies(setCookieHeader: string | string[] | undefined) {
    if (!setCookieHeader) return '';
    const arr = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    return arr.map(c => c.split(';')[0]).join('; ');
}

// Cached login - reuse session if still valid
async function getCachedLogin(): Promise<string> {
    const now = Date.now();
    if (sessionCache && sessionCache.expiresAt > now) {
        console.log('Using cached session');
        return sessionCache.cookie;
    }

    console.log('Creating new session...');
    const cookie = await freshLogin();
    sessionCache = { cookie, expiresAt: now + SESSION_DURATION };
    return cookie;
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
    const loginBody = `_csrf-frontend=${encodeURIComponent(csrfToken)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&login-button=`;
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
        const { query, hostelName, roomName, page = 1 } = await request.json();

        // Use cached login or fresh login
        let cookie = await getCachedLogin();

        // Fetch the registration list page (also checks session is valid)
        let initRes = await hostelRequest('/index.php?r=student/registration-list/index', 'GET', {
            'Cookie': cookie,
            'User-Agent': UA,
        });

        // If session expired, re-login
        if (initRes.body.includes('Login') && initRes.body.includes('_csrf-frontend')) {
            console.log('Session expired, re-authenticating...');
            cookie = await freshLogin();
            // Update cache
            sessionCache = { cookie, expiresAt: Date.now() + SESSION_DURATION };
            initRes = await hostelRequest('/index.php?r=student/registration-list/index', 'GET', {
                'Cookie': cookie,
                'User-Agent': UA,
            });
        }

        // Smart routing: send index number OR name
        const q = (query || '').trim();
        const isNumeric = /^\d+$/.test(q);
        const indexParam = isNumeric ? encodeURIComponent(q) : '';
        const nameParam = (!isNumeric && q) ? encodeURIComponent(q) : '';

        // Yii2 pagination — portal returns 50 per page
        const pageParam = page > 1 ? `&page=${page}` : '';

        // Using RegistrationListSearch as found in the GridView filters
        const searchPath = `/index.php?r=student%2Fregistration-list%2Findex&RegistrationListSearch%5Bstu_index_number%5D=${indexParam}&RegistrationListSearch%5Bname%5D=${nameParam}&RegistrationListSearch%5Brooms_name%5D=${encodeURIComponent(roomName || '')}&RegistrationListSearch%5Bbeds_name%5D=&RegistrationListSearch%5Buser_id%5D=&per-page=50${pageParam}`;

        const searchRes = await hostelRequest(searchPath, 'GET', {
            'Cookie': cookie,
            'User-Agent': UA,
            'Referer': 'https://upsahostels.com/index.php?r=student%2Fregistration-list%2Findex',
        });

        console.log(`[HostelSearch] Query: "${q}", Status: ${searchRes.status}, Body Length: ${searchRes.body.length}`);

        // Parse total count
        let totalCount = 0;
        const totalMatch = searchRes.body.match(/of\s+(?:<b>)?([\d,]+)(?:<\/b>)?\s+item/i);
        if (totalMatch) {
            totalCount = parseInt(totalMatch[1].replace(/,/g, ''), 10);
        }

        // ── Parse results table rows ──────────────────────────────────────────
        const rows: any[] = [];
        // Use case-insensitive match for tbody (some portals use uppercase tags)
        const tableBodyMatch = searchRes.body.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
        if (tableBodyMatch) {
            // Split on opening <tr> tags (case-insensitive, allow attributes)
            const trs = tableBodyMatch[1].split(/<tr[^>]*>/i).slice(1);
            console.log(`[HostelSearch] Found ${trs.length} <tr> elements in tbody`);

            trs.forEach((tr, trIndex) => {
                // Split on <td> tags (case-insensitive), strip all HTML from each cell
                const tds = tr.split(/<td[^>]*>/i).slice(1).map(td =>
                    td.split(/<\/td>/i)[0]
                        .replace(/<a[^>]*>/gi, '') // strip anchor open tags
                        .replace(/<\/a>/gi, '')    // strip anchor close tags
                        .replace(/<[^>]*>/g, '')   // strip all other HTML
                        .replace(/&amp;/g, '&')
                        .replace(/&nbsp;/g, ' ')
                        .trim()
                );

                // Log the first row for debugging
                if (trIndex === 0) {
                    console.log(`[HostelSearch] First <tr> tds (${tds.length}):`, JSON.stringify(tds));
                }

                // Accept any row with at least 2 cells (name + id minimum)
                if (tds.length >= 2) {
                    // Standard layout (ref guide: [0]=serial,[1]=id,[2]=name,[3]=level,[4]=hostel,[5]=roomNo,[6]=blockName,[7]=bed,[9]=status)
                    rows.push({
                        studentId: tds[1] || tds[0] || '',
                        name: tds[2] || tds[1] || '',
                        level: tds[3] || '',
                        hostel: tds[4] || hostelName || '',
                        roomNumber: tds[5] || '',   // actual room number e.g. "12b"
                        room: tds[6] || tds[5] || '', // block/wing name
                        bed: tds[7] || '',
                        status: tds[9] || tds[8] || 'Registered',
                        roomId: null
                    });
                }
            });
        } else {
            console.log('[HostelSearch] No <tbody> found in response. Body snippet:', searchRes.body.substring(0, 800));
        }

        // hasMore: use actual rows returned since portal may cap per-page differently
        const perPage = rows.length > 0 ? rows.length : 50;
        const hasMore = totalCount > 0 && rows.length > 0 && (page * perPage) < totalCount;
        console.log(`[HostelSearch] Found ${rows.length} rows. hasMore=${hasMore}. Sample:`, rows[0] || 'none');

        if (rows.length === 0) {
            const bodySnippet = searchRes.body.substring(0, 500);
            const isSorry = searchRes.body.toLowerCase().includes('sorry');
            const isLoginPage = searchRes.body.includes('_csrf-frontend');
            console.log(`[HostelSearch] Zero rows. isSorry=${isSorry}, isLoginPage=${isLoginPage}, snippet: ${bodySnippet}`);

            if (isLoginPage) {
                // Genuine auth failure — re-login once and retry
                console.log('[HostelSearch] Auth failed, attempting one re-login...');
                try {
                    const freshCookie = await freshLogin();
                    sessionCache = { cookie: freshCookie, expiresAt: Date.now() + SESSION_DURATION };
                    const retryRes = await hostelRequest(searchPath.replace(cookie, freshCookie), 'GET', {
                        'Cookie': freshCookie,
                        'User-Agent': UA,
                        'Referer': 'https://upsahostels.com/index.php?r=student%2Fregistration-list%2Findex',
                    });
                    console.log(`[HostelSearch] Retry after re-login. Status: ${retryRes.status}, Length: ${retryRes.body.length}`);
                } catch (retryErr) {
                    console.error('[HostelSearch] Re-login failed:', retryErr);
                }
            }
            // Return empty results gracefully — don't send 401 which makes frontend throw
            return NextResponse.json({ results: [], totalCount, hasMore: false, message: 'No results found' });
        }

        return NextResponse.json({
            results: rows,
            totalCount,
            hasMore
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Search failed' }, { status: 500 });
    }
}

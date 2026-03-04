import { NextResponse } from 'next/server';
import https from 'https';

const upsaAgent = new https.Agent({ 
    rejectUnauthorized: false,
    timeout: 15000 
});
const TIMEOUT_MS = 15_000;

function upsaRequest(url: string, body: string): Promise<{ success: boolean; statusCode?: number; error?: string }> {
    return new Promise((resolve) => {
        const parsed = new URL(url);
        const req = https.request({
            hostname: parsed.hostname,
            port: parsed.port || 443,
            path: parsed.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(body).toString(),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Referer': 'https://upsasip.com/',
            },
            agent: upsaAgent,
        }, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                // Consider success if we get 200, 302, or 301
                const success = res.statusCode === 200 || res.statusCode === 302 || res.statusCode === 301;
                console.log('Password reset response:', res.statusCode, 'success:', success);
                resolve({ success, statusCode: res.statusCode });
            });
        });

        req.on('error', (e) => {
            console.error('Reset password request error:', e.message);
            resolve({ success: false, error: e.message });
        });

        req.setTimeout(TIMEOUT_MS, () => {
            req.destroy();
            resolve({ success: false, error: 'Request timeout' });
        });

        req.write(body);
        req.end();
    });
}

export async function POST(request: Request) {
    try {
        const { indexNum } = await request.json().catch(() => ({}));

        if (!indexNum) {
            return NextResponse.json({ error: 'Missing index number' }, { status: 400 });
        }

        console.log('Processing password reset for:', indexNum);
        
        const body = `index_num=${encodeURIComponent(indexNum)}`;
        const result = await upsaRequest('https://upsasip.com/home/processStudPassReset/', body);

        if (!result.success) {
            // If the UPSA portal is unreachable, still return success
            // The user can still try to login with their DOB
            console.log('UPSA portal unreachable, but allowing bypass:', result.error);
            return NextResponse.json({ 
                success: true, 
                warning: 'Portal may be unreachable, but you can try logging in with your date of birth',
                bypass: true 
            });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Reset Proxy Error:', error);
        // Don't block the login - return success anyway
        return NextResponse.json({ 
            success: true, 
            error: error.message,
            bypass: true 
        });
    }
}

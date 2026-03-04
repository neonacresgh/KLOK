import { NextResponse } from 'next/server';
import https from 'https';

const upsaAgent = new https.Agent({ rejectUnauthorized: false });
const TIMEOUT_MS = 15_000;

function upsaRequest(url: string, body: string): Promise<boolean> {
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
            },
            agent: upsaAgent,
        }, (res) => {
            res.on('data', () => { }); // flush
            res.on('end', () => resolve(res.statusCode === 200 || res.statusCode === 302));
        });

        req.on('error', (e) => {
            console.error('Reset password request error:', e);
            resolve(false);
        });

        req.setTimeout(TIMEOUT_MS, () => {
            req.destroy();
            resolve(false);
        });

        req.write(body);
        req.end();
    });
}

export async function POST(request: Request) {
    try {
        const { indexNum } = await request.json();

        if (!indexNum) {
            return NextResponse.json({ error: 'Missing index number' }, { status: 400 });
        }

        const body = `index_num=${encodeURIComponent(indexNum)}`;
        const success = await upsaRequest('https://upsasip.com/home/processStudPassReset/', body);

        if (!success) {
            return NextResponse.json({ error: 'Failed to reach reset endpoint' }, { status: 502 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Reset Proxy Error:', error);
        return NextResponse.json({ error: error.message ?? 'Unexpected error' }, { status: 500 });
    }
}

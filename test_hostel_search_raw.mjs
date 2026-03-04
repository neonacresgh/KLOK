import fs from 'fs';

async function testSearchHTML() {
    console.log('Testing hostel search API raw HTML for JOSEPHINE...');
    try {
        const res = await fetch('http://localhost:3000/api/hostel-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: 'JOSEPHINE', hostelName: '', roomName: '', status: '' })
        });
        const data = await res.json();
        console.log(`Status: ${res.status}`);

        if (data.debugBody) {
            fs.writeFileSync('search_debug.html', data.debugBody);
            console.log('Saved debugBody to search_debug.html');
        }

        if (data.results && data.results.length === 0) {
            console.log('Found 0 students.');
        } else {
            console.log('Found students!', data.results?.length);
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

testSearchHTML();

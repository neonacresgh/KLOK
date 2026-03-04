import https from 'https';

async function testSearch() {
    console.log('Testing hostel search API...');
    try {
        const res = await fetch('http://localhost:3000/api/hostel-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: 'owusu', hostelName: '', roomName: '', status: '' })
        });
        const data = await res.json();
        console.log(`Status: ${res.status}`);
        if (data.results) {
            console.log(`Found ${data.results.length} students.`);
            console.log(data.results.slice(0, 2));
        } else {
            console.log('Response:', data);
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

testSearch();

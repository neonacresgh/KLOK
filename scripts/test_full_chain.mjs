async function testSearch(query, isName = false) {
    console.log(`\n--- Testing Search for: ${query} (${isName ? 'Name' : 'Index'}) ---`);
    try {
        const res = await fetch('http://localhost:3000/api/hostel-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: query, hostelName: '', roomName: '', status: '' })
        });
        const data = await res.json();
        console.log(`Status: ${res.status}`);
        if (data.results && data.results.length > 0) {
            console.log('Search Result:', data.results[0]);
            const roomId = data.results[0].roomId;
            if (roomId) {
                await testRoommates(roomId, isName ? data.results[0].studentId : query);
            } else {
                console.log('No roomId found in search result.');
            }
        } else {
            console.log('No results found for this student in hostel portal.');
            if (data.debugBody) {
                console.log('Debug HTML Snippet:', data.debugBody.slice(0, 500));
            }
        }
    } catch (err) {
        console.error('Error in search:', err);
    }
}

async function testRoommates(roomId, targetIndex) {
    console.log(`\n--- Testing Roommates for Room: ${roomId} ---`);
    try {
        const res = await fetch('http://localhost:3000/api/hostel-roommates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId })
        });
        const data = await res.json();
        console.log(`Status: ${res.status}`);
        if (data.roommates) {
            console.log(`Found ${data.roommates.length} roommates.`);
            const target = data.roommates.find(m => m.index_num === targetIndex);
            if (target) {
                console.log('Found Target Student details:', target);
            } else {
                console.log('Target student not found in roommates list. Available indexes:', data.roommates.map(m => m.index_num));
            }
        }
    } catch (err) {
        console.error('Error in roommates:', err);
    }
}

async function run() {
    // User's provided student
    await testSearch('10325100');
    await testSearch('ABIDJA JOSEPHINE ANTWIWAA', true);

    // Test a student known to be in a hostel from previous screenshots
    await testSearch('10318870');
}

run();

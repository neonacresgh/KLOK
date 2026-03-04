const fs = require('fs');

// Read the user-provided snippet from the temp file I created
const snippet = fs.readFileSync('tmp_rooms_snippet.html', 'utf8');

// Regex to extract value (id) and text (label)
const regex = /<option value="(\d+)"[^>]*>([^<]+)<\/option>/g;
let match;
const newRoomsMap = new Map();

while ((match = regex.exec(snippet)) !== null) {
    const id = match[1];
    const label = match[2].trim();

    // Skip the "Select Hostel ..." placeholder
    if (id === "" || label.includes("Select Hostel")) continue;

    // Parse room and hostel from label: "016 - UPSA Hostel A"
    const [room, hostel] = label.split(' - ');

    newRoomsMap.set(id, {
        id,
        code: Math.random().toString(36).substring(2, 6), // Generate a random 4-char code for new rooms
        room,
        hostel: hostel || 'UPSA Hostel A',
        label
    });
}

// Read existing rooms to preserve codes if they exist
let existingRooms = [];
try {
    existingRooms = JSON.parse(fs.readFileSync('public/hostel_rooms.json', 'utf8'));
} catch (e) {
    console.error('Failed to read existing rooms:', e);
}

const existingMap = new Map(existingRooms.map(r => [r.id, r]));

// Merge: Prioritize existing room data (to keep codes) but ensure all from snippet are present
const mergedRooms = [];
newRoomsMap.forEach((roomData, id) => {
    if (existingMap.has(id)) {
        // Update existing room with any potentially new label/room info but keep code
        const existing = existingMap.get(id);
        mergedRooms.push({
            ...roomData,
            code: existing.code || roomData.code
        });
    } else {
        mergedRooms.push(roomData);
    }
});

// Sort by room number for better UX
mergedRooms.sort((a, b) => a.room.localeCompare(b.room, undefined, { numeric: true }));

console.log(`Synchronized ${mergedRooms.length} rooms (Previous: ${existingRooms.length})`);
fs.writeFileSync('public/hostel_rooms.json', JSON.stringify(mergedRooms, null, 2));

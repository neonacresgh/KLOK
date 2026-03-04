const fs = require('fs');
const html = fs.readFileSync('hostel_rooms_out.html', 'utf8');

const regex = /<option value="(\d+)">\s*([^<]+)\s*<\/option>/g;
let match;
const rooms = [];

while ((match = regex.exec(html)) !== null) {
    rooms.push({
        id: match[1],
        name: match[2].trim()
    });
}

console.log('Extracted Rooms:', rooms.length);
fs.writeFileSync('public/hostel_rooms.json', JSON.stringify(rooms, null, 2));

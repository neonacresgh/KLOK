const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\HP\\klok\\app\\landing\\page.tsx', 'utf8');
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
        const code = line.charCodeAt(j);
        if (code > 127) {
            console.log(`Non-ASCII at line ${i + 1}, col ${j + 1}: code ${code} ('${line[j]}')`);
        }
    }
}

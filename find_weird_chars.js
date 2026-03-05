const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\HP\\klok\\app\\landing\\page.tsx', 'utf8');
for (let i = 0; i < content.length; i++) {
    const code = content.charCodeAt(i);
    // Allow normal ASCII + common whitespace + some academic symbols like long dash
    if (code < 32 && ![9, 10, 13].includes(code)) {
        console.log(`Strange character at index ${i}: code ${code}`);
    }
}

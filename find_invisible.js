const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\HP\\klok\\app\\landing\\page.tsx', 'utf8');
const invisible = [
    8203, // Zero width space
    8204, // Zero width non-joiner
    8205, // Zero width joiner
    65279, // Zero width non-breaking space (BOM)
    173, // Soft hyphen
];
for (let i = 0; i < content.length; i++) {
    const code = content.charCodeAt(i);
    if (invisible.includes(code)) {
        console.log(`Invisible character at index ${i}: code ${code}`);
    }
}

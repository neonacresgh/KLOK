const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\HP\\klok\\app\\landing\\page.tsx', 'utf8');
let count = 0;
for (let char of content) {
    if (char === '`') count++;
}
console.log(`Backticks: ${count}`);

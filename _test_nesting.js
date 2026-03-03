const fs = require('fs');
let src = fs.readFileSync('box-nesting.js', 'utf8');
// Remove export keywords
src = src.replace(/export /g, '');
eval(src);

// Test cases
function test(w, h, d) {
    const faces = getBoxFaces(w, h, d);
    console.log('');
    console.log('=== Box ' + w + 'x' + h + 'x' + d + ' ===');
    console.log('Faces:', faces.map(f => f.label + '(' + f.w + 'x' + f.h + ')').join(', '));
    
    const r1 = nestBoxFaces(faces);
    console.log('1 set: sheets=' + r1.sheetCount);
    
    // Try multi sets
    for (let n = 2; n <= 10; n++) {
        const facesN = [];
        for (let i = 0; i < n; i++) {
            getBoxFaces(w, h, d).forEach(f => facesN.push({...f, setIndex: i}));
        }
        const rn = nestBoxFaces(facesN);
        const costRatio = (rn.sheetCount / n).toFixed(4);
        console.log(n + ' sets: sheets=' + rn.sheetCount + ', cost/set=' + costRatio + ' sheets');
    }
    
    // Test calculateBoxPrice
    const price = calculateBoxPrice(w, h, d, 50000);
    console.log('Price (50000/sheet): ' + price.totalPrice + ' won, fracNum=' + price.fracNum + ', fracDen=' + price.fracDen + ', bestN=' + price.setsPerBatch + ', bestSheets=' + price.sheetsPerBatch);
}

test(300, 300, 300);
test(200, 200, 200);
test(1000, 1000, 1000);
test(500, 400, 300);

const fs = require('fs');
let src = fs.readFileSync('box-nesting.js', 'utf8');
src = src.replace(/export /g, '');
eval(src);

function test(w, h, d, pricePerSheet) {
    const price = pricePerSheet || 50000;
    console.log(`\n=== Box ${w}x${h}x${d} (${price}원/sheet) ===`);
    
    const faces = getBoxFaces(w, h, d);
    console.log('Faces:', faces.map(f => `${f.label}(${f.w}x${f.h})`).join(', '));
    
    const result = calculateBoxPrice(w, h, d, price);
    console.log(`Sheets for 1 set: ${result.sheetCount}`);
    console.log(`Sets per sheet: ${result.setsPerSheet}`);
    console.log(`Price: ${result.totalPrice.toLocaleString()}원`);
    
    if (result.setsPerSheet > 1) {
        console.log(`Display: ${result.sheetCount}/${result.setsPerSheet}매 = ${result.totalPrice.toLocaleString()}원`);
    } else {
        console.log(`Display: ${result.sheetCount}매 = ${result.totalPrice.toLocaleString()}원`);
    }
}

test(300, 300, 300);
test(200, 200, 200);
test(100, 100, 100);
test(1000, 1000, 1000);
test(500, 400, 300);
test(600, 400, 200);
test(800, 600, 400);

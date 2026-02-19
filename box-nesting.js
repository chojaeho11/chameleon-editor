/* box-nesting.js — Shelf-based bin-packing for box faces onto 2400x1200mm sheets */

const SHEET_W = 2400; // mm
const SHEET_H = 1200; // mm
const GAP = 10;       // mm between pieces

const FACE_LABELS = ['Front', 'Back', 'Left', 'Right', 'Top', 'Bottom'];
const FACE_LABELS_KR = ['앞면', '뒷면', '좌면', '우면', '윗면', '아랫면'];

export function getBoxFaces(w, h, d) {
    return [
        { label: FACE_LABELS[0], labelKr: FACE_LABELS_KR[0], w: w, h: h, faceIndex: 0 },
        { label: FACE_LABELS[1], labelKr: FACE_LABELS_KR[1], w: w, h: h, faceIndex: 1 },
        { label: FACE_LABELS[2], labelKr: FACE_LABELS_KR[2], w: d, h: h, faceIndex: 2 },
        { label: FACE_LABELS[3], labelKr: FACE_LABELS_KR[3], w: d, h: h, faceIndex: 3 },
        { label: FACE_LABELS[4], labelKr: FACE_LABELS_KR[4], w: w, h: d, faceIndex: 4 },
        { label: FACE_LABELS[5], labelKr: FACE_LABELS_KR[5], w: w, h: d, faceIndex: 5 },
    ];
}

/**
 * Shelf-based nesting: pack pieces onto 2400x1200mm sheets
 * @param {Array} faces - from getBoxFaces()
 * @returns {{sheets, sheetCount, error}}
 */
export function nestBoxFaces(faces) {
    // Validate: no face can exceed sheet even after rotation
    for (const f of faces) {
        const minDim = Math.min(f.w, f.h);
        const maxDim = Math.max(f.w, f.h);
        if (minDim > SHEET_H || maxDim > SHEET_W) {
            if (minDim > SHEET_W || maxDim > SHEET_H) {
                return { sheets: [], sheetCount: 0, error: 'too_large', face: f.label };
            }
        }
    }

    // Create pieces with rotation info
    const pieces = faces.map(f => ({
        ...f,
        origW: f.w,
        origH: f.h,
        placed: false,
        rotated: false
    }));

    // Sort by height descending (taller pieces first → better shelf utilization)
    pieces.sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h));

    const sheets = [];

    function newSheet() {
        const s = { sheetIndex: sheets.length, pieces: [], shelves: [] };
        sheets.push(s);
        return s;
    }

    function tryPlace(piece, sheet) {
        // Try both orientations: normal and rotated
        const orientations = [
            { w: piece.origW, h: piece.origH, rotated: false },
            { w: piece.origH, h: piece.origW, rotated: true }
        ];

        for (const orient of orientations) {
            // Skip if piece doesn't fit on sheet at all
            if (orient.w > SHEET_W || orient.h > SHEET_H) continue;

            // Try each existing shelf
            for (const shelf of sheet.shelves) {
                const x = shelf.usedWidth + (shelf.usedWidth > 0 ? GAP : 0);
                if (x + orient.w <= SHEET_W && orient.h <= shelf.height) {
                    // Fits in this shelf
                    sheet.pieces.push({
                        label: piece.label,
                        labelKr: piece.labelKr,
                        faceIndex: piece.faceIndex,
                        x: x,
                        y: shelf.y,
                        w: orient.w,
                        h: orient.h,
                        rotated: orient.rotated
                    });
                    shelf.usedWidth = x + orient.w;
                    return true;
                }
            }

            // Try new shelf
            const lastShelf = sheet.shelves[sheet.shelves.length - 1];
            const newY = lastShelf ? lastShelf.y + lastShelf.height + GAP : 0;
            if (newY + orient.h <= SHEET_H) {
                const shelf = { y: newY, height: orient.h, usedWidth: orient.w };
                sheet.shelves.push(shelf);
                sheet.pieces.push({
                    label: piece.label,
                    labelKr: piece.labelKr,
                    faceIndex: piece.faceIndex,
                    x: 0,
                    y: newY,
                    w: orient.w,
                    h: orient.h,
                    rotated: orient.rotated
                });
                return true;
            }
        }

        return false; // Doesn't fit on this sheet
    }

    // Place each piece
    for (const piece of pieces) {
        let placed = false;

        // Try existing sheets first
        for (const sheet of sheets) {
            if (tryPlace(piece, sheet)) {
                placed = true;
                break;
            }
        }

        // Need a new sheet
        if (!placed) {
            const sheet = newSheet();
            if (!tryPlace(piece, sheet)) {
                return { sheets: [], sheetCount: 0, error: 'too_large', face: piece.label };
            }
        }
    }

    return { sheets, sheetCount: sheets.length, error: null };
}

/**
 * Calculate box price with multi-set optimization.
 * Finds how many complete sets fit on the same number of sheets as 1 set.
 * Small boxes: N sets fit on 1 sheet → price = sheetPrice / N
 * Large boxes: 1 set needs multiple sheets → price = sheets × pricePerSheet
 */
export function calculateBoxPrice(w, h, d, pricePerSheet) {
    const faces1 = getBoxFaces(w, h, d);
    const result1 = nestBoxFaces(faces1);

    if (result1.error) {
        return { ...result1, totalPrice: 0 };
    }

    const singleSetSheets = result1.sheetCount;

    // Find max complete sets that fit on the same number of sheets
    let maxSets = 1;
    for (let n = 2; n <= 100; n++) {
        const facesN = [];
        for (let i = 0; i < n; i++) {
            getBoxFaces(w, h, d).forEach(f => {
                facesN.push({ ...f, setIndex: i });
            });
        }

        const resultN = nestBoxFaces(facesN);
        if (resultN.error) break;
        if (resultN.sheetCount > singleSetSheets) break; // needs more sheets → stop
        maxSets = n;
    }

    const totalPrice = Math.round((singleSetSheets * pricePerSheet) / maxSets);

    return {
        sheets: result1.sheets,
        sheetCount: singleSetSheets,
        totalPrice: totalPrice,
        setsPerSheet: maxSets,     // how many complete sets fit
        error: null
    };
}

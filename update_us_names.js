/**
 * US Product Name Batch Updater
 * Run this in the browser console on cafe3355.com (admin login required)
 * Usage: paste this entire script in DevTools console and press Enter
 */
(async function() {
    const sb = window.sb;
    if (!sb) { console.error('❌ window.sb not found. Open the editor page first.'); return; }

    const updates = [
        // ============================================================
        // FABRIC — 광목 (Gwangmok) → Muslin
        // ============================================================
        { code: 'ns10007',      name_us: 'Natural Muslin 10-Count',              name_jp: '晒し木綿 10番手（ナチュラル）' },
        { code: 'ns16001',      name_us: 'Natural Muslin 16-Count',              name_jp: '晒し木綿 16番手（ナチュラル）' },
        { code: 'ns30001',      name_us: 'Natural Muslin 30-Count',              name_jp: '晒し木綿 30番手（ナチュラル）' },
        { code: 'cb20001',      name_us: 'Off-white Muslin 20-Count',            name_jp: '晒し木綿 20番手（生成り）' },
        { code: 'cb30001',      name_us: 'Off-white Muslin 30-Count',            name_jp: '晒し木綿 30番手（生成り）' },
        { code: '2343243',      name_us: 'Natural Muslin Fabric Print 20-Count', name_jp: '晒し木綿 ファブリックプリント 20番手' },
        { code: 'cs20001',      name_us: 'White Muslin 20-Count',                name_jp: '晒し木綿 20番手（ホワイト）' },
        { code: '54228_copy',   name_us: 'Natural Muslin Fabric Print 20-Count', name_jp: '晒し木綿 20番手 ナチュラルプリント' },
        // Canvas fabric
        { code: 'cs10001',      name_us: 'Cotton Canvas 10-Count (White)',       name_jp: 'コットンキャンバス 10番手（ホワイト）' },
        // Oxford
        { code: 'ox10001',      name_us: 'Oxford Cotton 10-Count (White)',       name_jp: 'オックスフォード 10番手（ホワイト）' },
        { code: 'ox20001',      name_us: 'Oxford Cotton 20-Count (Off-white)',   name_jp: 'オックスフォード 20番手（生成り）' },

        // ============================================================
        // HONEYCOMB SKASHI — 스카시 → 3D Cutout
        // ============================================================
        { code: 'hb_ss_1',    name_us: 'Single Panel 3D Cutout Standee',           name_jp: '1枚パネル 立体カットアウトスタンディ' },
        { code: 'hb_ss_2',    name_us: 'Base Box + 1 Raised Letter Panel',         name_jp: 'ベースボックス＋立体文字1枚' },
        { code: 'hb_ss_3',    name_us: 'Base Box + 3 Raised Letter Panels',        name_jp: 'ベースボックス＋立体文字3枚' },
        { code: 'hb_ss_4',    name_us: '10-Panel Premium Display',                 name_jp: '10枚パネル プレミアムディスプレイ' },
        { code: '234342423',  name_us: 'Acrylic Dimensional Lettering Display',    name_jp: 'アクリル立体文字ディスプレイ' },
        // Life-size standee
        { code: 'hb_pi_5',    name_us: 'Life-size Standee (Honeycomb Board)',      name_jp: '等身大スタンディ（ハニカムボード）' },
        { code: '45435345',   name_us: 'Honeycomb Board Sign Paddle',              name_jp: 'ハニカムボード サインパドル' },
        { code: '35345455',   name_us: 'Blank Honeycomb Board Sign 15-27cm',       name_jp: 'ハニカムボード 無地サイン 15-27cm' },

        // ============================================================
        // HONEYCOMB DISPLAY WALL
        // ============================================================
        { code: 'hb_dw_1',   name_us: 'Honeycomb Board Display Wall',                   name_jp: 'ハニカムボード 展示用パーティション' },
        { code: 'hb_dw_31',  name_us: 'Folding Screen Display Wall',              name_jp: '屏風型 展示パーティション' },

        // ============================================================
        // HONEYCOMB INSTA PANEL / PHOTO BOOTH BACKDROP
        // ============================================================
        { code: 'lll0',      name_us: 'Photo Booth Backdrop Panel A2 (60×90cm)',            name_jp: 'フォトブース背景パネル A2 (60×90cm)' },
        { code: '0ll',       name_us: 'Photo Booth Backdrop Panel Large (100×220cm)',       name_jp: 'フォトブース背景パネル 大型 (100×220cm)' },
        { code: 'lllllp',    name_us: 'Standing Photo Booth Backdrop Panel (60×180cm)',     name_jp: 'スタンディング フォトブースパネル (60×180cm)' },
        { code: 'ppp',       name_us: 'Photo Booth Backdrop Panel XL (200×240cm)',          name_jp: 'フォトブース背景パネル 特大 (200×240cm)' },

        // ============================================================
        // HONEYCOMB ARCH GATE
        // ============================================================
        { code: 'll33',      name_us: '6-Meter Arch Gate (H 220cm)',               name_jp: '6メートル アーチゲート (高さ220cm)' },
        { code: 'll02',      name_us: '3×2.2m Booth Arch Gate',                   name_jp: '3×2.2m ブースアーチゲート' },
        { code: 'll01',      name_us: '5×2.2m Booth Arch Gate',                   name_jp: '5×2.2m ブースアーチゲート' },
        { code: '3454354',   name_us: '3-Meter Arch Gate',                         name_jp: '3メートル アーチゲート' },
        { code: 'hb_tr_1',   name_us: '4-Meter Arch Gate',                        name_jp: '4メートル アーチゲート' },

        // ============================================================
        // HONEYCOMB TABLE
        // ============================================================
        { code: 'hb_tb_4',   name_us: 'Cross-Shaped Display Table',                name_jp: '十字型 展示テーブル' },
        { code: 'GH100',     name_us: 'Honeycomb Board Meeting/Consultation Table', name_jp: 'ハニカムボード 会議・相談テーブル' },
        { code: 'hb_tb_1',   name_us: 'Single-Shelf Display Table',                name_jp: '1段展示テーブル' },
        { code: 'hb_tb_2',   name_us: '2-Shelf Display Table',                     name_jp: '2段展示テーブル' },
        { code: 'hb_tb_3',   name_us: '3-Shelf Display Table',                     name_jp: '3段展示テーブル' },

        // ============================================================
        // HONEYCOMB PRINTING
        // ============================================================
        { code: 'hb_pt_1',   name_us: 'Custom Honeycomb Board Print – Single Sided', name_jp: 'ハニカムボード カスタムプリント 片面' },
        { code: 'hb_pt_21',  name_us: 'Custom Honeycomb Board Print – Double Sided', name_jp: 'ハニカムボード カスタムプリント 両面' },

        // ============================================================
        // BANNER / PET BANNER STAND SET — 패트 → PET Banner
        // ============================================================
        { code: '752001',    name_us: 'PET Banner & Indoor Stand Set',             name_jp: 'PETバナー＋室内スタンドセット' },
        { code: '752002',    name_us: 'PET Banner & Outdoor Stand Set',            name_jp: 'PETバナー＋屋外スタンドセット' },
        { code: '752003',    name_us: 'PET Banner & Steel Indoor Stand Set',       name_jp: 'PETバナー＋スチール室内スタンドセット' },
        { code: '752004',    name_us: 'PET Banner & Outdoor Steel Stand Set',      name_jp: 'PETバナー＋屋外スチールスタンドセット' },
        { code: '752005',    name_us: 'Fabric Banner (Stand Not Included)',        name_jp: 'ファブリックバナー（スタンドなし）' },
        { code: '3453535',   name_us: 'Latex Banner',                              name_jp: 'ラテックスバナー' },
        { code: '45646456',  name_us: 'Eco-Friendly Biodegradable Banner',         name_jp: 'エコ・生分解性バナー' },
        { code: '4354536',   name_us: 'Scroll Hanging Banner',                     name_jp: 'スクロールバナー（掛け軸型）' },
        { code: '5646456',   name_us: 'Flag / Street Light Banner',               name_jp: 'フラッグ・街灯バナー' },

        // ============================================================
        // BOX — 싸바리 → Hardcover Gift Box
        // ============================================================
        { code: 'sy00005',   name_us: 'Hardcover Gift Box (1pc)',                  name_jp: 'ハードカバーギフトボックス (1個)' },

        // ============================================================
        // DAILY GOODS
        // ============================================================
        { code: 'DG_1',      name_us: 'Plain Canvas Tote Bag',                    name_jp: 'シンプルキャンバストートバッグ' },
        { code: 'DG_2',      name_us: 'Market Shopper Bag',                       name_jp: 'マーケットバッグ' },
        { code: 'DG_3',      name_us: 'Heavy-Duty Tarpaulin Tote Bag',            name_jp: 'ターポリントートバッグ' },
        { code: 'DG_4',      name_us: 'Card Holder Pouch',                        name_jp: 'カードホルダーポーチ' },
        { code: 'DG_5',      name_us: 'Coin Pouch',                               name_jp: 'コインポーチ' },
        { code: 'DG_6',      name_us: 'Tobacco Pouch',                            name_jp: 'タバコポーチ' },

        // ============================================================
        // INTERIOR PROPS
        // ============================================================
        { code: 'IP_2',      name_us: 'Decorative Tissue Box Cover',              name_jp: 'ティッシュボックスカバー' },
        { code: '43535435345', name_us: 'Sheer Chiffon Curtains',                 name_jp: 'シフォンシアーカーテン' },
        { code: '2342343422',  name_us: 'Canvas Print Frame',                     name_jp: 'キャンバスプリントフレーム' },
        { code: 'IP_3',      name_us: 'Fabric Laundry Storage Box',               name_jp: 'ファブリック 洗濯物収納ボックス' },
        { code: 'IP_4',      name_us: 'Fabric Recycling Bin',                     name_jp: 'ファブリック 分別ゴミ箱' },

        // ============================================================
        // PRINTING PAPER PRODUCTS
        // ============================================================
        { code: 'pp_bc_1',   name_us: 'Single-Sided Business Cards – Plain Paper (500 pcs)', name_jp: '片面名刺 普通紙 500枚' },
        { code: 'pp_bc_2',   name_us: 'Single-Sided Business Cards – Premium Paper (200 pcs)', name_jp: '片面名刺 プレミアム紙 200枚' },
        { code: 'pp_bc_3',   name_us: 'Double-Sided Business Cards – Plain Paper (500 pcs)', name_jp: '両面名刺 普通紙 500枚' },
        { code: 'pp_bc_4',   name_us: 'Double-Sided Business Cards – Premium Paper (200 pcs)', name_jp: '両面名刺 プレミアム紙 200枚' },

        // ============================================================
        // ROLL BLIND
        // ============================================================
        { code: '45789_copy', name_us: 'Custom Roller Blind',                     name_jp: 'カスタムロールブラインド' },
        { code: '45789',      name_us: 'Custom Roller Blind',                     name_jp: 'カスタムロールブラインド' },
        { code: '23264',      name_us: 'Blackout Roller Blind',                   name_jp: '遮光ロールブラインド' },
        { code: '23299',      name_us: 'Premium Roller Blind Fabric',             name_jp: 'プレミアム ロールブラインド生地' },
        { code: 'fgn20001',   name_us: 'Kitchen Partition Screen',               name_jp: 'キッチン仕切りスクリーン' },

        // ============================================================
        // ACRYLIC
        // ============================================================
        { code: 'acr_smtgr_01', name_us: 'Custom Acrylic Phone Grip (PopSocket Style)', name_jp: 'カスタムアクリル スマホグリップ' },
        { code: 'acr_crt_stand_01', name_us: '10mm Thick Acrylic Block-Style Standee', name_jp: '10mm厚 アクリルブロック型スタンディ' },

        // ============================================================
        // FOAM BOARD
        // ============================================================
        { code: 'werwrwer',  name_us: 'Foam Board Sheet 5mm (1200×2400mm)',       name_jp: 'フォームボード 5mm (1200×2400mm)' },
        { code: '345454535', name_us: 'Foam Board Sheet 10mm (1200×2400mm)',      name_jp: 'フォームボード 10mm (1200×2400mm)' },

        // ============================================================
        // UA (User Art) — fix Korean names in name_us
        // ============================================================
        { code: 'ua_canvas_dda696ca_1772726002900', name_us: 'Sky & Clouds Landscape – Canvas Frame' },
        { code: 'ua_canvas_dda696ca_1772725398348', name_us: 'Turtle Illustration – Canvas Frame' },
        { code: 'ua_fabric_dda696ca_1772726002900', name_us: 'Sky & Clouds Landscape – Fabric Poster' },
        { code: 'ua_paper_dda696ca_1772726002900',  name_us: 'Sky & Clouds Landscape – Paper Poster' },
        // Japanese anime illustrations — keep them but make them readable
        { code: 'ua_canvas_dda696ca_1772726364033', name_us: 'Japanese Anime Girl Illustration – Canvas Frame' },
        { code: 'ua_canvas_dda696ca_1772726371655', name_us: 'Japanese Anime Girl Illustration – Canvas Frame' },
        { code: 'ua_canvas_dda696ca_1772726378736', name_us: 'Japanese Anime Girl Illustration – Canvas Frame' },
        { code: 'ua_canvas_dda696ca_1772726386570', name_us: 'Japanese Anime Girl Illustration – Canvas Frame' },
        { code: 'ua_canvas_dda696ca_1772726395787', name_us: 'Japanese Anime Girl Illustration – Canvas Frame' },
        { code: 'ua_canvas_dda696ca_1772726404196', name_us: 'Japanese Anime Girl Illustration – Canvas Frame' },
        { code: 'ua_fabric_dda696ca_1772726364033', name_us: 'Japanese Anime Girl Illustration – Fabric Poster' },
        { code: 'ua_fabric_dda696ca_1772726371655', name_us: 'Japanese Anime Girl Illustration – Fabric Poster' },
        { code: 'ua_fabric_dda696ca_1772726378736', name_us: 'Japanese Anime Girl Illustration – Fabric Poster' },
        { code: 'ua_fabric_dda696ca_1772726386570', name_us: 'Japanese Anime Girl Illustration – Fabric Poster' },
        { code: 'ua_fabric_dda696ca_1772726395787', name_us: 'Japanese Anime Girl Illustration – Fabric Poster' },
        { code: 'ua_fabric_dda696ca_1772726404196', name_us: 'Japanese Anime Girl Illustration – Fabric Poster' },
        { code: 'ua_paper_dda696ca_1772726364033',  name_us: 'Japanese Anime Girl Illustration – Paper Poster' },
        { code: 'ua_paper_dda696ca_1772726371655',  name_us: 'Japanese Anime Girl Illustration – Paper Poster' },
        { code: 'ua_paper_dda696ca_1772726378736',  name_us: 'Japanese Anime Girl Illustration – Paper Poster' },
        { code: 'ua_paper_dda696ca_1772726386570',  name_us: 'Japanese Anime Girl Illustration – Paper Poster' },
        { code: 'ua_paper_dda696ca_1772726395787',  name_us: 'Japanese Anime Girl Illustration – Paper Poster' },
        { code: 'ua_paper_dda696ca_1772726404196',  name_us: 'Japanese Anime Girl Illustration – Paper Poster' },
    ];

    console.log(`🚀 Starting batch update of ${updates.length} products...`);
    let success = 0, failed = 0;

    for (const item of updates) {
        const { code, ...fields } = item;
        const { error } = await sb.from('admin_products').update(fields).eq('code', code);
        if (error) {
            console.warn(`❌ [${code}] ${error.message}`);
            failed++;
        } else {
            console.log(`✅ [${code}] → ${fields.name_us}`);
            success++;
        }
    }

    console.log(`\n🎉 Done! ${success} updated, ${failed} failed.`);
    if (failed > 0) console.warn('Some updates failed — you may need to run this as an admin user.');
})();

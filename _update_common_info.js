// 상품 공통정보 업데이트 스크립트 — 히어로 섹션 + 주문 가이드 (8개 언어)
const { createClient } = require('@supabase/supabase-js');

(async () => {

const sb = createClient(
    'https://qinvtnhiidtmrzosyvys.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y'
);

// ─── 히어로 섹션 빌더 ───
function buildHero(data) {
    const labelColors = ['#e74c3c','#2563eb'];
    const pointCards = data.points.map((p, i) => {
        return `<div class="ch-card"><div class="ch-lb" style="color:${labelColors[i]}">${p.label}</div><div class="ch-ds">${p.desc}</div></div>`;
    }).join('\n');

    return `<style>
.ch-wrap{padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans KR',sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
.ch-hero{background:#1e1b4b;border-radius:16px;padding:30px 18px 22px}
.ch-hl{text-align:center;font-size:24px;font-weight:900;color:#fff;margin-bottom:6px;line-height:1.4;letter-spacing:-.3px}
.ch-sub{text-align:center;font-size:13px;color:rgba(255,255,255,.55);margin-bottom:18px;line-height:1.5}
.ch-cards{display:flex;flex-direction:column;gap:8px}
.ch-card{background:#fff;border-radius:12px;padding:16px 18px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.06)}
.ch-lb{font-size:17px;font-weight:800;margin-bottom:4px;line-height:1.35;letter-spacing:-.2px}
.ch-ds{font-size:14px;color:#555;line-height:1.5;font-weight:400;letter-spacing:-.1px}
.ch-ft{text-align:center;margin-top:14px;font-size:12.5px;color:rgba(255,255,255,.5);line-height:1.5}
.ch-slogan{text-align:center;padding:12px 14px;font-size:15px;font-weight:700;color:#4f46e5;letter-spacing:-.2px}
</style>
<div class="ch-wrap">
<div class="ch-hero">
<div class="ch-hl">${data.headline}</div>
<div class="ch-sub">${data.sub}</div>
<div class="ch-cards">
${pointCards}
</div>
<div class="ch-ft">${data.note}</div>
</div>
<div class="ch-slogan">${data.slogan}</div>
</div>`;
}

// ─── 주문 가이드 빌더 ───
function buildGuide(title, steps, closing) {
    const stepCards = steps.map((s, i) => {
        return `<div class="cg-s"><div class="cg-n">${i+1}</div><div class="cg-t">${s}</div></div>`;
    }).join('\n');

    return `<style>
.cg-w{padding:20px 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans KR',sans-serif;-webkit-font-smoothing:antialiased}
.cg-h{text-align:center;font-size:18px;font-weight:800;line-height:1.4;margin-bottom:16px;color:#1e293b;letter-spacing:-.3px}
.cg-sl{display:flex;flex-direction:column;gap:8px}
.cg-s{display:flex;align-items:center;gap:12px;border-radius:10px;padding:13px 14px;background:#fff;border:1px solid #b3b3b3}
.cg-n{min-width:32px;height:32px;border-radius:50%;color:#fff;font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:#4f46e5}
.cg-t{font-size:14px;color:#333;line-height:1.55;font-weight:500;letter-spacing:-.1px}
.cg-c{text-align:center;margin-top:16px;font-size:14px;font-weight:600;color:#6d28d9}
</style>
<div class="cg-w">
<div class="cg-h">${title}</div>
<div class="cg-sl">
${stepCards}
</div>
<div class="cg-c">${closing}</div>
</div>`;
}

// ═══════════════════════════════════════
// 히어로 섹션 — 8개 언어 (간결 v3)
// ═══════════════════════════════════════

const hero_kr = buildHero({
    headline: '도매 전문몰',
    sub: '압도적 가격과 퀄리티 보장<br>더 저렴하거나 더 품질이 좋은 곳은 세상에 없다',
    points: [
        { label: '국내 업체 평균 대비 절반 가격', desc: '국내 유일 초고사양 10컬러 라텍스 프린터' },
        { label: '도매몰 최소 주문 10만원, 하지만 확실한 보장', desc: '가격과 퀄리티 모두 최고 수준으로 준비했습니다' },
    ],
    note: '10만원 이하 소량주문은 배송비가 별도 발생합니다',
    slogan: '반값제작 무료배송 압도적퀄리티 카멜레온과 함께'
});

const hero_jp = buildHero({
    headline: '卸売専門モール',
    sub: '圧倒的な価格と品質を保証<br>これより安く、これより品質が良い場所は世界にない',
    points: [
        { label: '業界平均の半額', desc: '国内唯一の超高性能10カラーラテックスプリンター' },
        { label: '最低注文¥10,000、確かな保証', desc: '価格も品質も最高水準でご用意しました' },
    ],
    note: '¥10,000未満の少量注文は送料が別途発生します',
    slogan: '半額制作 送料無料 圧倒的クオリティ カメレオンと共に'
});

const hero_us = buildHero({
    headline: 'Wholesale Print Mall',
    sub: 'Unbeatable price and quality guaranteed<br>Nowhere cheaper, nowhere better',
    points: [
        { label: 'Half the industry average price', desc: 'The only ultra high-spec 10-color latex printer' },
        { label: 'Min. $100, Absolutely Guaranteed', desc: 'We deliver the best in both price and quality' },
    ],
    note: 'Orders under $100 are subject to a separate shipping fee',
    slogan: 'Half-price production · Free shipping · Unbeatable quality · With Chameleon'
});

const hero_cn = buildHero({
    headline: '批发专业商城',
    sub: '压倒性价格与品质保证<br>没有比这更便宜或品质更好的地方',
    points: [
        { label: '行业平均价格的一半', desc: '国内唯一超高规格10色乳胶打印机' },
        { label: '最低订单¥700，确实保障', desc: '价格与品质均以最高水准准备' },
    ],
    note: '¥700以下小批量订单需另付运费',
    slogan: '半价制作 免费配送 压倒性品质 与变色龙一起'
});

const hero_ar = buildHero({
    headline: 'سوق الجملة المتخصص',
    sub: 'أسعار وجودة لا تُضاهى<br>لا يوجد مكان أرخص أو أفضل جودة',
    points: [
        { label: 'نصف متوسط أسعار الصناعة', desc: 'الطابعة اللاتكس الوحيدة فائقة المواصفات بـ10 ألوان' },
        { label: 'الحد الأدنى $100، مضمون تماماً', desc: 'نقدم الأفضل في السعر والجودة معاً' },
    ],
    note: 'الطلبات أقل من $100 تخضع لرسوم شحن منفصلة',
    slogan: 'إنتاج بنصف السعر · شحن مجاني · جودة لا تُضاهى · مع كاميليون'
});

const hero_es = buildHero({
    headline: 'Centro Mayorista',
    sub: 'Precio y calidad imbatibles garantizados<br>No existe lugar más barato ni de mejor calidad',
    points: [
        { label: 'Mitad del precio promedio del sector', desc: 'La única impresora látex de ultra alta gama con 10 colores' },
        { label: 'Mín. $100, garantía absoluta', desc: 'Ofrecemos lo mejor en precio y calidad' },
    ],
    note: 'Pedidos menores de $100 tienen costo de envío adicional',
    slogan: 'Producción a mitad de precio · Envío gratis · Calidad insuperable · Con Chameleon'
});

const hero_de = buildHero({
    headline: 'Großhandel-Druckzentrum',
    sub: 'Unschlagbarer Preis und Qualität garantiert<br>Nirgendwo günstiger, nirgendwo besser',
    points: [
        { label: 'Halber Branchendurchschnittspreis', desc: 'Der einzige Ultra-High-Spec 10-Farben Latexdrucker' },
        { label: 'Min. 100€, absolut garantiert', desc: 'Wir bieten das Beste in Preis und Qualität' },
    ],
    note: 'Bestellungen unter 100€ unterliegen zusätzlichen Versandkosten',
    slogan: 'Halber Preis · Kostenloser Versand · Überlegene Qualität · Mit Chameleon'
});

const hero_fr = buildHero({
    headline: "Centre d'Impression en Gros",
    sub: "Prix et qualité imbattables garantis<br>Nulle part moins cher, nulle part meilleur",
    points: [
        { label: "Moitié du prix moyen du secteur", desc: "La seule imprimante latex ultra haut de gamme 10 couleurs" },
        { label: 'Min. 100€, garantie absolue', desc: 'Nous offrons le meilleur en prix et en qualité' },
    ],
    note: 'Les commandes inférieures à 100€ sont soumises à des frais de livraison',
    slogan: 'Production à moitié prix · Livraison gratuite · Qualité imbattable · Avec Chameleon'
});

// ═══════════════════════════════════════
// 주문 가이드 — 8개 언어
// ═══════════════════════════════════════

const guide_kr = buildGuide(
    '쉽게 주문하는 방법 알려드릴게요!',
    [
        '준비한 사진이나 PDF 파일이 있다면 올려주세요',
        '제작할 상품의 가로 또는 세로 크기 1개만 입력하면 나머지는 이미지를 확인해서 자동으로 입력됩니다',
        '만드실 제품의 수량을 선택하면 AI가 자동으로 견적을 계산합니다',
        '옵션을 선택해주세요. 그러면 아래에 최종 견적이 나옵니다',
        '파일이 없는 경우 에디터로 디자인하기를 누르면 쉽게 디자인하실 수 있습니다',
        '위에서 파일을 올리셨다면 구매하기를 누르면 장바구니로 이동해서 결제하시면 끝!'
    ],
    '오늘도 멋진 작품 만드세요 \u2728'
);

const guide_jp = buildGuide(
    '簡単な注文方法をご案内します！',
    [
        '準備した写真やPDFファイルがあればアップロードしてください',
        '製作する商品の横または縦サイズを1つだけ入力すれば、残りは画像を確認して自動入力されます',
        '製作する数量を選択すると、AIが自動で見積もりを計算します',
        'オプションを選択してください。下に最終見積もりが表示されます',
        'ファイルがない場合は「エディタでデザイン」をクリックすれば簡単にデザインできます',
        'ファイルをアップロードしたら「購入する」をクリック → カートに移動して決済すれば完了！'
    ],
    '今日も素敵な作品を作りましょう \u2728'
);

const guide_us = buildGuide(
    'Easy Ordering Guide',
    [
        'Upload your photo or PDF file if you have one ready',
        'Enter just one dimension (width or height) and the other will be auto-calculated from your image',
        'Select the quantity and AI will automatically calculate the estimate',
        'Choose your options. The final price will appear below',
        "Don't have a file? Click \"Design Editor\" to easily create your design",
        'If you uploaded a file, click "Purchase" to go to cart and complete payment!'
    ],
    'Create something amazing today \u2728'
);

const guide_cn = buildGuide(
    '简单订购指南',
    [
        '如果有准备好的照片或PDF文件，请上传',
        '只需输入商品的宽度或高度之一，系统会根据图片自动计算另一个尺寸',
        '选择制作数量后，AI会自动计算报价',
        '选择选项后，最终报价会显示在下方',
        '没有文件？点击"设计编辑器"可以轻松设计',
        '上传文件后点击"购买"，进入购物车完成付款即可！'
    ],
    '今天也做出精彩作品吧 \u2728'
);

const guide_ar = buildGuide(
    'دليل الطلب السهل',
    [
        'إذا كان لديك صورة أو ملف PDF جاهز، قم برفعه',
        'أدخل بُعداً واحداً فقط (العرض أو الارتفاع) وسيتم حساب الآخر تلقائياً من الصورة',
        'اختر الكمية وسيقوم الذكاء الاصطناعي بحساب التكلفة تلقائياً',
        'اختر الخيارات المطلوبة. سيظهر السعر النهائي أدناه',
        'ليس لديك ملف؟ انقر على "محرر التصميم" لتصميم بسهولة',
        'إذا رفعت ملفاً، انقر "شراء" للانتقال إلى السلة وإتمام الدفع!'
    ],
    'اصنع عملاً رائعاً اليوم \u2728'
);

const guide_es = buildGuide(
    'Guía de pedido fácil',
    [
        'Si tienes una foto o archivo PDF listo, súbelo',
        'Ingresa solo una dimensión (ancho o alto) y la otra se calculará automáticamente desde tu imagen',
        'Selecciona la cantidad y la IA calculará el presupuesto automáticamente',
        'Elige tus opciones. El precio final aparecerá abajo',
        '¿No tienes archivo? Haz clic en "Editor de Diseño" para diseñar fácilmente',
        'Si subiste un archivo, haz clic en "Comprar" para ir al carrito y completar el pago.'
    ],
    'Crea algo increíble hoy \u2728'
);

const guide_de = buildGuide(
    'Einfache Bestellanleitung',
    [
        'Laden Sie Ihr Foto oder PDF hoch, falls vorhanden',
        'Geben Sie nur eine Abmessung (Breite oder Höhe) ein — die andere wird automatisch aus dem Bild berechnet',
        'Wählen Sie die Menge und die KI berechnet automatisch den Preis',
        'Wählen Sie Ihre Optionen. Der Endpreis wird unten angezeigt',
        'Keine Datei? Klicken Sie auf "Design-Editor" um einfach zu gestalten',
        'Datei hochgeladen? Klicken Sie "Kaufen" → zum Warenkorb → Zahlung abschließen!'
    ],
    'Erstellen Sie heute etwas Großartiges \u2728'
);

const guide_fr = buildGuide(
    'Guide de commande facile',
    [
        'Si vous avez une photo ou un fichier PDF prêt, téléchargez-le',
        "Entrez une seule dimension (largeur ou hauteur) et l'autre sera calculée automatiquement à partir de votre image",
        "Sélectionnez la quantité et l'IA calculera automatiquement le devis",
        'Choisissez vos options. Le prix final apparaîtra ci-dessous',
        'Pas de fichier ? Cliquez sur "Éditeur de design" pour créer facilement votre design',
        'Fichier téléchargé ? Cliquez "Acheter" → panier → finalisez le paiement !'
    ],
    "Créez quelque chose d'incroyable aujourd'hui \u2728"
);

// ═══════════════════════════════════════
// 히어로 + 주문가이드 합치기
// ═══════════════════════════════════════

const kr = hero_kr + guide_kr;
const jp = hero_jp + guide_jp;
const us = hero_us + guide_us;
const cn = hero_cn + guide_cn;
const ar = hero_ar + guide_ar;
const es = hero_es + guide_es;
const de = hero_de + guide_de;
const fr = hero_fr + guide_fr;

// 1) 기존 데이터 백업
console.log('기존 데이터 조회...');
const { data: oldData } = await sb.from('common_info')
    .select('*').eq('section', 'top').eq('category_code', 'all').single();

const payload = {
    section: 'top',
    category_code: 'all',
    content: kr,
    content_jp: jp,
    content_us: us,
    content_cn: cn,
    content_ar: ar,
    content_es: es,
    content_de: de,
    content_fr: fr,
    content_backup: oldData?.content || '',
    content_backup_jp: oldData?.content_jp || '',
    content_backup_us: oldData?.content_us || '',
};

console.log('저장 중...');
const { error } = await sb.from('common_info').upsert(payload, {
    onConflict: 'section, category_code'
});

if (error) {
    console.error('저장 실패:', error);
} else {
    console.log('상품 공통정보 8개 언어 업데이트 완료! (히어로 v3 + 주문가이드)');
}

})();

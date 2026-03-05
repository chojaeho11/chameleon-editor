// 상품 공통정보 업데이트 스크립트 — 애니메이션 주문 가이드 (8개 언어)
const { createClient } = require('@supabase/supabase-js');

(async () => {

const sb = createClient(
    'https://qinvtnhiidtmrzosyvys.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y'
);

function buildHtml(title, steps, closing) {
    const icons = ['\u{1F4C1}', '\u{1F4CF}', '\u{1F9EE}', '\u{1F3AF}', '\u{1F3A8}', '\u{1F6D2}'];
    const bgColors   = ['#eef2ff','#ecfdf5','#fffbeb','#fdf2f8','#f5f3ff','#ecfeff'];
    const bdColors   = ['#c7d2fe','#a7f3d0','#fde68a','#fbcfe8','#ddd6fe','#a5f3fc'];
    const numGrads   = [
        'linear-gradient(135deg,#6366f1,#818cf8)',
        'linear-gradient(135deg,#10b981,#34d399)',
        'linear-gradient(135deg,#f59e0b,#fbbf24)',
        'linear-gradient(135deg,#ec4899,#f472b6)',
        'linear-gradient(135deg,#8b5cf6,#a78bfa)',
        'linear-gradient(135deg,#06b6d4,#22d3ee)'
    ];
    const numShadows = [
        'rgba(99,102,241,.3)',
        'rgba(16,185,129,.3)',
        'rgba(245,158,11,.3)',
        'rgba(236,72,153,.3)',
        'rgba(139,92,246,.3)',
        'rgba(6,182,212,.3)'
    ];

    const stepCards = steps.map((s, i) => {
        const d1 = (0.15 + i * 0.13).toFixed(2);
        const d2 = (0.22 + i * 0.13).toFixed(2);
        return `<div class="cg-s" style="animation-delay:${d1}s;background:${bgColors[i]};border-color:${bdColors[i]}"><div class="cg-n" style="animation-delay:${d2}s;background:${numGrads[i]};box-shadow:0 3px 12px ${numShadows[i]}">${i+1}</div><div class="cg-i">${icons[i]}</div><div class="cg-t">${s}</div></div>`;
    }).join('\n');

    return `<style>
@keyframes cgU{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
@keyframes cgP{0%{opacity:0;transform:scale(.2) rotate(-20deg)}65%{transform:scale(1.15) rotate(4deg)}100%{opacity:1;transform:scale(1) rotate(0)}}
@keyframes cgG{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
.cg-w{padding:22px 14px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif}
.cg-h{text-align:center;font-size:18px;font-weight:900;line-height:1.4;margin-bottom:20px;background:linear-gradient(270deg,#4f46e5,#7c3aed,#ec4899,#f59e0b,#4f46e5);background-size:300% 300%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:cgU .5s ease both,cgG 6s ease infinite}
.cg-sl{display:flex;flex-direction:column;gap:10px}
.cg-s{display:flex;align-items:center;gap:12px;border-radius:14px;padding:13px 14px;border:1.5px solid;opacity:0;animation:cgU .5s cubic-bezier(.22,1,.36,1) both;transition:transform .25s cubic-bezier(.22,1,.36,1),box-shadow .25s ease}
.cg-s:hover{transform:translateY(-4px) scale(1.015);box-shadow:0 10px 30px rgba(0,0,0,.1)!important}
.cg-n{min-width:38px;height:38px;border-radius:50%;color:#fff;font-weight:800;font-size:16px;display:flex;align-items:center;justify-content:center;opacity:0;animation:cgP .5s cubic-bezier(.22,1,.36,1) both;flex-shrink:0}
.cg-i{font-size:24px;min-width:30px;text-align:center;flex-shrink:0}
.cg-t{font-size:13.5px;color:#1e293b;line-height:1.55;font-weight:500}
.cg-c{text-align:center;margin-top:20px;font-size:15px;font-weight:700;color:#6d28d9;opacity:0;animation:cgU .5s ease both;animation-delay:.95s}
</style>
<div class="cg-w">
<div class="cg-h">${title}</div>
<div class="cg-sl">
${stepCards}
</div>
<div class="cg-c">${closing}</div>
</div>`;
}

// 한국어
const kr = buildHtml(
    '쉽게 주문하는 방법 알려드릴게요!',
    [
        '준비한 사진이나 PDF 파일이 있다면 올려주세요',
        '제작할 상품의 가로 또는 세로 크기 1개만 입력하면 나머지는 이미지를 확인해서 자동으로 입력됩니다',
        '만드실 제품의 수량을 선택하면 AI가 자동으로 견적을 계산합니다',
        '옵션을 선택해주세요. 그러면 아래에 최종 견적이 나옵니다',
        '파일이 없는 경우 에디터로 디자인하기를 누르면 쉽게 디자인하실 수 있습니다',
        '위에서 파일을 올리셨다면 구매하기를 누르면 장바구니로 이동해서 결제하시면 끝!'
    ],
    '오늘도 멋진 작품 만드세요 ✨'
);

// 일본어
const jp = buildHtml(
    '簡単な注文方法をご案内します！',
    [
        '準備した写真やPDFファイルがあればアップロードしてください',
        '製作する商品の横または縦サイズを1つだけ入力すれば、残りは画像を確認して自動入力されます',
        '製作する数量を選択すると、AIが自動で見積もりを計算します',
        'オプションを選択してください。下に最終見積もりが表示されます',
        'ファイルがない場合は「エディタでデザイン」をクリックすれば簡単にデザインできます',
        'ファイルをアップロードしたら「購入する」をクリック → カートに移動して決済すれば完了！'
    ],
    '今日も素敵な作品を作りましょう ✨'
);

// 영어
const us = buildHtml(
    'Easy Ordering Guide',
    [
        'Upload your photo or PDF file if you have one ready',
        'Enter just one dimension (width or height) and the other will be auto-calculated from your image',
        'Select the quantity and AI will automatically calculate the estimate',
        'Choose your options. The final price will appear below',
        "Don't have a file? Click \"Design Editor\" to easily create your design",
        'If you uploaded a file, click "Purchase" to go to cart and complete payment!'
    ],
    'Create something amazing today ✨'
);

// 중국어
const cn = buildHtml(
    '简单订购指南',
    [
        '如果有准备好的照片或PDF文件，请上传',
        '只需输入商品的宽度或高度之一，系统会根据图片自动计算另一个尺寸',
        '选择制作数量后，AI会自动计算报价',
        '选择选项后，最终报价会显示在下方',
        '没有文件？点击"设计编辑器"可以轻松设计',
        '上传文件后点击"购买"，进入购物车完成付款即可！'
    ],
    '今天也做出精彩作品吧 ✨'
);

// 아랍어
const ar = buildHtml(
    'دليل الطلب السهل',
    [
        'إذا كان لديك صورة أو ملف PDF جاهز، قم برفعه',
        'أدخل بُعداً واحداً فقط (العرض أو الارتفاع) وسيتم حساب الآخر تلقائياً من الصورة',
        'اختر الكمية وسيقوم الذكاء الاصطناعي بحساب التكلفة تلقائياً',
        'اختر الخيارات المطلوبة. سيظهر السعر النهائي أدناه',
        'ليس لديك ملف؟ انقر على "محرر التصميم" لتصميم بسهولة',
        'إذا رفعت ملفاً، انقر "شراء" للانتقال إلى السلة وإتمام الدفع!'
    ],
    'اصنع عملاً رائعاً اليوم ✨'
);

// 스페인어
const es = buildHtml(
    'Guía de pedido fácil',
    [
        'Si tienes una foto o archivo PDF listo, súbelo',
        'Ingresa solo una dimensión (ancho o alto) y la otra se calculará automáticamente desde tu imagen',
        'Selecciona la cantidad y la IA calculará el presupuesto automáticamente',
        'Elige tus opciones. El precio final aparecerá abajo',
        '¿No tienes archivo? Haz clic en "Editor de Diseño" para diseñar fácilmente',
        'Si subiste un archivo, haz clic en "Comprar" para ir al carrito y completar el pago.'
    ],
    'Crea algo increíble hoy ✨'
);

// 독일어
const de = buildHtml(
    'Einfache Bestellanleitung',
    [
        'Laden Sie Ihr Foto oder PDF hoch, falls vorhanden',
        'Geben Sie nur eine Abmessung (Breite oder Höhe) ein — die andere wird automatisch aus dem Bild berechnet',
        'Wählen Sie die Menge und die KI berechnet automatisch den Preis',
        'Wählen Sie Ihre Optionen. Der Endpreis wird unten angezeigt',
        'Keine Datei? Klicken Sie auf "Design-Editor" um einfach zu gestalten',
        'Datei hochgeladen? Klicken Sie "Kaufen" → zum Warenkorb → Zahlung abschließen!'
    ],
    'Erstellen Sie heute etwas Großartiges ✨'
);

// 프랑스어
const fr = buildHtml(
    'Guide de commande facile',
    [
        'Si vous avez une photo ou un fichier PDF prêt, téléchargez-le',
        "Entrez une seule dimension (largeur ou hauteur) et l'autre sera calculée automatiquement à partir de votre image",
        "Sélectionnez la quantité et l'IA calculera automatiquement le devis",
        'Choisissez vos options. Le prix final apparaîtra ci-dessous',
        'Pas de fichier ? Cliquez sur "Éditeur de design" pour créer facilement votre design',
        'Fichier téléchargé ? Cliquez "Acheter" → panier → finalisez le paiement !'
    ],
    "Créez quelque chose d'incroyable aujourd'hui ✨"
);

// 1) 기존 데이터 백업
console.log('📦 기존 데이터 조회...');
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

console.log('💾 저장 중...');
const { error } = await sb.from('common_info').upsert(payload, {
    onConflict: 'section, category_code'
});

if (error) {
    console.error('❌ 저장 실패:', error);
} else {
    console.log('✅ 상품 공통정보 8개 언어 업데이트 완료!');
}

})();

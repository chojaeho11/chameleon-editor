// 상품 공통정보 업데이트 스크립트 — 주문 가이드 + 상담 버튼 (8개 언어)
const { createClient } = require('@supabase/supabase-js');

(async () => {

const sb = createClient(
    'https://qinvtnhiidtmrzosyvys.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y'
);

function buildHtml(title, steps, closing, consultText, btnText) {
    return `<div style="background:linear-gradient(135deg,#f0f9ff,#ede9fe); border:1px solid #c7d2fe; border-radius:12px; padding:20px 18px; line-height:1.8; font-size:14px; color:#1e293b;">
<div style="font-size:16px; font-weight:800; color:#4f46e5; margin-bottom:12px; text-align:center;">📋 ${title}</div>
<div style="font-size:13px;">
${steps.map((s, i) => `<b>${i+1})</b> ${s}`).join('<br>\n')}
</div>
<div style="text-align:center; margin-top:10px; font-size:14px; font-weight:600; color:#6d28d9;">${closing}</div>
<hr style="border:none; border-top:1px solid #c7d2fe; margin:14px 0;">
<div style="text-align:center; font-size:13px; color:#64748b; margin-bottom:8px;">${consultText}</div>
<div style="text-align:center;"><button onclick="if(window.ChamBot)window.ChamBot.toggle();" style="background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; border:none; padding:10px 28px; border-radius:50px; font-size:14px; font-weight:700; cursor:pointer; box-shadow:0 2px 8px rgba(99,102,241,0.3);">${btnText}</button></div>
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
    '오늘도 멋진 작품 만드세요 ✨',
    '디자인 의뢰가 필요하거나 궁금한 점이 있으시면',
    '💬 상담하기'
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
    '今日も素敵な作品を作りましょう ✨',
    'デザイン依頼やご質問がございましたら',
    '💬 相談する'
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
    'Create something amazing today ✨',
    'Need design help or have questions?',
    '💬 Chat with Us'
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
    '今天也做出精彩作品吧 ✨',
    '需要设计委托或有疑问时',
    '💬 在线咨询'
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
    'اصنع عملاً رائعاً اليوم ✨',
    'هل تحتاج مساعدة في التصميم أو لديك أسئلة؟',
    '💬 تواصل معنا'
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
    'Crea algo increíble hoy ✨',
    '¿Necesitas ayuda con el diseño o tienes preguntas?',
    '💬 Consultar'
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
    'Erstellen Sie heute etwas Großartiges ✨',
    'Brauchen Sie Design-Hilfe oder haben Fragen?',
    '💬 Beratung'
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
    "Créez quelque chose d'incroyable aujourd'hui ✨",
    'Besoin d\'aide pour le design ou des questions ?',
    '💬 Nous contacter'
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
    // 기본 백업 (존재하는 필드만)
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

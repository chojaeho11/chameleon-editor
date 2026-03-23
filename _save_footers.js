// 상품 공통 하단 안내문 일괄 저장 스크립트 (v2 - 깔끔한 디자인)
const SUPABASE_URL = 'https://qinvtnhiidtmrzosyvys.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y';

// 공통 스타일
const S = {
    wrap: `background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:28px 32px; font-size:15px; line-height:2; color:#333;`,
    title: `font-size:18px; font-weight:700; color:#111; margin-bottom:14px; padding-bottom:10px; border-bottom:2px solid #111;`,
    row: `padding:16px 0; border-bottom:1px solid #e5e7eb;`,
    rowLast: `padding:16px 0;`,
    label: `font-weight:700; color:#111; font-size:15px;`,
    txt: `color:#555; font-size:14px; line-height:1.9; margin-top:6px;`,
    bottom: `text-align:center; padding:16px 0 0; color:#999; font-size:12px; margin-top:8px;`
};

const footers = {

kr: `<div style="${S.wrap} font-family:'Pretendard','Apple SD Gothic Neo',sans-serif;">
  <div style="${S.title}">안내사항</div>

  <div style="${S.row}">
    <div style="${S.label}">📦 배송 안내</div>
    <div style="${S.txt}">
      <b>전 제품 무료배송</b> (허니콤보드 설치배송 제외)<br>
      소형 인쇄물 : 결제 완료 후 2~3 영업일 이내 출고<br>
      대형 제작물(허니콤보드 등) : 별도 화물 배송<br>
      허니콤보드 설치가 필요한 경우 별도 배송비 발생
    </div>
  </div>

  <div style="${S.row}">
    <div style="${S.label}">💳 결제 안내</div>
    <div style="${S.txt}">
      신용카드 / 간편결제 (카카오페이, 네이버페이 등)<br>
      무통장 입금 (입금 확인 후 제작 시작)<br>
      예치금 결제 (마이페이지에서 충전 가능)<br>
      세금계산서 발행 : 주문 시 요청사항에 기재
    </div>
  </div>

  <div style="${S.row}">
    <div style="${S.label}">⚠️ 주문 유의사항</div>
    <div style="${S.txt}">
      모든 제작 상품은 <b>주문 제작</b> 특성상, 제작 착수 후 변경·취소가 불가합니다.<br>
      모니터 환경에 따라 실제 인쇄 색상과 차이가 있을 수 있습니다.<br>
      업로드 파일의 해상도가 낮을 경우 인쇄 품질이 저하될 수 있습니다. (권장: 300dpi 이상)<br>
      대량 주문(50개 이상)은 별도 견적 문의 바랍니다.
    </div>
  </div>

  <div style="${S.row}">
    <div style="${S.label}">🔄 교환 · 반품</div>
    <div style="${S.txt}">
      주문 제작 상품은 단순 변심 교환·반품 불가<br>
      인쇄 불량·파손의 경우 수령 후 3일 이내 접수<br>
      사진 촬영 후 채팅 상담 또는 이메일로 접수<br>
      불량 확인 후 재제작 또는 환불 처리
    </div>
  </div>

  <div style="${S.rowLast}">
    <div style="${S.label}">📞 고객 지원</div>
    <div style="${S.txt}">
      AI 챗봇 상담 : 24시간 운영<br>
      실시간 채팅 : 평일 09:00 ~ 18:00<br>
      홈페이지 : <b>cafe2626.com</b><br>
      긴급 문의 : 상담 채팅에서 매니저 연결
    </div>
  </div>

  <div style="${S.bottom}">카멜레온프린팅 | 전세계 20여 개국 560개 협력사와 함께합니다</div>
</div>`,

ja: `<div style="${S.wrap} font-family:'Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif;">
  <div style="${S.title}">ご案内</div>

  <div style="${S.row}">
    <div style="${S.label}">📦 配送について</div>
    <div style="${S.txt}">
      <b>全商品 送料無料</b>（リボード施工配送を除く）<br>
      リボードの設置が必要な場合、別途配送料が発生します<br>
      小型印刷物 : お支払い確認後 5~7営業日で出荷<br>
      大型製作物（リボード等） : 別途貨物便で配送
    </div>
  </div>

  <div style="${S.row}">
    <div style="${S.label}">💳 お支払い方法</div>
    <div style="${S.txt}">
      クレジットカード（VISA / Master / JCB / AMEX）<br>
      銀行振込（入金確認後に製作開始）<br>
      デポジット払い（マイページでチャージ可能）<br>
      領収書発行 : ご注文時に備考欄に記載
    </div>
  </div>

  <div style="${S.row}">
    <div style="${S.label}">⚠️ ご注文時の注意事項</div>
    <div style="${S.txt}">
      すべての製品は<b>受注製作</b>のため、製作開始後の変更・キャンセルはできません。<br>
      モニター環境により実際の印刷色と差が生じる場合があります。<br>
      アップロードファイルの解像度が低い場合、印刷品質が低下します。（推奨: 300dpi以上）<br>
      大量注文（50個以上）は別途お見積もりください。
    </div>
  </div>

  <div style="${S.row}">
    <div style="${S.label}">🔄 交換・返品</div>
    <div style="${S.txt}">
      受注製作品のため、お客様都合の返品・交換は不可<br>
      印刷不良・破損の場合は受領後3日以内にご連絡<br>
      写真撮影の上、チャットまたはメールで受付<br>
      不良確認後、再製作または返金対応
    </div>
  </div>

  <div style="${S.rowLast}">
    <div style="${S.label}">📞 カスタマーサポート</div>
    <div style="${S.txt}">
      AIチャットボット : 24時間対応<br>
      ライブチャット : 平日 09:00～18:00<br>
      ウェブサイト : <b>cafe0101.com</b><br>
      緊急のお問い合わせ : チャットでマネージャーに接続
    </div>
  </div>

  <div style="${S.bottom}">Chameleon Printing | 世界20カ国以上、560社のパートナーと共に</div>
</div>`,

en: `<div style="${S.wrap} font-family:'Inter','Segoe UI',sans-serif;">
  <div style="${S.title}">Information</div>

  <div style="${S.row}">
    <div style="${S.label}">📦 Shipping</div>
    <div style="${S.txt}">
      <b>Free shipping on ALL products</b> (except Re-board installation delivery)<br>
      Re-board installation delivery incurs a separate shipping fee<br>
      Small prints : Ships within 7~10 business days after payment<br>
      Large items (Re-boards, etc.) : Shipped via freight
    </div>
  </div>

  <div style="${S.row}">
    <div style="${S.label}">💳 Payment</div>
    <div style="${S.txt}">
      Credit Card (Visa / Mastercard / AMEX / JCB)<br>
      Bank Transfer (production starts after confirmation)<br>
      Deposit Balance (recharge via My Page)<br>
      Invoice available upon request in order notes
    </div>
  </div>

  <div style="${S.row}">
    <div style="${S.label}">⚠️ Important Notes</div>
    <div style="${S.txt}">
      All products are <b>made-to-order</b>. Changes or cancellations are not possible once production begins.<br>
      Colors may vary slightly from screen display due to monitor settings.<br>
      Low resolution files may result in reduced print quality. (Recommended: 300dpi+)<br>
      For bulk orders (50+ units), please contact us for a custom quote.
    </div>
  </div>

  <div style="${S.row}">
    <div style="${S.label}">🔄 Returns & Exchanges</div>
    <div style="${S.txt}">
      Custom-made products : Returns for change of mind are not accepted<br>
      Defective or damaged items : Report within 3 days of receipt<br>
      Provide photos via chat or email for processing<br>
      Verified defects will be reprinted or refunded
    </div>
  </div>

  <div style="${S.rowLast}">
    <div style="${S.label}">📞 Customer Support</div>
    <div style="${S.txt}">
      AI Chatbot : Available 24/7<br>
      Live Chat : Weekdays 09:00 - 18:00 (KST)<br>
      Website : <b>cafe3355.com</b><br>
      Urgent inquiries : Connect to a manager via chat
    </div>
  </div>

  <div style="${S.bottom}">Chameleon Printing | Operating with 560+ partners across 20+ countries</div>
</div>`,

zh: `<div style="${S.wrap} font-family:'PingFang SC','Microsoft YaHei',sans-serif;">
  <div style="${S.title}">须知</div>

  <div style="${S.row}">
    <div style="${S.label}">📦 配送说明</div>
    <div style="${S.txt}">
      <b>全部商品 免费配送</b>（Re-board施工配送除外）<br>
      Re-board需要安装时，另收配送费<br>
      小型印刷品 : 付款后7~10个工作日内发货<br>
      大型制品（Re-board等） : 通过货运配送
    </div>
  </div>

  <div style="${S.row}">
    <div style="${S.label}">💳 支付方式</div>
    <div style="${S.txt}">
      信用卡（Visa / Mastercard / AMEX / JCB）<br>
      银行转账（确认到账后开始制作）<br>
      预存款支付（可在"我的页面"充值）<br>
      如需发票，请在订单备注中注明
    </div>
  </div>

  <div style="${S.row}">
    <div style="${S.label}">⚠️ 订购注意事项</div>
    <div style="${S.txt}">
      所有产品均为<b>定制生产</b>，开始制作后无法更改或取消。<br>
      由于显示器差异，实际印刷颜色可能与屏幕显示略有不同。<br>
      上传文件分辨率过低可能影响印刷质量。（建议：300dpi以上）<br>
      批量订购（50件以上）请联系我们获取优惠报价。
    </div>
  </div>

  <div style="${S.row}">
    <div style="${S.label}">🔄 退换货政策</div>
    <div style="${S.txt}">
      定制产品不接受因个人原因的退换货<br>
      印刷缺陷或损坏请在收货后3天内联系<br>
      请拍照后通过在线客服或邮件提交<br>
      确认缺陷后将重新制作或退款
    </div>
  </div>

  <div style="${S.rowLast}">
    <div style="${S.label}">📞 客户服务</div>
    <div style="${S.txt}">
      AI智能客服 : 全天24小时在线<br>
      在线客服 : 工作日 09:00～18:00<br>
      网站 : <b>cafe3355.com</b><br>
      紧急咨询 : 在线客服中连接专员
    </div>
  </div>

  <div style="${S.bottom}">Chameleon Printing | 与全球20多个国家560家合作伙伴共同运营</div>
</div>`,

ar: `<div style="${S.wrap} font-family:'Noto Sans Arabic',sans-serif; direction:rtl;">
  <div style="${S.title}">معلومات</div>

  <div style="${S.row}">
    <div style="${S.label}">📦 معلومات الشحن</div>
    <div style="${S.txt}">
      <b>جميع المنتجات شحن مجاني</b> (باستثناء توصيل تركيب الألواح السداسية)<br>
      توصيل تركيب الألواح السداسية يتطلب رسوم شحن منفصلة<br>
      المطبوعات الصغيرة : الشحن خلال 7-10 أيام عمل بعد الدفع<br>
      المنتجات الكبيرة (الألواح السداسية) : تشحن بالشحن البري
    </div>
  </div>

  <div style="${S.row}">
    <div style="${S.label}">💳 طرق الدفع</div>
    <div style="${S.txt}">
      بطاقة ائتمان (Visa / Mastercard / AMEX)<br>
      تحويل بنكي (يبدأ الإنتاج بعد التأكيد)<br>
      رصيد الإيداع (الشحن من صفحتي)<br>
      لطلب فاتورة، يرجى الإشارة في ملاحظات الطلب
    </div>
  </div>

  <div style="${S.row}">
    <div style="${S.label}">⚠️ ملاحظات مهمة</div>
    <div style="${S.txt}">
      جميع المنتجات <b>مصنوعة حسب الطلب</b>. لا يمكن التعديل أو الإلغاء بعد بدء الإنتاج.<br>
      قد تختلف الألوان المطبوعة قليلاً عن العرض على الشاشة.<br>
      الملفات منخفضة الدقة قد تؤثر على جودة الطباعة. (الموصى به: 300dpi+)<br>
      للطلبات بالجملة (50+ وحدة)، يرجى الاتصال بنا للحصول على عرض سعر.
    </div>
  </div>

  <div style="${S.row}">
    <div style="${S.label}">🔄 الإرجاع والاستبدال</div>
    <div style="${S.txt}">
      المنتجات المخصصة : لا يقبل الإرجاع لتغيير الرأي<br>
      المنتجات المعيبة : أبلغ خلال 3 أيام من الاستلام<br>
      قدم صوراً عبر الدردشة أو البريد الإلكتروني<br>
      العيوب المؤكدة : إعادة تصنيع أو استرداد
    </div>
  </div>

  <div style="${S.rowLast}">
    <div style="${S.label}">📞 خدمة العملاء</div>
    <div style="${S.txt}">
      روبوت الدردشة AI : متاح على مدار الساعة<br>
      الدردشة المباشرة : أيام العمل 09:00 - 18:00<br>
      الموقع : <b>cafe3355.com</b><br>
      استفسارات عاجلة : اتصل بمدير عبر الدردشة
    </div>
  </div>

  <div style="${S.bottom}">Chameleon Printing | نعمل مع أكثر من 560 شريكاً في 20+ دولة</div>
</div>`,

es: `<div style="${S.wrap} font-family:'Inter','Segoe UI',sans-serif;">
  <div style="${S.title}">Informacion</div>

  <div style="${S.row}">
    <div style="${S.label}">📦 Envio</div>
    <div style="${S.txt}">
      <b>Envio gratuito en TODOS los productos</b> (excepto entrega con instalacion de paneles Re-board)<br>
      La entrega con instalacion de paneles Re-board tiene un cargo de envio aparte<br>
      Impresiones pequenas : Envio en 7~10 dias habiles tras el pago<br>
      Articulos grandes (paneles Re-board) : Se envian por transporte de carga
    </div>
  </div>

  <div style="${S.row}">
    <div style="${S.label}">💳 Metodos de pago</div>
    <div style="${S.txt}">
      Tarjeta de credito (Visa / Mastercard / AMEX)<br>
      Transferencia bancaria (produccion inicia tras confirmacion)<br>
      Saldo de deposito (recargar en Mi Pagina)<br>
      Factura disponible bajo solicitud en notas del pedido
    </div>
  </div>

  <div style="${S.row}">
    <div style="${S.label}">⚠️ Notas importantes</div>
    <div style="${S.txt}">
      Todos los productos son <b>fabricados bajo pedido</b>. No se aceptan cambios ni cancelaciones una vez iniciada la produccion.<br>
      Los colores pueden variar ligeramente segun la configuracion del monitor.<br>
      Archivos de baja resolucion pueden afectar la calidad de impresion. (Recomendado: 300dpi+)<br>
      Para pedidos al por mayor (50+ unidades), contactenos para un presupuesto.
    </div>
  </div>

  <div style="${S.row}">
    <div style="${S.label}">🔄 Devoluciones y cambios</div>
    <div style="${S.txt}">
      Productos personalizados : No se aceptan devoluciones por cambio de opinion<br>
      Articulos defectuosos : Reportar dentro de 3 dias tras la recepcion<br>
      Enviar fotos por chat o correo electronico<br>
      Defectos verificados : Reimpresion o reembolso
    </div>
  </div>

  <div style="${S.rowLast}">
    <div style="${S.label}">📞 Atencion al cliente</div>
    <div style="${S.txt}">
      Chatbot IA : Disponible 24/7<br>
      Chat en vivo : Lunes a viernes 09:00 - 18:00 (KST)<br>
      Web : <b>cafe3355.com</b><br>
      Consultas urgentes : Conectar con un agente por chat
    </div>
  </div>

  <div style="${S.bottom}">Chameleon Printing | Operando con mas de 560 socios en 20+ paises</div>
</div>`,

fr: `<div style="${S.wrap} font-family:'Inter','Segoe UI',sans-serif;">
  <div style="${S.title}">Informations</div>

  <div style="${S.row}">
    <div style="${S.label}">📦 Livraison</div>
    <div style="${S.txt}">
      <b>Livraison gratuite sur TOUS les produits</b> (sauf livraison avec installation de panneaux nid d'abeille)<br>
      La livraison avec installation de panneaux nid d'abeille entraine des frais de livraison separes<br>
      Petits imprimes : Expedition sous 7 a 10 jours ouvres apres paiement<br>
      Grands articles (panneaux nid d'abeille) : Expedition par fret
    </div>
  </div>

  <div style="${S.row}">
    <div style="${S.label}">💳 Paiement</div>
    <div style="${S.txt}">
      Carte bancaire (Visa / Mastercard / AMEX)<br>
      Virement bancaire (production apres confirmation)<br>
      Solde de depot (rechargeable via Mon Compte)<br>
      Facture sur demande dans les notes de commande
    </div>
  </div>

  <div style="${S.row}">
    <div style="${S.label}">⚠️ Notes importantes</div>
    <div style="${S.txt}">
      Tous les produits sont <b>fabriques sur commande</b>. Aucune modification ni annulation apres le debut de la production.<br>
      Les couleurs peuvent varier legerement selon les parametres de l'ecran.<br>
      Les fichiers basse resolution peuvent affecter la qualite d'impression. (Recommande : 300dpi+)<br>
      Pour les commandes en gros (50+ unites), contactez-nous pour un devis.
    </div>
  </div>

  <div style="${S.row}">
    <div style="${S.label}">🔄 Retours et echanges</div>
    <div style="${S.txt}">
      Produits sur mesure : Retours pour changement d'avis non acceptes<br>
      Defauts ou dommages : Signaler sous 3 jours apres reception<br>
      Fournir des photos via chat ou e-mail<br>
      Defauts confirmes : Reimpression ou remboursement
    </div>
  </div>

  <div style="${S.rowLast}">
    <div style="${S.label}">📞 Service client</div>
    <div style="${S.txt}">
      Chatbot IA : Disponible 24h/24<br>
      Chat en direct : Lundi-Vendredi 09h00 - 18h00 (KST)<br>
      Site web : <b>cafe3355.com</b><br>
      Urgences : Connectez-vous a un conseiller via le chat
    </div>
  </div>

  <div style="${S.bottom}">Chameleon Printing | Plus de 560 partenaires dans 20+ pays</div>
</div>`,

de: `<div style="${S.wrap} font-family:'Inter','Segoe UI',sans-serif;">
  <div style="${S.title}">Informationen</div>

  <div style="${S.row}">
    <div style="${S.label}">📦 Versand</div>
    <div style="${S.txt}">
      <b>Kostenloser Versand fuer ALLE Produkte</b> (ausser Lieferung mit Installation von Wabenplatten)<br>
      Lieferung mit Installation von Wabenplatten erfordert separate Versandkosten<br>
      Kleine Drucke : Versand innerhalb von 7-10 Werktagen nach Zahlung<br>
      Grosse Artikel (Wabenplatten) : Versand per Spedition
    </div>
  </div>

  <div style="${S.row}">
    <div style="${S.label}">💳 Zahlungsmethoden</div>
    <div style="${S.txt}">
      Kreditkarte (Visa / Mastercard / AMEX)<br>
      Bankueberweisung (Produktion nach Zahlungseingang)<br>
      Guthaben (aufladbar ueber Mein Konto)<br>
      Rechnung auf Anfrage in den Bestellnotizen
    </div>
  </div>

  <div style="${S.row}">
    <div style="${S.label}">⚠️ Wichtige Hinweise</div>
    <div style="${S.txt}">
      Alle Produkte werden <b>auf Bestellung gefertigt</b>. Nach Produktionsbeginn sind keine Aenderungen oder Stornierungen moeglich.<br>
      Farben koennen je nach Monitoreinstellung leicht abweichen.<br>
      Dateien mit niedriger Aufloesung koennen die Druckqualitaet beeintraechtigen. (Empfohlen: 300dpi+)<br>
      Fuer Grossbestellungen (50+ Stueck) kontaktieren Sie uns fuer ein Angebot.
    </div>
  </div>

  <div style="${S.row}">
    <div style="${S.label}">🔄 Rueckgabe & Umtausch</div>
    <div style="${S.txt}">
      Massgefertigte Produkte : Rueckgabe bei Meinungsaenderung nicht moeglich<br>
      Defekte/beschaedigte Artikel : Meldung innerhalb von 3 Tagen nach Erhalt<br>
      Fotos per Chat oder E-Mail einreichen<br>
      Bestaetigte Maengel : Neudruck oder Rueckerstattung
    </div>
  </div>

  <div style="${S.rowLast}">
    <div style="${S.label}">📞 Kundenservice</div>
    <div style="${S.txt}">
      KI-Chatbot : Rund um die Uhr verfuegbar<br>
      Live-Chat : Mo-Fr 09:00 - 18:00 (KST)<br>
      Webseite : <b>cafe3355.com</b><br>
      Dringende Anfragen : Berater per Chat kontaktieren
    </div>
  </div>

  <div style="${S.bottom}">Chameleon Printing | Ueber 560 Partner in mehr als 20 Laendern</div>
</div>`

};

async function saveAll() {
    const url = SUPABASE_URL + '/rest/v1/chatbot_knowledge';
    const headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
    };

    // 1. 기존 _product_footer 비활성화
    const patchRes = await fetch(url + '?category=eq._product_footer', {
        method: 'PATCH',
        headers: { ...headers, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ is_active: false })
    });
    console.log('Deactivated old footers:', patchRes.status);

    // 2. 새로 삽입
    for (const [lang, content] of Object.entries(footers)) {
        const body = {
            category: '_product_footer',
            question: 'product_footer_' + lang,
            answer: content,
            keywords: '',
            language: lang,
            priority: 0,
            is_active: true
        };
        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });
        console.log(`Saved [${lang}]:`, res.status);
    }
    console.log('All done!');
}

saveAll();

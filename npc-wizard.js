// ═══════════════════════════════════════════════════════════════
// NPC 가이드 주문 위자드 — PC + 모바일 공통
// 기존 모달 요소를 단계별로 show/hide하여 게임 NPC 안내 느낌 제공
// ═══════════════════════════════════════════════════════════════

// NPC 캐릭터 이미지 (투명 PNG)
const NPC_IMG = './img/npc-guide.png';

const NPC_TEXTS = {
    kr: {
        hcAskConsulted: '매니저와 상담하셨나요? 🤝',
        hcYes: '상담완료했어요',
        hcNo: '아니요, 아직이요',
        hcInputAmount: '받으신 견적금액을 입력해 주세요 💰',
        hcConsultManager: '💬 매니저와 상담하기',
        hcOrderDirect: '🛒 직접 주문하기',
        hcChooseAction: '어떻게 하시겠어요?',
        hcPay: '💳 결제하기',
        hcAmountPlaceholder: '금액 입력',
        enterArea: '시공면적을 적어주세요 📐',
        askFile: '가지고 계신 사진이나 파일로 인쇄의뢰 하실건가요?',
        yes: '네, 있어요!',
        no: '디자인 해야해요',
        uploadFile: '파일을 올려주세요',
        enterSize: '사이즈를 입력하시면 견적을 드릴게요 📏',
        selectOption: '옵션을 선택하세요 ✨',
        finalCart: '구매하기 버튼만 누르면 끝! 수정이 필요하다면 에디터에서 디자인하기를 눌러주세요 🎉',
        finalEditor: '에디터에서 디자인하기를 눌러 직접 디자인해보세요! 🎨',
        chooseDesign: '어떻게 디자인하시겠어요?',
        selfDesign: '🎨 직접 디자인하기',
        expertDesign: '👨‍🎨 전문가에게 의뢰',
        expertMsg: '채팅을 열어드릴테니 상담사와 상담 후 진행해 주세요 💬',
        selectQty: '수량을 선택해주세요 📦',
        cartFinal: '장바구니에 담으면 끝! 🎉',
        next: '다음 →',
        prev: '← 이전',
        skipOption: '옵션 없이 진행 →',
        uploaded: '업로드 완료! 다음으로 넘어갈게요 👍',
        // 종이매대 (Paper Display Stand)
        pdEnterSize: '매대의 전체 크기를 입력해주세요 📐',
        pdWidth: '가로 (cm)',
        pdHeight: '높이 (cm)',
        pdDepth: '깊이 (cm)',
        pdAdHeightDesc: '상단 광고판 높이를 입력하세요 (기본 20cm) 📢',
        pdShelfHeight: '선반 높이 (cm)',
        pdCalcResult: '선반 계산 결과',
        pdSelectRef: '레퍼런스를 선택해주세요 🖼️',
        pdSkipRef: '선택 없이 진행',
        pdCustomize: '디자인을 커스터마이징하세요 🎨',
        pdAdDesign: '📢 상단 광고 디자인',
        pdSideDesign: '📐 옆면 디자인',
        pdShelfDesign: '📦 선반 디자인',
        pdBgColor: '🎨 배경색',
        pdUpload: '📁 파일 업로드',
        pdEditor: '🎨 에디터',
        pdNotSet: '미설정',
        pdSet: '✅ 설정됨',
        pdSummary: '주문 요약입니다! 장바구니에 담으면 끝! ✨',
        pdTotalSize: '전체 크기',
        pdAdArea: '상단 광고',
        pdShelfCount: '선반',
        pdShelfUnit: '{count}칸 (각 {h}cm)',
        pdReference: '레퍼런스',
        pdNone: '없음',
        pdAddToCart: '🛒 장바구니 담기',
        pdQty: '수량',
        pdDepthLabel: '깊이',
        pdOpenEditor: '에디터로 디자인하기',
        pdSkipDesign: '디자인 없이 진행',
    },
    ja: {
        hcAskConsulted: 'マネージャーとご相談されましたか？ 🤝',
        hcYes: '相談完了しました',
        hcNo: 'いいえ、まだです',
        hcInputAmount: '受け取ったお見積金額を入力してください 💰',
        hcConsultManager: '💬 マネージャーに相談する',
        hcOrderDirect: '🛒 直接注文する',
        hcChooseAction: 'どうされますか？',
        hcPay: '💳 お支払い',
        hcAmountPlaceholder: '金額を入力',
        enterArea: '施工面積を入力してください 📐',
        askFile: 'お持ちの写真やファイルで印刷をご依頼されますか？',
        yes: 'はい、あります！',
        no: 'デザインが必要です',
        uploadFile: 'ファイルをアップロードしてください',
        enterSize: 'サイズを入力するとお見積もりをお出しします 📏',
        selectOption: 'オプションを選択してください ✨',
        finalCart: '購入ボタンを押すだけで完了！修正が必要な場合はエディタでデザインしてください 🎉',
        finalEditor: 'エディタでデザインボタンを押して直接デザインしてみましょう！ 🎨',
        chooseDesign: 'どのようにデザインしますか？',
        selfDesign: '🎨 自分でデザイン',
        expertDesign: '👨‍🎨 専門家に依頼',
        expertMsg: 'チャットを開きますので、担当者とご相談ください 💬',
        selectQty: '数量を選択してください 📦',
        cartFinal: 'カートに入れたら完了です！ 🎉',
        next: '次へ →',
        prev: '← 戻る',
        skipOption: 'オプションなしで進む →',
        uploaded: 'アップロード完了！次のステップへ 👍',
        pdEnterSize: '什器の全体サイズを入力してください 📐',
        pdWidth: '幅 (cm)',
        pdHeight: '高さ (cm)',
        pdDepth: '奥行き (cm)',
        pdAdHeightDesc: '上部広告パネルの高さを入力してください（デフォルト20cm） 📢',
        pdShelfHeight: '棚の高さ (cm)',
        pdCalcResult: '棚の計算結果',
        pdSelectRef: 'リファレンスを選択してください 🖼️',
        pdSkipRef: '選択せずに進む',
        pdCustomize: 'デザインをカスタマイズしてください 🎨',
        pdAdDesign: '📢 上部広告デザイン',
        pdSideDesign: '📐 側面デザイン',
        pdShelfDesign: '📦 棚デザイン',
        pdBgColor: '🎨 背景色',
        pdUpload: '📁 ファイルアップロード',
        pdEditor: '🎨 エディタ',
        pdNotSet: '未設定',
        pdSet: '✅ 設定済み',
        pdSummary: '注文概要です！カートに入れたら完了！ ✨',
        pdTotalSize: '全体サイズ',
        pdAdArea: '上部広告',
        pdShelfCount: '棚',
        pdShelfUnit: '{count}段（各{h}cm）',
        pdReference: 'リファレンス',
        pdNone: 'なし',
        pdAddToCart: '🛒 カートに入れる',
        pdQty: '数量',
        pdDepthLabel: '奥行き',
        pdOpenEditor: 'エディタでデザイン',
        pdSkipDesign: 'デザインなしで進む',
    },
    en: {
        hcAskConsulted: 'Have you consulted with our manager? 🤝',
        hcYes: 'Consultation done',
        hcNo: 'No, not yet',
        hcInputAmount: 'Please enter the quoted amount 💰',
        hcConsultManager: '💬 Consult with manager',
        hcOrderDirect: '🛒 Order directly',
        hcChooseAction: 'What would you like to do?',
        hcPay: '💳 Proceed to payment',
        hcAmountPlaceholder: 'Enter amount',
        enterArea: 'Please enter the installation area 📐',
        askFile: 'Would you like to print with your own photo or file?',
        yes: 'Yes, I do!',
        no: "I need a design",
        uploadFile: "Please upload your file",
        enterSize: "Enter the size and we'll give you a quote 📏",
        selectOption: 'Select your options ✨',
        finalCart: "Just click Purchase and you're done! Need changes? Use the Design Editor 🎉",
        finalEditor: 'Click "Design in Editor" to create your own design! 🎨',
        chooseDesign: 'How would you like to design?',
        selfDesign: '🎨 Design it myself',
        expertDesign: '👨‍🎨 Request an expert',
        expertMsg: "We'll open a chat for you. Please consult with our specialist 💬",
        selectQty: 'Select quantity 📦',
        cartFinal: 'Add to cart and done! 🎉',
        next: 'Next →',
        prev: '← Back',
        skipOption: 'Skip options →',
        uploaded: 'File uploaded! Moving to next step 👍',
        pdEnterSize: 'Enter the overall size of the display stand 📐',
        pdWidth: 'Width (cm)',
        pdHeight: 'Height (cm)',
        pdDepth: 'Depth (cm)',
        pdAdHeightDesc: 'Enter the top ad panel height (default 20cm) 📢',
        pdShelfHeight: 'Shelf height (cm)',
        pdCalcResult: 'Shelf Calculation Result',
        pdSelectRef: 'Select a reference design 🖼️',
        pdSkipRef: 'Skip selection',
        pdCustomize: 'Customize your design 🎨',
        pdAdDesign: '📢 Top Ad Design',
        pdSideDesign: '📐 Side Panel Design',
        pdShelfDesign: '📦 Shelf Design',
        pdBgColor: '🎨 Background Color',
        pdUpload: '📁 Upload File',
        pdEditor: '🎨 Editor',
        pdNotSet: 'Not set',
        pdSet: '✅ Set',
        pdSummary: 'Order summary! Add to cart and done! ✨',
        pdTotalSize: 'Total Size',
        pdAdArea: 'Top Ad',
        pdShelfCount: 'Shelves',
        pdShelfUnit: '{count} shelves ({h}cm each)',
        pdReference: 'Reference',
        pdNone: 'None',
        pdAddToCart: '🛒 Add to Cart',
        pdQty: 'Quantity',
        pdDepthLabel: 'Depth',
        pdOpenEditor: 'Design in Editor',
        pdSkipDesign: 'Skip design',
    },
    zh: {
        hcAskConsulted: '您已与经理咨询过了吗？ 🤝',
        hcYes: '咨询完成了',
        hcNo: '还没有',
        hcInputAmount: '请输入收到的报价金额 💰',
        hcConsultManager: '💬 与经理咨询',
        hcOrderDirect: '🛒 直接下单',
        hcChooseAction: '您想怎么做？',
        hcPay: '💳 去支付',
        hcAmountPlaceholder: '输入金额',
        enterArea: '请输入施工面积 📐',
        askFile: '您要用自己的照片或文件来印刷吗？',
        yes: '有！',
        no: '需要设计',
        uploadFile: '请上传文件',
        enterSize: '输入尺寸，我们会为您报价 📏',
        selectOption: '请选择选项 ✨',
        finalCart: '点击购买就完成了！需要修改请使用设计编辑器 🎉',
        finalEditor: '点击"在编辑器中设计"来创建您的设计！ 🎨',
        chooseDesign: '您想如何设计？',
        selfDesign: '🎨 自己设计',
        expertDesign: '👨‍🎨 委托专家',
        expertMsg: '我们将为您打开聊天窗口，请与顾问沟通后进行 💬',
        selectQty: '请选择数量 📦',
        cartFinal: '加入购物车就完成了！ 🎉',
        next: '下一步 →',
        prev: '← 上一步',
        skipOption: '跳过选项 →',
        uploaded: '文件上传完成！进入下一步 👍',
        pdEnterSize: '请输入展示架的整体尺寸 📐',
        pdWidth: '宽度 (cm)',
        pdHeight: '高度 (cm)',
        pdDepth: '深度 (cm)',
        pdAdHeightDesc: '请输入顶部广告板高度（默认20cm） 📢',
        pdShelfHeight: '货架高度 (cm)',
        pdCalcResult: '货架计算结果',
        pdSelectRef: '请选择参考设计 🖼️',
        pdSkipRef: '跳过选择',
        pdCustomize: '自定义您的设计 🎨',
        pdAdDesign: '📢 顶部广告设计',
        pdSideDesign: '📐 侧面设计',
        pdShelfDesign: '📦 货架设计',
        pdBgColor: '🎨 背景色',
        pdUpload: '📁 上传文件',
        pdEditor: '🎨 编辑器',
        pdNotSet: '未设置',
        pdSet: '✅ 已设置',
        pdSummary: '订单摘要！加入购物车即完成！ ✨',
        pdTotalSize: '整体尺寸',
        pdAdArea: '顶部广告',
        pdShelfCount: '货架',
        pdShelfUnit: '{count}层（每层{h}cm）',
        pdReference: '参考',
        pdNone: '无',
        pdAddToCart: '🛒 加入购物车',
        pdQty: '数量',
        pdDepthLabel: '深度',
        pdOpenEditor: '在编辑器中设计',
        pdSkipDesign: '跳过设计',
    },
    ar: {
        hcAskConsulted: 'هل تشاورت مع المدير؟ 🤝',
        hcYes: 'تمت الاستشارة',
        hcNo: 'لا، ليس بعد',
        hcInputAmount: 'يرجى إدخال مبلغ العرض المستلم 💰',
        hcConsultManager: '💬 التشاور مع المدير',
        hcOrderDirect: '🛒 الطلب مباشرة',
        hcChooseAction: 'ماذا تريد أن تفعل؟',
        hcPay: '💳 متابعة الدفع',
        hcAmountPlaceholder: 'أدخل المبلغ',
        enterArea: 'يرجى إدخال مساحة التركيب 📐',
        askFile: 'هل تريد الطباعة بصورتك أو ملفك الخاص؟',
        yes: 'نعم!',
        no: 'أحتاج تصميم',
        uploadFile: 'يرجى رفع ملفك',
        enterSize: 'أدخل الحجم وسنعطيك عرض سعر 📏',
        selectOption: 'اختر الخيارات ✨',
        finalCart: 'اضغط شراء وانتهيت! تحتاج تعديل؟ استخدم محرر التصميم 🎉',
        finalEditor: 'انقر على "التصميم في المحرر" لإنشاء تصميمك! 🎨',
        chooseDesign: 'كيف تريد التصميم؟',
        selfDesign: '🎨 تصميم بنفسي',
        expertDesign: '👨‍🎨 طلب خبير',
        expertMsg: 'سنفتح لك الدردشة، يرجى التشاور مع المختص 💬',
        selectQty: 'اختر الكمية 📦',
        cartFinal: 'أضف للسلة وانتهيت! 🎉',
        next: 'التالي →',
        prev: '← السابق',
        skipOption: 'تخطي الخيارات →',
        uploaded: 'تم رفع الملف! الخطوة التالية 👍',
        pdEnterSize: 'أدخل الحجم الكلي لحامل العرض 📐',
        pdWidth: 'العرض (سم)',
        pdHeight: 'الارتفاع (سم)',
        pdDepth: 'العمق (سم)',
        pdAdHeightDesc: 'أدخل ارتفاع لوحة الإعلان العلوية (افتراضي 20 سم) 📢',
        pdShelfHeight: 'ارتفاع الرف (سم)',
        pdCalcResult: 'نتيجة حساب الأرفف',
        pdSelectRef: 'اختر تصميمًا مرجعيًا 🖼️',
        pdSkipRef: 'تخطي الاختيار',
        pdCustomize: 'خصص تصميمك 🎨',
        pdAdDesign: '📢 تصميم الإعلان العلوي',
        pdSideDesign: '📐 تصميم الجانب',
        pdShelfDesign: '📦 تصميم الرف',
        pdBgColor: '🎨 لون الخلفية',
        pdUpload: '📁 رفع ملف',
        pdEditor: '🎨 المحرر',
        pdNotSet: 'غير محدد',
        pdSet: '✅ تم التعيين',
        pdSummary: 'ملخص الطلب! أضف للسلة وانتهيت! ✨',
        pdTotalSize: 'الحجم الكلي',
        pdAdArea: 'الإعلان العلوي',
        pdShelfCount: 'الأرفف',
        pdShelfUnit: '{count} أرفف (كل {h} سم)',
        pdReference: 'المرجع',
        pdNone: 'لا شيء',
        pdAddToCart: '🛒 أضف للسلة',
        pdQty: 'الكمية',
        pdDepthLabel: 'العمق',
        pdOpenEditor: 'التصميم في المحرر',
        pdSkipDesign: 'تخطي التصميم',
    },
    es: {
        hcAskConsulted: '¿Ha consultado con nuestro gerente? 🤝',
        hcYes: 'Consulta completada',
        hcNo: 'No, todavía no',
        hcInputAmount: 'Ingrese el monto del presupuesto recibido 💰',
        hcConsultManager: '💬 Consultar con el gerente',
        hcOrderDirect: '🛒 Pedir directamente',
        hcChooseAction: '¿Qué le gustaría hacer?',
        hcPay: '💳 Proceder al pago',
        hcAmountPlaceholder: 'Ingrese el monto',
        enterArea: 'Ingrese el área de instalación 📐',
        askFile: '¿Quieres imprimir con tu propia foto o archivo?',
        yes: '¡Sí, tengo!',
        no: 'Necesito un diseño',
        uploadFile: 'Sube tu archivo',
        enterSize: 'Ingresa el tamaño y te daremos un presupuesto 📏',
        selectOption: 'Selecciona tus opciones ✨',
        finalCart: '¡Presiona Comprar y listo! ¿Necesitas cambios? Usa el Editor de Diseño 🎉',
        finalEditor: '¡Haz clic en "Diseñar en el Editor" para crear tu diseño! 🎨',
        chooseDesign: '¿Cómo quieres diseñar?',
        selfDesign: '🎨 Diseñar yo mismo',
        expertDesign: '👨‍🎨 Solicitar experto',
        expertMsg: 'Abriremos un chat para ti. Consulta con nuestro especialista 💬',
        selectQty: 'Selecciona la cantidad 📦',
        cartFinal: '¡Agregar al carrito y listo! 🎉',
        next: 'Siguiente →',
        prev: '← Anterior',
        skipOption: 'Saltar opciones →',
        uploaded: '¡Archivo subido! Siguiente paso 👍',
        pdEnterSize: 'Ingrese el tamaño total del exhibidor 📐',
        pdWidth: 'Ancho (cm)',
        pdHeight: 'Alto (cm)',
        pdDepth: 'Profundidad (cm)',
        pdAdHeightDesc: 'Ingrese la altura del panel publicitario superior (predeterminado 20cm) 📢',
        pdShelfHeight: 'Altura del estante (cm)',
        pdCalcResult: 'Resultado del cálculo de estantes',
        pdSelectRef: 'Seleccione un diseño de referencia 🖼️',
        pdSkipRef: 'Omitir selección',
        pdCustomize: 'Personalice su diseño 🎨',
        pdAdDesign: '📢 Diseño del anuncio superior',
        pdSideDesign: '📐 Diseño lateral',
        pdShelfDesign: '📦 Diseño del estante',
        pdBgColor: '🎨 Color de fondo',
        pdUpload: '📁 Subir archivo',
        pdEditor: '🎨 Editor',
        pdNotSet: 'No configurado',
        pdSet: '✅ Configurado',
        pdSummary: '¡Resumen del pedido! ¡Agregar al carrito y listo! ✨',
        pdTotalSize: 'Tamaño total',
        pdAdArea: 'Anuncio superior',
        pdShelfCount: 'Estantes',
        pdShelfUnit: '{count} estantes ({h}cm cada uno)',
        pdReference: 'Referencia',
        pdNone: 'Ninguno',
        pdAddToCart: '🛒 Agregar al carrito',
        pdQty: 'Cantidad',
        pdDepthLabel: 'Profundidad',
        pdOpenEditor: 'Diseñar en el Editor',
        pdSkipDesign: 'Omitir diseño',
    },
    de: {
        hcAskConsulted: 'Haben Sie sich mit unserem Manager beraten? 🤝',
        hcYes: 'Beratung abgeschlossen',
        hcNo: 'Nein, noch nicht',
        hcInputAmount: 'Bitte geben Sie den erhaltenen Angebotsbetrag ein 💰',
        hcConsultManager: '💬 Mit Manager beraten',
        hcOrderDirect: '🛒 Direkt bestellen',
        hcChooseAction: 'Was möchten Sie tun?',
        hcPay: '💳 Zur Zahlung',
        hcAmountPlaceholder: 'Betrag eingeben',
        enterArea: 'Bitte geben Sie die Installationsfläche ein 📐',
        askFile: 'Möchten Sie mit Ihrem eigenen Foto oder Datei drucken?',
        yes: 'Ja!',
        no: 'Ich brauche ein Design',
        uploadFile: 'Laden Sie Ihre Datei hoch',
        enterSize: 'Geben Sie die Größe ein für ein Angebot 📏',
        selectOption: 'Wählen Sie Ihre Optionen ✨',
        finalCart: 'Einfach Kaufen klicken und fertig! Änderungen nötig? Nutzen Sie den Design-Editor 🎉',
        finalEditor: 'Klicken Sie auf "Im Editor gestalten" um Ihr Design zu erstellen! 🎨',
        chooseDesign: 'Wie möchten Sie gestalten?',
        selfDesign: '🎨 Selbst gestalten',
        expertDesign: '👨‍🎨 Experte beauftragen',
        expertMsg: 'Wir öffnen einen Chat für Sie. Bitte beraten Sie sich mit unserem Spezialisten 💬',
        selectQty: 'Menge wählen 📦',
        cartFinal: 'In den Warenkorb und fertig! 🎉',
        next: 'Weiter →',
        prev: '← Zurück',
        skipOption: 'Ohne Optionen →',
        uploaded: 'Datei hochgeladen! Nächster Schritt 👍',
        pdEnterSize: 'Geben Sie die Gesamtgröße des Displays ein 📐',
        pdWidth: 'Breite (cm)',
        pdHeight: 'Höhe (cm)',
        pdDepth: 'Tiefe (cm)',
        pdAdHeightDesc: 'Geben Sie die Höhe des oberen Werbeschilds ein (Standard 20cm) 📢',
        pdShelfHeight: 'Regalhöhe (cm)',
        pdCalcResult: 'Regal-Berechnung',
        pdSelectRef: 'Wählen Sie ein Referenzdesign 🖼️',
        pdSkipRef: 'Auswahl überspringen',
        pdCustomize: 'Passen Sie Ihr Design an 🎨',
        pdAdDesign: '📢 Oberes Werbedesign',
        pdSideDesign: '📐 Seitendesign',
        pdShelfDesign: '📦 Regaldesign',
        pdBgColor: '🎨 Hintergrundfarbe',
        pdUpload: '📁 Datei hochladen',
        pdEditor: '🎨 Editor',
        pdNotSet: 'Nicht gesetzt',
        pdSet: '✅ Gesetzt',
        pdSummary: 'Bestellübersicht! In den Warenkorb und fertig! ✨',
        pdTotalSize: 'Gesamtgröße',
        pdAdArea: 'Obere Werbung',
        pdShelfCount: 'Regale',
        pdShelfUnit: '{count} Regale (je {h}cm)',
        pdReference: 'Referenz',
        pdNone: 'Keine',
        pdAddToCart: '🛒 In den Warenkorb',
        pdQty: 'Menge',
        pdDepthLabel: 'Tiefe',
        pdOpenEditor: 'Im Editor gestalten',
        pdSkipDesign: 'Design überspringen',
    },
    fr: {
        hcAskConsulted: 'Avez-vous consulté notre responsable ? 🤝',
        hcYes: 'Consultation terminée',
        hcNo: 'Non, pas encore',
        hcInputAmount: 'Veuillez saisir le montant du devis reçu 💰',
        hcConsultManager: '💬 Consulter le responsable',
        hcOrderDirect: '🛒 Commander directement',
        hcChooseAction: 'Que souhaitez-vous faire ?',
        hcPay: '💳 Procéder au paiement',
        hcAmountPlaceholder: 'Saisir le montant',
        enterArea: 'Veuillez entrer la surface d\'installation 📐',
        askFile: 'Souhaitez-vous imprimer avec votre propre photo ou fichier ?',
        yes: 'Oui !',
        no: "J'ai besoin d'un design",
        uploadFile: 'Téléchargez votre fichier',
        enterSize: 'Entrez la taille pour un devis 📏',
        selectOption: 'Sélectionnez vos options ✨',
        finalCart: 'Cliquez sur Acheter et c\'est fini ! Besoin de modifications ? Utilisez l\'éditeur 🎉',
        finalEditor: 'Cliquez sur "Designer dans l\'éditeur" pour créer votre design ! 🎨',
        chooseDesign: 'Comment souhaitez-vous concevoir ?',
        selfDesign: '🎨 Concevoir moi-même',
        expertDesign: '👨‍🎨 Demander un expert',
        expertMsg: 'Nous ouvrirons un chat pour vous. Veuillez consulter notre spécialiste 💬',
        selectQty: 'Choisissez la quantité 📦',
        cartFinal: 'Ajoutez au panier et c\'est fini ! 🎉',
        next: 'Suivant →',
        prev: '← Retour',
        skipOption: 'Passer les options →',
        uploaded: 'Fichier envoyé ! Étape suivante 👍',
        pdEnterSize: 'Entrez la taille totale du présentoir 📐',
        pdWidth: 'Largeur (cm)',
        pdHeight: 'Hauteur (cm)',
        pdDepth: 'Profondeur (cm)',
        pdAdHeightDesc: 'Entrez la hauteur du panneau publicitaire supérieur (défaut 20cm) 📢',
        pdShelfHeight: 'Hauteur de l\'étagère (cm)',
        pdCalcResult: 'Résultat du calcul des étagères',
        pdSelectRef: 'Sélectionnez un design de référence 🖼️',
        pdSkipRef: 'Passer la sélection',
        pdCustomize: 'Personnalisez votre design 🎨',
        pdAdDesign: '📢 Design pub supérieure',
        pdSideDesign: '📐 Design latéral',
        pdShelfDesign: '📦 Design étagère',
        pdBgColor: '🎨 Couleur de fond',
        pdUpload: '📁 Télécharger',
        pdEditor: '🎨 Éditeur',
        pdNotSet: 'Non défini',
        pdSet: '✅ Défini',
        pdSummary: 'Résumé de commande ! Ajoutez au panier et c\'est fini ! ✨',
        pdTotalSize: 'Taille totale',
        pdAdArea: 'Pub supérieure',
        pdShelfCount: 'Étagères',
        pdShelfUnit: '{count} étagères ({h}cm chacune)',
        pdReference: 'Référence',
        pdNone: 'Aucun',
        pdAddToCart: '🛒 Ajouter au panier',
        pdQty: 'Quantité',
        pdDepthLabel: 'Profondeur',
        pdOpenEditor: 'Designer dans l\'éditeur',
        pdSkipDesign: 'Passer le design',
    },
};

function _npcLang() {
    const c = (window.SITE_CONFIG && window.SITE_CONFIG.COUNTRY) || 'KR';
    const map = { KR:'kr', JP:'ja', US:'en', CN:'zh', AR:'ar', ES:'es', DE:'de', FR:'fr' };
    return map[c] || 'kr';
}
function _t(key) {
    const lang = _npcLang();
    return (NPC_TEXTS[lang] && NPC_TEXTS[lang][key]) || NPC_TEXTS.kr[key] || key;
}

window.NpcWizard = {
    active: false,
    step: 0,
    hasFile: null,
    designChoice: null, // 'self' or 'expert'
    _fromHoneycombDirect: false,
    product: null,
    isCustom: false,
    isGeneral: false,
    isHoneycomb: false,
    isPaperDisplay: false,
    hasOptions: false,
    sections: {},
    guideEl: null,
    _fileWatcher: null,
    // 종이매대 전용 상태
    _pdWidth: 40,
    _pdHeight: 120,
    _pdDepth: 30,
    _pdAdHeight: 20,
    _pdShelfHeight: 25,
    _pdShelfCount: 0,
    _pdRefCode: null,
    _pdRefName: null,
    _pdCustom: { ad: null, side: null, shelf: null, bgColor: '#ffffff' },
    _pdRefs: [],

    init(product) {
        this.product = product;
        this.isCustom = !!product.is_custom_size;
        this.isGeneral = !!product.is_general_product;
        const key = product.code || window.currentProductKey || '';
        this.isHoneycomb = (product.category === 'honeycomb') || (product.category === 'honeycomb_box') || (typeof key === 'string' && key.startsWith('hb'));
        this.isPaperDisplay = (typeof key === 'string' && key.startsWith('pd_'));
        this.hasFile = null;
        this.designChoice = null;
        this._fromHoneycombDirect = false;
        this._pdWidth = 40;
        this._pdHeight = 120;
        this._pdDepth = 30;
        this._pdAdHeight = 20;
        this._pdShelfHeight = 25;
        this._pdShelfCount = 0;
        this._pdRefCode = null;
        this._pdRefName = null;
        this._pdCustom = { ad: null, side: null, shelf: null, bgColor: '#ffffff' };
        this._pdRefs = [];
        this.step = 0;
        this.active = true;

        const rightActions = document.getElementById('choiceRightActions');
        if (!rightActions) return;

        const addonArea = rightActions.querySelector('#addonCategoryArea');
        this.hasOptions = !!(addonArea && addonArea.querySelectorAll('input[name="userOption"]').length > 0);

        this._tagSections(rightActions);
        this._hideAll();
        this._createGuideArea(rightActions);

        if (this.isPaperDisplay) {
            // 종이매대 → 전용 위자드
            this._goStep('pdSize');
        } else if (this.isHoneycomb) {
            // 허니콤보드 → 매니저 상담 여부 확인
            this._goStep('honeycombAsk');
        } else if (this.isCustom && this.isGeneral) {
            // 면적 기반 시공 상품 (인쇄 없음) → 사이즈만 입력 → 장바구니
            this._goStep('size');
        } else if (this.isCustom) {
            // 커스텀 인쇄 상품 → 파일/디자인 위자드 진행
            this._goStep('askFile');
        } else {
            // 일반 상품 + 고정 사이즈 상품 → 수량 선택 → 구매
            this._goStep('qty');
        }
        this._watchFileUpload();
    },

    destroy() {
        this.active = false;
        if (this._fileWatcher) clearInterval(this._fileWatcher);
        this._restoreSections();
        if (this.guideEl) this.guideEl.remove();
        Object.values(this.sections).forEach(el => {
            if (el) el.style.display = '';
        });
    },

    _tagSections(container) {
        this.sections = {};
        this.sections.header = container.querySelector('[data-npc="header"]');
        this.sections.upload = container.querySelector('[data-npc="upload"]');
        this.sections.uploadPreview = container.querySelector('[data-npc="uploadPreview"]');
        this.sections.size = container.querySelector('[data-npc="size"]');
        this.sections.qtyLabel = container.querySelector('[data-npc="qtyLabel"]');
        this.sections.qty = container.querySelector('[data-npc="qty"]');
        this.sections.estimate = container.querySelector('[data-npc="estimate"]');
        this.sections.price = container.querySelector('[data-npc="price"]');
        this.sections.options = container.querySelector('#addonCategoryArea');
        this.sections.total = container.querySelector('[data-npc="total"]');
        this.sections.buttons = container.querySelector('[data-npc="buttons"]');
        this.sections.uploadedFiles = container.querySelector('#uploadedFilesList');
    },

    _hideAll() {
        Object.values(this.sections).forEach(el => {
            if (el) el.style.display = 'none';
        });
    },

    _showSection(name) {
        const el = this.sections[name];
        if (el) el.style.display = '';
    },

    _createGuideArea(container) {
        if (this.guideEl) this.guideEl.remove();
        const div = document.createElement('div');
        div.id = 'npcGuideArea';
        div.className = 'npc-guide-area';
        container.insertBefore(div, container.firstChild);
        this.guideEl = div;
    },

    // ★ 슬롯에 들어간 섹션들을 rightActions로 복원 (DOM 분리 방지)
    _restoreSections() {
        const rightActions = document.getElementById('choiceRightActions');
        if (!rightActions) return;
        Object.values(this.sections).forEach(el => {
            if (el && el.parentNode && el.parentNode.id === 'npcContentSlot') {
                rightActions.appendChild(el);
            }
        });
    },

    // 말풍선 + 아바타 + 선택지 + 이전/다음 렌더
    _renderBubble(text, choices, showNav, mood, nextBtn) {
        if (!this.guideEl) return;
        // innerHTML 교체 전에 섹션들을 안전하게 복원
        this._restoreSections();
        let html = `
            <div class="npc-bubble-wrap">
                <div class="npc-bubble">${text}</div>
                <div class="npc-avatar">
                    <img src="${NPC_IMG}" alt="Guide" onerror="this.style.display='none';this.parentElement.textContent='🦎';">
                </div>
            </div>`;
        // 콘텐츠 삽입 영역 (섹션이 여기에 들어감)
        html += '<div id="npcContentSlot"></div>';
        if (choices && choices.length > 0) {
            html += '<div class="npc-choices">';
            choices.forEach(c => {
                html += `<button class="npc-choice-btn ${c.cls || ''}" onclick="${c.onclick}">${c.label}</button>`;
            });
            html += '</div>';
        }
        if (showNav || nextBtn) {
            html += '<div class="npc-nav">';
            if (showNav) {
                html += `<button class="npc-nav-btn npc-prev" onclick="window.NpcWizard._goPrev()">${_t('prev')}</button>`;
            } else {
                html += '<span></span>';
            }
            if (nextBtn) {
                html += `<button class="npc-nav-btn npc-next-nav" onclick="${nextBtn.onclick}">${nextBtn.label || _t('next')}</button>`;
            }
            html += '</div>';
        }
        this.guideEl.innerHTML = html;
        this.guideEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    // ★ 핵심: 콘텐츠 섹션을 가이드 영역 내 슬롯에 삽입
    _insertToSlot(...names) {
        const slot = this.guideEl && this.guideEl.querySelector('#npcContentSlot');
        if (!slot) return;
        names.forEach(name => {
            const el = this.sections[name];
            if (el && el.style.display !== 'none') {
                slot.appendChild(el);
            }
        });
    },

    // ── 스텝 핸들러 ──
    _goStep(stepName) {
        this.step = stepName;
        this._hideAll();
        this._showSection('header');

        switch (stepName) {
            case 'askFile':
                this._renderBubble(_t('askFile'), [
                    { label: _t('yes'), cls: 'npc-yes', onclick: "window.NpcWizard._chooseFile(true)" },
                    { label: _t('no'), cls: 'npc-no', onclick: "window.NpcWizard._chooseFile(false)" },
                ]);
                break;

            case 'upload':
                this._showSection('upload');
                if (window._pendingUploadedFiles && window._pendingUploadedFiles.length > 0) {
                    this._showSection('uploadPreview');
                }
                this._renderBubble(_t('uploadFile'), null, true, null,
                    { onclick: "window.NpcWizard._goStep('size')" });
                this._insertToSlot('upload', 'uploadPreview');
                break;

            case 'size':
                this._showSection('size');
                this._showSection('qtyLabel');
                this._showSection('qty');
                this._showSection('estimate');
                if (this.isCustom) {
                    const isAreaOnly = this.isCustom && this.isGeneral;
                    const sizeText = isAreaOnly ? _t('enterArea') : _t('enterSize');
                    // 면적 기반 시공 상품은 size가 첫 단계 → 이전 버튼 없음
                    this._renderBubble(sizeText, null, !isAreaOnly, null,
                        { onclick: "window.NpcWizard._afterSize()" });
                }
                this._insertToSlot('size', 'qtyLabel', 'qty', 'estimate');
                break;

            case 'qty':
                this._showSection('price');
                this._showSection('qty');
                this._renderBubble(_t('selectQty'), null, false, null,
                    { onclick: "window.NpcWizard._afterQty()" });
                this._insertToSlot('price', 'qty');
                break;

            case 'options':
                this._showSection('options');
                this._renderBubble(_t('selectOption'), null, true, null,
                    { onclick: "window.NpcWizard._afterOptions()" });
                this._insertToSlot('options');
                break;

            case 'final':
                this._showSection('total');
                this._showSection('buttons');
                if (this.isGeneral || this._fromHoneycombDirect) {
                    this._renderBubble(_t('cartFinal'), null, true);
                } else if (this.hasFile) {
                    this._renderBubble(_t('finalCart'), null, true);
                } else {
                    // 직접 디자인 경로 → 에디터 안내
                    this._renderBubble(_t('finalEditor'), null, true);
                }
                this._insertToSlot('total', 'buttons');
                if (window.updateModalTotal) window.updateModalTotal();
                break;

            case 'chooseDesign':
                // 파일 없음 → 직접/의뢰 먼저 선택 (사이즈 입력 전)
                this._renderBubble(_t('chooseDesign'), [
                    { label: _t('selfDesign'), cls: 'npc-yes', onclick: "window.NpcWizard._chooseSelfDesign()" },
                    { label: _t('expertDesign'), cls: 'npc-expert', onclick: "window.NpcWizard._chooseExpert()" },
                ], true);
                break;

            case 'expertChat':
                // 전문가 의뢰 → 안내 메시지 + 채팅 열기
                this._renderBubble(_t('expertMsg'), null, true);
                setTimeout(() => { if (window.ChamBot) window.ChamBot.toggle(); }, 500);
                break;

            case 'honeycombAsk':
                // 허니콤보드: 매니저 상담 여부 확인
                this._renderBubble(_t('hcAskConsulted'), [
                    { label: _t('hcYes'), cls: 'npc-yes', onclick: "window.NpcWizard._goStep('honeycombInput')" },
                    { label: _t('hcNo'), cls: 'npc-no', onclick: "window.NpcWizard._goStep('honeycombChoice')" },
                ]);
                break;

            case 'honeycombChoice':
                // 허니콤보드: 상담 안 했을 때 → 상담하기 or 직접 주문
                this._renderBubble(_t('hcChooseAction'), [
                    { label: _t('hcConsultManager'), cls: 'npc-yes', onclick: "if(window.ChamBot) window.ChamBot.toggle();" },
                    { label: _t('hcOrderDirect'), cls: 'npc-expert', onclick: "window.NpcWizard._honeycombDirect()" },
                ], true);
                break;

            case 'honeycombInput': {
                // 허니콤보드: 견적금액 입력
                this._renderBubble(_t('hcInputAmount'), null, true);
                // 슬롯에 금액 입력 UI 추가
                const slot = this.guideEl && this.guideEl.querySelector('#npcContentSlot');
                if (slot) {
                    slot.innerHTML = `
                        <div class="npc-hc-input-wrap">
                            <input type="text" id="npcHcAmount" class="npc-hc-amount" placeholder="${_t('hcAmountPlaceholder')}" inputmode="numeric">
                            <button class="npc-choice-btn npc-yes npc-hc-pay-btn" onclick="window.NpcWizard._honeycombPay()">${_t('hcPay')}</button>
                        </div>
                    `;
                    const inp = slot.querySelector('#npcHcAmount');
                    if (inp) inp.addEventListener('input', function() {
                        const raw = this.value.replace(/[^0-9]/g, '');
                        this.value = raw ? Number(raw).toLocaleString() : '';
                    });
                }
                break;
            }

            // ═══ 종이매대 (Paper Display Stand) 전용 스텝 ═══

            case 'pdSize': {
                // Step 1: 전체 가로/높이 입력
                this._renderBubble(_t('pdEnterSize'), null, false, null,
                    { onclick: "window.NpcWizard._pdAfterSize()", label: _t('next') });
                const slot1 = this.guideEl && this.guideEl.querySelector('#npcContentSlot');
                if (slot1) {
                    slot1.innerHTML = `
                        <div class="pd-input-row">
                            <label>${_t('pdWidth')}</label>
                            <input type="number" id="npcPdWidth" value="${this._pdWidth || 40}" min="10" max="60" placeholder="40" inputmode="numeric">
                        </div>
                        <div class="pd-input-row">
                            <label>${_t('pdHeight')}</label>
                            <input type="number" id="npcPdHeight" value="${this._pdHeight || 120}" min="10" max="150" placeholder="120" inputmode="numeric">
                        </div>
                        <div class="pd-input-row">
                            <label>${_t('pdDepth')}</label>
                            <input type="number" id="npcPdDepth" value="${this._pdDepth || 30}" min="5" max="40" placeholder="30" inputmode="numeric">
                        </div>
                    `;
                }
                break;
            }

            case 'pdAdHeight': {
                // Step 2: 상단 광고 높이 + 선반 높이 + 자동계산
                this._renderBubble(_t('pdAdHeightDesc'), null, true, null,
                    { onclick: "window.NpcWizard._pdCalcAndShow()", label: _t('next') });
                const slot2 = this.guideEl && this.guideEl.querySelector('#npcContentSlot');
                if (slot2) {
                    slot2.innerHTML = `
                        <div class="pd-input-row">
                            <label>${_t('pdAdArea')}</label>
                            <input type="number" id="npcPdAdH" value="${this._pdAdHeight}" min="0" placeholder="20" inputmode="numeric"> <span style="font-size:13px;color:#64748b;">cm</span>
                        </div>
                        <div class="pd-input-row">
                            <label>${_t('pdShelfHeight')}</label>
                            <input type="number" id="npcPdShelfH" value="${this._pdShelfHeight}" min="5" placeholder="25" inputmode="numeric"> <span style="font-size:13px;color:#64748b;">cm</span>
                        </div>
                        <div id="npcPdCalcPreview"></div>
                    `;
                    // 입력 시 실시간 미리보기
                    const adInp = slot2.querySelector('#npcPdAdH');
                    const shInp = slot2.querySelector('#npcPdShelfH');
                    const preview = slot2.querySelector('#npcPdCalcPreview');
                    const self = this;
                    const doPreview = () => {
                        const ad = parseInt(adInp.value) || 0;
                        const sh = parseInt(shInp.value) || 25;
                        const calc = self._pdCalcShelves(self._pdHeight, ad, sh);
                        preview.innerHTML = self._pdRenderDiagram(self._pdWidth, self._pdHeight, ad, sh, calc);
                    };
                    adInp.addEventListener('input', doPreview);
                    shInp.addEventListener('input', doPreview);
                    doPreview();
                }
                break;
            }

            case 'pdCalcResult': {
                // Step 2.5: 계산 결과 확인 (다이어그램 포함)
                const calc = this._pdCalcShelves(this._pdHeight, this._pdAdHeight, this._pdShelfHeight);
                this._pdShelfCount = calc.count;
                const msg = _t('pdCalcResult');
                this._renderBubble(msg, null, true, null,
                    { onclick: "window.NpcWizard._pdAfterCalc()", label: _t('next') });
                const slot2b = this.guideEl && this.guideEl.querySelector('#npcContentSlot');
                if (slot2b) {
                    slot2b.innerHTML = this._pdRenderDiagram(this._pdWidth, this._pdHeight, this._pdAdHeight, this._pdShelfHeight, calc);
                }
                break;
            }

            case 'pdReference': {
                // Step 3: 레퍼런스 선택
                this._renderBubble(_t('pdSelectRef'), null, true, null,
                    { onclick: "window.NpcWizard._pdAfterRef()", label: _t('next') });
                const slot3 = this.guideEl && this.guideEl.querySelector('#npcContentSlot');
                if (slot3) {
                    slot3.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8;">Loading...</div>';
                    this._pdLoadReferences().then(refs => {
                        this._pdRefs = refs;
                        if (!refs || refs.length === 0) {
                            slot3.innerHTML = '<div style="text-align:center;padding:12px;color:#94a3b8;font-size:13px;">' + _t('pdNone') + '</div>';
                            return;
                        }
                        const lang = _npcLang();
                        let html = '<div class="pd-ref-grid">';
                        refs.forEach(r => {
                            const name = (lang === 'ja' && r.name_jp) ? r.name_jp : (lang === 'en' && r.name_us) ? r.name_us : r.name;
                            const img = r.img_url || 'https://placehold.co/150?text=No+Img';
                            const sel = this._pdRefCode === r.code ? ' selected' : '';
                            html += `<div class="pd-ref-card${sel}" onclick="window.NpcWizard._pdSelectRef('${r.code}', this)" data-code="${r.code}">
                                <img src="${img}" alt="${name}" loading="lazy" onerror="this.src='https://placehold.co/150?text=No+Img'">
                                <div class="pd-ref-name">${name}</div>
                            </div>`;
                        });
                        html += '</div>';
                        html += `<button class="npc-choice-btn" style="margin-top:8px;font-size:13px;padding:8px;background:#f1f5f9;border:1px solid #cbd5e1;color:#64748b;" onclick="window.NpcWizard._pdRefCode=null;window.NpcWizard._pdRefName=null;document.querySelectorAll('.pd-ref-card').forEach(c=>c.classList.remove('selected'));">${_t('pdSkipRef')}</button>`;
                        slot3.innerHTML = html;
                    });
                }
                break;
            }

            case 'pdCustomize': {
                // Step 4: 배경색 선택 + 에디터 열기
                this._renderBubble(_t('pdCustomize'), null, true);
                const slot4 = this.guideEl && this.guideEl.querySelector('#npcContentSlot');
                if (slot4) {
                    const c = this._pdCustom;
                    slot4.innerHTML = `
                        <div class="pd-custom-cards">
                            <div class="pd-custom-card open">
                                <div class="pd-custom-header">
                                    ${_t('pdBgColor')} <span class="pd-custom-status" id="pdBgColorPreview" style="display:inline-block;width:16px;height:16px;border-radius:4px;background:${c.bgColor};border:1px solid #cbd5e1;vertical-align:middle;"></span>
                                </div>
                                <div class="pd-custom-body">
                                    <input type="color" value="${c.bgColor}" onchange="window.NpcWizard._pdCustom.bgColor=this.value;document.getElementById('pdBgColorPreview').style.background=this.value;" style="width:100%;height:40px;border:none;cursor:pointer;">
                                </div>
                            </div>
                        </div>
                        <div style="display:flex;flex-direction:column;gap:8px;margin-top:14px;">
                            <button class="npc-choice-btn npc-yes" style="width:100%;padding:14px;font-size:15px;font-weight:700;" onclick="window.NpcWizard._pdOpenEditor()">🎨 ${_t('pdOpenEditor')}</button>
                            <button class="npc-choice-btn" style="width:100%;padding:10px;font-size:13px;background:#f1f5f9;border:1px solid #cbd5e1;color:#64748b;" onclick="window.NpcWizard._pdAfterCustomize()">${_t('pdSkipDesign')}</button>
                        </div>
                    `;
                }
                break;
            }

            case 'pdSummary': {
                // Step 5 (or 6): 주문 요약 + 장바구니
                this._showSection('total');
                const calc2 = this._pdCalcShelves(this._pdHeight, this._pdAdHeight, this._pdShelfHeight);
                const shelfTxt = _t('pdShelfUnit').replace('{count}', calc2.count).replace('{h}', this._pdShelfHeight);
                const refTxt = this._pdRefName || _t('pdNone');
                const c2 = this._pdCustom;
                const customParts = [];
                if (c2.ad) customParts.push(_t('pdAdDesign'));
                if (c2.side) customParts.push(_t('pdSideDesign'));
                if (c2.shelf) customParts.push(_t('pdShelfDesign'));
                const customTxt = customParts.length > 0 ? customParts.join(', ') : _t('pdNone');

                this._renderBubble(_t('pdSummary'), null, true);
                const slot5 = this.guideEl && this.guideEl.querySelector('#npcContentSlot');
                if (slot5) {
                    slot5.innerHTML = `
                        <div class="pd-summary-card">
                            <div class="pd-summary-row"><span>${_t('pdTotalSize')}</span><strong>${this._pdWidth}cm x ${this._pdHeight}cm</strong></div>
                            <div class="pd-summary-row"><span>${_t('pdAdArea')}</span><strong>${this._pdAdHeight}cm</strong></div>
                            <div class="pd-summary-row"><span>${_t('pdShelfCount')}</span><strong>${shelfTxt}</strong></div>
                            <div class="pd-summary-row"><span>${_t('pdReference')}</span><strong>${refTxt}</strong></div>
                            <div class="pd-summary-row"><span>${_t('pdBgColor')}</span><span style="display:inline-block;width:20px;height:20px;border-radius:4px;background:${c2.bgColor};border:1px solid #cbd5e1;vertical-align:middle;"></span></div>
                            <div class="pd-summary-row"><span>${_t('pdCustomize')}</span><strong>${customTxt}</strong></div>
                        </div>
                        <button class="npc-choice-btn npc-yes" style="width:100%;margin-top:12px;padding:14px;font-size:15px;font-weight:700;" onclick="window.NpcWizard._pdOpenEditor()">🎨 ${_t('pdOpenEditor')}</button>
                        <div class="pd-input-row" style="margin-top:12px;">
                            <label>${_t('pdQty')}</label>
                            <div style="display:flex; border:1px solid #cbd5e1; border-radius:8px; overflow:hidden; height:40px; flex:1;">
                                <button onclick="const i=document.getElementById('npcPdQty');i.value=Math.max(1,parseInt(i.value)-1);" style="flex:1;border:none;background:#f8fafc;cursor:pointer;font-weight:bold;">-</button>
                                <input type="number" id="npcPdQty" value="1" min="1" style="width:50px;text-align:center;border:none;font-weight:bold;font-size:15px;">
                                <button onclick="const i=document.getElementById('npcPdQty');i.value=parseInt(i.value)+1;" style="flex:1;border:none;background:#f8fafc;cursor:pointer;font-weight:bold;">+</button>
                            </div>
                        </div>
                        <button class="npc-choice-btn npc-yes" style="width:100%;margin-top:12px;padding:16px;font-size:16px;" onclick="window.NpcWizard._pdAddToCart()">${_t('pdAddToCart')}</button>
                    `;
                }
                this._insertToSlot('total');
                break;
            }
        }
    },

    _chooseFile(has) {
        this.hasFile = has;
        if (has) {
            this._goStep('upload');
        } else if (this._fromHoneycombDirect) {
            // 허니콤 직접주문: 디자인 선택 없이 바로 사이즈
            this._goStep('size');
        } else {
            // 파일 없음 → 직접/의뢰 먼저 선택
            this._goStep('chooseDesign');
        }
    },

    // 직접 디자인 선택 → 사이즈 입력으로
    _chooseSelfDesign() {
        this.designChoice = 'self';
        this._goStep('size');
    },

    // 전문가 의뢰 선택 → 채팅 열기
    _chooseExpert() {
        this._goStep('expertChat');
    },

    _afterSize() {
        if (this.hasOptions) {
            this._goStep('options');
        } else {
            this._afterOptions();
        }
    },

    _afterQty() {
        if (this.hasOptions) {
            this._goStep('options');
        } else {
            this._goStep('final');
        }
    },

    _afterOptions() {
        if (window.updateModalTotal) window.updateModalTotal();
        if (this.isPaperDisplay) {
            this._goStep('pdSummary');
        } else {
            this._goStep('final');
        }
    },

    // 허니콤보드: 직접 주문 → 파일 여부만 묻고 에디터 없이 진행
    // ★ hb_bx (허니콤 박스): 에디터로 바로 직행
    _honeycombDirect() {
        const key = this.product?.code || window.currentProductKey || '';
        if (key.startsWith('hb_bx')) {
            // 허니콤 박스 → 에디터 직행 (400×400 기본, 마법사 없이 빈 화면)
            window.startEditorDirect(key, 400, 400, null);
            return;
        }
        this.isHoneycomb = false;
        this._fromHoneycombDirect = true;
        this._goStep('askFile');
    },

    // 허니콤보드: 견적금액으로 결제 (장바구니에 담기)
    _honeycombPay() {
        const amountInput = document.getElementById('npcHcAmount');
        if (!amountInput) return;
        const amount = parseInt(amountInput.value.replace(/[^0-9]/g, ''));
        if (!amount || amount <= 0) {
            if (window.showToast) window.showToast(_t('hcInputAmount'), 'warn');
            amountInput.focus();
            return;
        }

        const product = this.product;
        if (!product) return;

        import('./order.js?v=123').then(m => {
            const productToCart = { ...product };
            productToCart.price = amount;
            productToCart.is_custom = false;

            // 업로드된 파일이 있으면 포함
            const pendingFiles = window._pendingUploadedFiles || [];
            let extraFields = null;
            if (pendingFiles.length > 0) {
                extraFields = {
                    type: 'file_upload',
                    fileName: pendingFiles.map(f => f.fileName).join(', '),
                    originalUrl: pendingFiles[0].originalUrl,
                    uploadedFiles: [...pendingFiles],
                    thumb: pendingFiles[0].thumb
                };
            }

            m.addProductToCartDirectly(productToCart, 1, [], {}, extraFields);
            window._pendingUploadedFiles = [];
            document.getElementById('choiceModal').style.display = 'none';
            document.getElementById('cartAddedModal').style.display = 'flex';
        }).catch(err => {
            console.error('허니콤보드 장바구니 오류:', err);
            if (window.showToast) window.showToast('Error: ' + err.message, 'error');
        });
    },

    // ═══ 종이매대 헬퍼 메서드 ═══

    _pdCalcShelves(totalH, adH, shelfH) {
        const usable = totalH - adH;
        if (usable <= 0) return { count: 0, usable: 0, remainder: 0 };
        const count = Math.floor(usable / shelfH);
        const remainder = usable - (count * shelfH);
        return { count, usable, remainder };
    },

    _pdRenderDiagram(w, h, adH, shelfH, calc) {
        if (!h || h <= 0) return '';
        const maxPx = 250; // 다이어그램 최대 높이 (px)
        const scale = maxPx / h;
        const adPx = Math.max(adH * scale, 20);
        const shPx = Math.max(shelfH * scale, 18);
        const remPx = Math.max(calc.remainder * scale, 0);

        let html = `<div class="pd-diagram" style="height:${Math.min(h * scale, maxPx)}px;width:${Math.min(w * scale * 1.5, 200)}px;margin:12px auto;">`;
        // 상단 광고
        html += `<div class="pd-diagram-ad" style="height:${adPx}px;">📢 ${adH}cm</div>`;
        // 선반들
        for (let i = 0; i < calc.count; i++) {
            html += `<div class="pd-diagram-shelf" style="height:${shPx}px;">📦 ${i + 1} (${shelfH}cm)</div>`;
        }
        // 남은 공간
        if (calc.remainder > 0) {
            html += `<div class="pd-diagram-remainder" style="height:${Math.max(remPx, 14)}px;">${calc.remainder}cm</div>`;
        }
        html += '</div>';
        // 요약 텍스트
        html += `<div style="text-align:center;font-size:13px;color:#334155;font-weight:600;margin-top:4px;">
            ${w}cm x ${h}cm → ${_t('pdAdArea')} ${adH}cm + <strong>${calc.count}</strong>${_t('pdShelfCount')} (${shelfH}cm)
        </div>`;
        return html;
    },

    _pdAfterSize() {
        const wEl = document.getElementById('npcPdWidth');
        const hEl = document.getElementById('npcPdHeight');
        const dEl = document.getElementById('npcPdDepth');
        let w = parseInt(wEl && wEl.value) || 0;
        let h = parseInt(hEl && hEl.value) || 0;
        let d = parseInt(dEl && dEl.value) || 30;
        if (w < 10 || h < 10) {
            if (window.showToast) window.showToast(_t('pdEnterSize'), 'warn');
            return;
        }
        // 최대값 제한
        w = Math.min(w, 60);
        h = Math.min(h, 150);
        d = Math.min(d, 40);
        this._pdWidth = w;
        this._pdHeight = h;
        this._pdDepth = d;
        this._goStep('pdAdHeight');
    },

    _pdCalcAndShow() {
        const adEl = document.getElementById('npcPdAdH');
        const shEl = document.getElementById('npcPdShelfH');
        this._pdAdHeight = parseInt(adEl && adEl.value) || 20;
        this._pdShelfHeight = parseInt(shEl && shEl.value) || 25;
        if (this._pdAdHeight >= this._pdHeight) {
            if (window.showToast) window.showToast('Ad height must be less than total height', 'warn');
            return;
        }
        const calc = this._pdCalcShelves(this._pdHeight, this._pdAdHeight, this._pdShelfHeight);
        this._pdShelfCount = calc.count;
        this._goStep('pdCalcResult');
    },

    _pdAfterCalc() {
        this._goStep('pdReference');
    },

    _pdSelectRef(code, el) {
        document.querySelectorAll('.pd-ref-card').forEach(c => c.classList.remove('selected'));
        if (el) el.classList.add('selected');
        this._pdRefCode = code;
        const ref = this._pdRefs.find(r => r.code === code);
        if (ref) {
            const lang = _npcLang();
            this._pdRefName = (lang === 'ja' && ref.name_jp) ? ref.name_jp : (lang === 'en' && ref.name_us) ? ref.name_us : ref.name;
        }
    },

    _pdAfterRef() {
        this._goStep('pdCustomize');
    },

    _pdUploadFile(area, inputEl) {
        const file = inputEl && inputEl.files && inputEl.files[0];
        if (!file) return;
        this._pdCustom[area] = { name: file.name, file };
        // 상태 업데이트
        const statusEl = inputEl.closest('.pd-custom-card').querySelector('.pd-custom-status');
        if (statusEl) statusEl.textContent = _t('pdSet');
    },

    _pdAfterCustomize() {
        if (this.hasOptions) {
            this._goStep('options');
        } else {
            this._goStep('pdSummary');
        }
    },

    _pdOpenEditor() {
        const product = this.product;
        if (!product) return;
        // 배경색 업데이트 (color picker에서 최신값)
        const colorEl = document.querySelector('#npcContentSlot input[type="color"]');
        if (colorEl) this._pdCustom.bgColor = colorEl.value;

        const widthMM = this._pdWidth * 10;
        const heightMM = this._pdHeight * 10;

        // 종이매대 데이터를 전역에 저장 (에디터에서 참조)
        window.__paperDisplayMode = true;
        window.__paperDisplayData = {
            widthMM,
            heightMM,
            adHeightMM: this._pdAdHeight * 10,
            shelfHeightMM: this._pdShelfHeight * 10,
            depthMM: this._pdDepth * 10,
            shelfCount: this._pdShelfCount,
            bgColor: this._pdCustom.bgColor,
            refCode: this._pdRefCode,
        };

        // 에디터 열기 (choiceModal은 startEditorDirect 내부에서 로그인 확인 후 닫음)
        window.startEditorDirect(product.code, widthMM, heightMM, null);
    },

    async _pdLoadReferences() {
        const sb = window.sb;
        if (!sb) return [];
        try {
            let subCats = [];
            if (window.globalSubCats) {
                const found = window.globalSubCats
                    .filter(c => (c.top_category_code && c.top_category_code.includes('paper')) || (c.code && c.code.startsWith('pd')))
                    .map(c => c.code);
                if (found.length) subCats = found;
            }
            // 현재 상품의 카테고리도 포함
            const curCat = this.product && this.product.category;
            if (curCat && !subCats.includes(curCat)) subCats.push(curCat);
            if (subCats.length === 0) return [];

            const { data } = await sb.from('admin_products')
                .select('code, name, name_jp, name_us, img_url, category')
                .in('category', subCats)
                .limit(20);
            return data || [];
        } catch (e) {
            console.warn('종이매대 레퍼런스 로드 실패:', e);
            return [];
        }
    },

    _pdAddToCart() {
        const product = this.product;
        if (!product) return;
        const qty = parseInt(document.getElementById('npcPdQty')?.value) || 1;

        import('./order.js?v=123').then(m => {
            const productToCart = { ...product };
            // 가로x높이를 mm로 변환하여 설정
            productToCart.w_mm = this._pdWidth * 10;
            productToCart.h_mm = this._pdHeight * 10;
            productToCart.is_custom = true;

            const extraFields = {
                type: 'paper_display',
                totalWidth: this._pdWidth,
                totalHeight: this._pdHeight,
                adHeight: this._pdAdHeight,
                shelfCount: this._pdShelfCount,
                shelfHeight: this._pdShelfHeight,
                referenceCode: this._pdRefCode,
                referenceName: this._pdRefName,
                customization: { ...this._pdCustom },
            };

            // 업로드된 파일 처리
            const pendingFiles = window._pendingUploadedFiles || [];
            if (pendingFiles.length > 0) {
                extraFields.uploadedFiles = [...pendingFiles];
            }

            m.addProductToCartDirectly(productToCart, qty, [], {}, extraFields);
            window._pendingUploadedFiles = [];
            document.getElementById('choiceModal').style.display = 'none';
            document.getElementById('cartAddedModal').style.display = 'flex';
        }).catch(err => {
            console.error('종이매대 장바구니 오류:', err);
            if (window.showToast) window.showToast('Error: ' + err.message, 'error');
        });
    },

    _goPrev() {
        const step = this.step;
        // 종이매대
        if (step === 'pdAdHeight') { this._goStep('pdSize'); return; }
        if (step === 'pdCalcResult') { this._goStep('pdAdHeight'); return; }
        if (step === 'pdReference') { this._goStep('pdCalcResult'); return; }
        if (step === 'pdCustomize') { this._goStep('pdReference'); return; }
        if (step === 'pdSummary' && this.hasOptions) { this._goStep('options'); return; }
        if (step === 'pdSummary') { this._goStep('pdCustomize'); return; }
        // 옵션에서 이전: 종이매대면 커스터마이징으로
        if (step === 'options' && this.isPaperDisplay) { this._goStep('pdCustomize'); return; }
        // 허니콤보드
        if (step === 'honeycombInput') { this._goStep('honeycombAsk'); return; }
        if (step === 'honeycombChoice') { this._goStep('honeycombAsk'); return; }
        // 면적 기반 시공 상품: size가 첫 단계이므로 size에서 이전 없음
        if (step === 'size' && this.isCustom && this.isGeneral) { return; }
        if (step === 'upload') { this._goStep('askFile'); return; }
        if (step === 'size' && this.hasFile) { this._goStep('upload'); return; }
        if (step === 'size' && !this.hasFile && this._fromHoneycombDirect) { this._goStep('askFile'); return; }
        if (step === 'size' && !this.hasFile) { this._goStep('chooseDesign'); return; }
        if (step === 'chooseDesign') { this._goStep('askFile'); return; }
        if (step === 'expertChat') { this._goStep('chooseDesign'); return; }
        if (step === 'options') { this._goStep('size'); return; }
        if (step === 'final' && this.hasOptions) { this._goStep('options'); return; }
        if (step === 'final' && this.isCustom) { this._goStep('size'); return; }
        if (step === 'final' && !this.isCustom && this.isGeneral) { this._goStep('qty'); return; }
    },

    _watchFileUpload() {
        if (this._fileWatcher) clearInterval(this._fileWatcher);
        let lastCount = 0;
        this._fileWatcher = setInterval(() => {
            if (!this.active) { clearInterval(this._fileWatcher); return; }
            const files = window._pendingUploadedFiles || [];
            if (files.length > lastCount && this.step === 'upload') {
                lastCount = files.length;
                this._renderBubble(_t('uploaded'), null, true, null,
                    { onclick: "window.NpcWizard._goStep('size')" });
                this._showSection('uploadPreview');
                this._insertToSlot('upload', 'uploadPreview');
            }
        }, 500);
    },
};

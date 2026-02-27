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
    hasOptions: false,
    sections: {},
    guideEl: null,
    _fileWatcher: null,

    init(product) {
        this.product = product;
        this.isCustom = !!product.is_custom_size;
        this.isGeneral = !!product.is_general_product;
        const key = product.code || window.currentProductKey || '';
        this.isHoneycomb = (product.category === 'honeycomb') || (product.category === 'honeycomb_box') || (typeof key === 'string' && key.startsWith('hb'));
        this.hasFile = null;
        this.designChoice = null;
        this._fromHoneycombDirect = false;
        this.step = 0;
        this.active = true;

        const rightActions = document.getElementById('choiceRightActions');
        if (!rightActions) return;

        const addonArea = rightActions.querySelector('#addonCategoryArea');
        this.hasOptions = !!(addonArea && addonArea.querySelectorAll('input[name="userOption"]').length > 0);

        this._tagSections(rightActions);
        this._hideAll();
        this._createGuideArea(rightActions);

        if (this.isHoneycomb) {
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
        this._goStep('final');
    },

    // 허니콤보드: 직접 주문 → 파일 여부만 묻고 에디터 없이 진행
    _honeycombDirect() {
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

    _goPrev() {
        const step = this.step;
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

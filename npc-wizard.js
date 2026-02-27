// ═══════════════════════════════════════════════════════════════
// NPC 가이드 주문 위자드 — 모바일 전용 (768px 이하)
// 기존 모달 요소를 단계별로 show/hide하여 게임 NPC 안내 느낌 제공
// ═══════════════════════════════════════════════════════════════

const NPC_TEXTS = {
    kr: {
        askFile: '인쇄할 파일이 있으신가요?',
        yes: '네, 있어요!',
        no: '아니요, 없어요',
        uploadFile: '멋진 작품이네요! 여기에 파일을 올려주세요 📎',
        enterSize: '제작할 제품의 가로 또는 세로 사이즈를 입력하시면 견적을 드릴게요 📏',
        selectOption: '옵션을 선택하세요 ✨',
        finalCart: '자, 이제 장바구니 버튼만 누르시면 됩니다. 수고하셨습니다! 🎉',
        chooseDesign: '어떻게 디자인하시겠어요?',
        selfDesign: '🎨 직접 디자인하기',
        expertDesign: '👨‍🎨 전문가에게 의뢰',
        selectQty: '수량을 선택해주세요 📦',
        cartFinal: '장바구니에 담으면 끝! 🎉',
        next: '다음 →',
        prev: '← 이전',
        skipOption: '옵션 없이 진행 →',
        uploaded: '파일이 업로드 되었네요! 다음 단계로 넘어갈게요 👍',
    },
    ja: {
        askFile: '印刷するファイルはお持ちですか？',
        yes: 'はい、あります！',
        no: 'いいえ、ありません',
        uploadFile: '素敵な作品ですね！ファイルをアップロードしてください 📎',
        enterSize: '製品の横または縦サイズを入力すると見積もりをお出しします 📏',
        selectOption: 'オプションを選択してください ✨',
        finalCart: 'カートボタンを押すだけで完了です。お疲れ様でした！ 🎉',
        chooseDesign: 'どのようにデザインしますか？',
        selfDesign: '🎨 自分でデザイン',
        expertDesign: '👨‍🎨 専門家に依頼',
        selectQty: '数量を選択してください 📦',
        cartFinal: 'カートに入れたら完了です！ 🎉',
        next: '次へ →',
        prev: '← 戻る',
        skipOption: 'オプションなしで進む →',
        uploaded: 'アップロード完了！次のステップへ 👍',
    },
    en: {
        askFile: 'Do you have a file to print?',
        yes: 'Yes, I do!',
        no: "No, I don't",
        uploadFile: "Great work! Please upload your file here 📎",
        enterSize: "Enter the width or height and we'll give you a quote 📏",
        selectOption: 'Select your options ✨',
        finalCart: "Just click the cart button and you're done! Great job! 🎉",
        chooseDesign: 'How would you like to design?',
        selfDesign: '🎨 Design it myself',
        expertDesign: '👨‍🎨 Request an expert',
        selectQty: 'Select quantity 📦',
        cartFinal: 'Add to cart and done! 🎉',
        next: 'Next →',
        prev: '← Back',
        skipOption: 'Skip options →',
        uploaded: 'File uploaded! Moving to next step 👍',
    },
    zh: {
        askFile: '您有要印刷的文件吗？',
        yes: '有！',
        no: '没有',
        uploadFile: '很棒的作品！请在这里上传文件 📎',
        enterSize: '输入产品的宽度或高度，我们会为您报价 📏',
        selectOption: '请选择选项 ✨',
        finalCart: '点击购物车按钮就完成了！辛苦了！ 🎉',
        chooseDesign: '您想如何设计？',
        selfDesign: '🎨 自己设计',
        expertDesign: '👨‍🎨 委托专家',
        selectQty: '请选择数量 📦',
        cartFinal: '加入购物车就完成了！ 🎉',
        next: '下一步 →',
        prev: '← 上一步',
        skipOption: '跳过选项 →',
        uploaded: '文件上传完成！进入下一步 👍',
    },
    ar: {
        askFile: 'هل لديك ملف للطباعة؟',
        yes: 'نعم!',
        no: 'لا',
        uploadFile: 'عمل رائع! يرجى رفع ملفك هنا 📎',
        enterSize: 'أدخل العرض أو الارتفاع وسنعطيك عرض سعر 📏',
        selectOption: 'اختر الخيارات ✨',
        finalCart: 'اضغط على زر السلة وانتهيت! عمل رائع! 🎉',
        chooseDesign: 'كيف تريد التصميم؟',
        selfDesign: '🎨 تصميم بنفسي',
        expertDesign: '👨‍🎨 طلب خبير',
        selectQty: 'اختر الكمية 📦',
        cartFinal: 'أضف للسلة وانتهيت! 🎉',
        next: 'التالي →',
        prev: '← السابق',
        skipOption: 'تخطي الخيارات →',
        uploaded: 'تم رفع الملف! الخطوة التالية 👍',
    },
    es: {
        askFile: '¿Tienes un archivo para imprimir?',
        yes: '¡Sí, tengo!',
        no: 'No, no tengo',
        uploadFile: '¡Gran trabajo! Sube tu archivo aquí 📎',
        enterSize: 'Ingresa el ancho o alto y te daremos un presupuesto 📏',
        selectOption: 'Selecciona tus opciones ✨',
        finalCart: '¡Solo presiona el botón del carrito y listo! 🎉',
        chooseDesign: '¿Cómo quieres diseñar?',
        selfDesign: '🎨 Diseñar yo mismo',
        expertDesign: '👨‍🎨 Solicitar experto',
        selectQty: 'Selecciona la cantidad 📦',
        cartFinal: '¡Agregar al carrito y listo! 🎉',
        next: 'Siguiente →',
        prev: '← Anterior',
        skipOption: 'Saltar opciones →',
        uploaded: '¡Archivo subido! Siguiente paso 👍',
    },
    de: {
        askFile: 'Haben Sie eine Datei zum Drucken?',
        yes: 'Ja!',
        no: 'Nein',
        uploadFile: 'Tolle Arbeit! Laden Sie Ihre Datei hier hoch 📎',
        enterSize: 'Geben Sie Breite oder Höhe ein für ein Angebot 📏',
        selectOption: 'Wählen Sie Ihre Optionen ✨',
        finalCart: 'Einfach auf den Warenkorb klicken und fertig! 🎉',
        chooseDesign: 'Wie möchten Sie gestalten?',
        selfDesign: '🎨 Selbst gestalten',
        expertDesign: '👨‍🎨 Experte beauftragen',
        selectQty: 'Menge wählen 📦',
        cartFinal: 'In den Warenkorb und fertig! 🎉',
        next: 'Weiter →',
        prev: '← Zurück',
        skipOption: 'Ohne Optionen →',
        uploaded: 'Datei hochgeladen! Nächster Schritt 👍',
    },
    fr: {
        askFile: 'Avez-vous un fichier à imprimer ?',
        yes: 'Oui !',
        no: 'Non',
        uploadFile: 'Super travail ! Téléchargez votre fichier ici 📎',
        enterSize: 'Entrez la largeur ou la hauteur pour un devis 📏',
        selectOption: 'Sélectionnez vos options ✨',
        finalCart: 'Cliquez sur le panier et c\'est fini ! 🎉',
        chooseDesign: 'Comment souhaitez-vous concevoir ?',
        selfDesign: '🎨 Concevoir moi-même',
        expertDesign: '👨‍🎨 Demander un expert',
        selectQty: 'Choisissez la quantité 📦',
        cartFinal: 'Ajoutez au panier et c\'est fini ! 🎉',
        next: 'Suivant →',
        prev: '← Retour',
        skipOption: 'Passer les options →',
        uploaded: 'Fichier envoyé ! Étape suivante 👍',
    },
};

function _npcLang() {
    const l = window.currentLang || 'kr';
    if (l === 'ja') return 'ja';
    if (l === 'en') return 'en';
    if (l === 'zh') return 'zh';
    if (l === 'ar') return 'ar';
    if (l === 'es') return 'es';
    if (l === 'de') return 'de';
    if (l === 'fr') return 'fr';
    return 'kr';
}
function _t(key) {
    const lang = _npcLang();
    return (NPC_TEXTS[lang] && NPC_TEXTS[lang][key]) || NPC_TEXTS.kr[key] || key;
}

window.NpcWizard = {
    active: false,
    step: 0,
    hasFile: null,
    product: null,
    isCustom: false,
    isGeneral: false,
    hasOptions: false,
    sections: {},       // cached DOM references
    guideEl: null,      // NPC guide area element
    _fileWatcher: null,

    init(product) {
        if (window.innerWidth > 768) return;
        this.product = product;
        this.isCustom = !!product.is_custom_size;
        this.isGeneral = !!product.is_general_product;
        this.hasFile = null;
        this.step = 0;
        this.active = true;

        const rightActions = document.getElementById('choiceRightActions');
        if (!rightActions) return;

        // 옵션 있는지 확인
        const addonArea = rightActions.querySelector('#addonCategoryArea');
        this.hasOptions = !!(addonArea && addonArea.querySelectorAll('input[name="userOption"]').length > 0);

        // 기존 요소들을 data-npc-section으로 그룹화
        this._tagSections(rightActions);

        // 모든 섹션 숨기기
        this._hideAll();

        // NPC 가이드 영역 삽입
        this._createGuideArea(rightActions);

        // 헤더(썸네일+상품명)는 항상 보이기
        this._showSection('header');

        // 첫 번째 스텝
        if (this.isGeneral) {
            this._goStep('qty');
        } else {
            this._goStep('askFile');
        }

        // 파일 업로드 감시
        this._watchFileUpload();
    },

    destroy() {
        this.active = false;
        if (this._fileWatcher) clearInterval(this._fileWatcher);
        if (this.guideEl) this.guideEl.remove();
        // 모든 섹션 다시 보이기
        Object.values(this.sections).forEach(el => {
            if (el) el.style.display = '';
        });
    },

    // 기존 요소들에 섹션 태그 부여
    _tagSections(container) {
        const children = Array.from(container.children);
        this.sections = {};

        if (this.isCustom) {
            // Custom product: header(img+name) → upload area → preview → size → qty → estimate → options → total → buttons
            // productHeaderHtml is first child (the card with img)
            if (children[0]) { this.sections.header = children[0]; }
            // Children after header: upload section, preview, size, qty, estimate
            // Find by IDs
            this.sections.upload = container.querySelector('#btnKeyringUpload')?.closest('div:not(#choiceRightActions)');
            this.sections.uploadPreview = container.querySelector('#uploadPreviewArea');
            this.sections.uploadedFiles = container.querySelector('#uploadedFilesList');
            // Size section: contains #inputCustW
            const sizeInput = container.querySelector('#inputCustW');
            if (sizeInput) this.sections.size = sizeInput.closest('div[style*="background:#f8fafc"]') || sizeInput.parentElement?.parentElement;
            // Quantity: contains #inputCustQty
            const qtyLabel = container.querySelector('#inputCustQty');
            if (qtyLabel) {
                this.sections.qtyLabel = qtyLabel.closest('.qty-wrapper')?.previousElementSibling;
                this.sections.qty = qtyLabel.closest('.qty-wrapper');
            }
            // AI estimate box
            const calcPrice = container.querySelector('#calcResultPrice');
            if (calcPrice) this.sections.estimate = calcPrice.closest('div[style*="linear-gradient"]');
        } else {
            // General/non-custom product
            if (children[0]) this.sections.header = children[0];
            // Price display (gradient box with price)
            const priceBox = container.querySelector('#fixedProdQty');
            if (priceBox) {
                this.sections.price = priceBox.closest('.qty-wrapper')?.previousElementSibling;
                this.sections.qty = priceBox.closest('.qty-wrapper');
            }
        }
        // Options area
        this.sections.options = container.querySelector('#addonCategoryArea');
        // Total box
        const totalEl = container.querySelector('#modalRealtimeTotal');
        if (totalEl) this.sections.total = totalEl.closest('div[style*="border:2px solid"]');
        // Buttons area (last child with buttons)
        const allDivs = container.querySelectorAll(':scope > div');
        const lastDiv = allDivs[allDivs.length - 1];
        if (lastDiv && (lastDiv.querySelector('.btn-round') || lastDiv.querySelector('button[onclick*="confirmChoice"]'))) {
            this.sections.buttons = lastDiv;
        }
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

    _hideSection(name) {
        const el = this.sections[name];
        if (el) el.style.display = 'none';
    },

    _createGuideArea(container) {
        if (this.guideEl) this.guideEl.remove();
        const div = document.createElement('div');
        div.id = 'npcGuideArea';
        div.className = 'npc-guide-area';
        container.insertBefore(div, this.sections.header ? this.sections.header.nextSibling : container.firstChild);
        this.guideEl = div;
    },

    _renderBubble(text, choices, showNav) {
        if (!this.guideEl) return;
        let html = `
            <div class="npc-bubble-wrap">
                <div class="npc-avatar">🦎</div>
                <div class="npc-bubble">${text}</div>
            </div>`;
        if (choices && choices.length > 0) {
            html += '<div class="npc-choices">';
            choices.forEach(c => {
                html += `<button class="npc-choice-btn ${c.cls || ''}" onclick="${c.onclick}">${c.label}</button>`;
            });
            html += '</div>';
        }
        if (showNav) {
            html += `<div class="npc-nav">
                <button class="npc-nav-btn npc-prev" onclick="window.NpcWizard._goPrev()">${_t('prev')}</button>
            </div>`;
        }
        this.guideEl.innerHTML = html;
        // 스크롤 to guide
        this.guideEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
                this._showSection('uploadPreview');
                this._showSection('uploadedFiles');
                this._renderBubble(_t('uploadFile'), [
                    { label: _t('next'), cls: 'npc-next', onclick: "window.NpcWizard._goStep('size')" },
                ], true);
                break;

            case 'size':
                this._showSection('size');
                this._showSection('qtyLabel');
                this._showSection('qty');
                this._showSection('estimate');
                if (this.isCustom) {
                    this._renderBubble(_t('enterSize'), [
                        { label: _t('next'), cls: 'npc-next', onclick: "window.NpcWizard._afterSize()" },
                    ], true);
                }
                break;

            case 'qty':
                // 일반 상품용
                this._showSection('price');
                this._showSection('qty');
                this._renderBubble(_t('selectQty'), [
                    { label: _t('next'), cls: 'npc-next', onclick: "window.NpcWizard._afterQty()" },
                ]);
                break;

            case 'options':
                this._showSection('options');
                this._renderBubble(_t('selectOption'), [
                    { label: _t('next'), cls: 'npc-next', onclick: "window.NpcWizard._afterOptions()" },
                ], true);
                break;

            case 'final':
                this._showSection('total');
                this._showSection('buttons');
                if (this.isGeneral) {
                    this._renderBubble(_t('cartFinal'), null, true);
                } else {
                    this._renderBubble(_t('finalCart'), null, true);
                }
                // 가격 업데이트
                if (window.updateModalTotal) window.updateModalTotal();
                break;

            case 'chooseDesign':
                this._showSection('total');
                this._renderBubble(_t('chooseDesign'), [
                    { label: _t('selfDesign'), cls: 'npc-yes', onclick: "window.confirmChoice('editor')" },
                    { label: _t('expertDesign'), cls: 'npc-expert', onclick: "if(window.ChamBot)window.ChamBot.toggle();" },
                ], true);
                if (window.updateModalTotal) window.updateModalTotal();
                break;
        }
    },

    _chooseFile(has) {
        this.hasFile = has;
        if (has) {
            this._goStep('upload');
        } else {
            this._goStep('size');
        }
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
        if (this.isGeneral || this.hasFile) {
            this._goStep('final');
        } else {
            // 파일 없음 → 에디터/전문가 선택
            this._goStep('chooseDesign');
        }
    },

    _goPrev() {
        const step = this.step;
        if (step === 'upload') { this._goStep('askFile'); return; }
        if (step === 'size' && this.hasFile) { this._goStep('upload'); return; }
        if (step === 'size' && !this.hasFile) { this._goStep('askFile'); return; }
        if (step === 'options' && this.isCustom) { this._goStep('size'); return; }
        if (step === 'options' && this.isGeneral) { this._goStep('qty'); return; }
        if (step === 'final' && this.hasOptions) { this._goStep('options'); return; }
        if (step === 'final' && this.isCustom) { this._goStep('size'); return; }
        if (step === 'final' && this.isGeneral) { this._goStep('qty'); return; }
        if (step === 'chooseDesign' && this.hasOptions) { this._goStep('options'); return; }
        if (step === 'chooseDesign') { this._goStep('size'); return; }
    },

    // 파일 업로드 감시 (파일이 올라오면 다음 스텝으로 자동 유도)
    _watchFileUpload() {
        if (this._fileWatcher) clearInterval(this._fileWatcher);
        let lastCount = 0;
        this._fileWatcher = setInterval(() => {
            if (!this.active) { clearInterval(this._fileWatcher); return; }
            const files = window._pendingUploadedFiles || [];
            if (files.length > lastCount && this.step === 'upload') {
                lastCount = files.length;
                // 파일 올라옴 → 버블 업데이트
                this._renderBubble(_t('uploaded'), [
                    { label: _t('next'), cls: 'npc-next', onclick: "window.NpcWizard._goStep('size')" },
                ], true);
                this._showSection('uploadedFiles');
                this._showSection('uploadPreview');
            }
        }, 500);
    },
};

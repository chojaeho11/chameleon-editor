// 상품 공통정보 업데이트 스크립트 — 블로그 서술형 (8개 언어)
const { createClient } = require('@supabase/supabase-js');

(async () => {

const sb = createClient(
    'https://qinvtnhiidtmrzosyvys.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y'
);

// ─── 블로그 서술형 빌더 ───
function buildBlog(data) {
    const sections = data.sections.map(s => {
        return `<div class="ci-section">
<h3 class="ci-heading">${s.title}</h3>
<p class="ci-body">${s.body}</p>
</div>`;
    }).join('\n');

    return `<div class="ci-blog">
${sections}
</div>`;
}

// ═══════════════════════════════════════
// 블로그 서술형 — 8개 언어
// ═══════════════════════════════════════

const kr = buildBlog({
    sections: [
        {
            title: '누구나 쉽게, 무료 에디터로 디자인부터 주문까지',
            body: '카멜레온프린팅은 전문 디자이너가 아니더라도 누구나 쉽게 디자인하고 주문할 수 있는 무료 온라인 에디터를 제공합니다. 복잡한 프로그램 설치 없이 웹브라우저에서 바로 작업할 수 있으며, 직관적인 인터페이스로 원하는 결과물을 빠르게 완성할 수 있습니다.'
        },
        {
            title: '팝업스토어부터 전시 부스, 실내 연출까지',
            body: '카멜레온프린팅은 팝업스토어, 행사, 전시에 필요한 리보드(허니콤보드) 부스를 비롯해, 실내 공간을 연출할 수 있는 패브릭 인쇄, 각종 인쇄물과 굿즈까지 폭넓게 생산합니다. 또한 친환경 인쇄 전문 기업으로서 공해 물질을 유발하지 않는 친환경 인쇄 방식을 고집하고 있습니다.'
        },
        {
            title: '전 세계 주요 도시 직접 설치, 어디서나 무료 배송',
            body: '설치가 필요한 대형 작업물(부스)의 경우, 전 세계 주요 도시에 설치팀이 직접 방문하여 설치해 드립니다. 그 외 배송이 가능한 모든 제품은 전 세계 어디서나 무료로 받아보실 수 있습니다. 카멜레온프린팅은 도쿄, 서울, 미국 동부·서부, 독일, 싱가포르, 두바이에 생산 공장을 보유하고 있어 가장 가까운 거점에서 신속하게 제작·배송합니다.'
        }
    ]
});

const jp = buildBlog({
    sections: [
        {
            title: '誰でも簡単に、無料エディタでデザインから注文まで',
            body: 'カメレオンプリンティングは、プロのデザイナーでなくても誰でも簡単にデザイン・注文ができる無料オンラインエディタを提供しています。複雑なソフトのインストールは不要で、ウェブブラウザから直接作業でき、直感的なインターフェースで思い通りの仕上がりをスピーディーに実現できます。'
        },
        {
            title: 'ポップアップストアから展示ブース、空間演出まで',
            body: 'カメレオンプリンティングは、ポップアップストア・イベント・展示会に必要なリボード（ハニカムボード）ブースをはじめ、室内空間を演出するファブリック印刷、各種印刷物やグッズまで幅広く生産しています。また、環境にやさしい印刷専門企業として、公害物質を発生させないエコ印刷方式にこだわっています。'
        },
        {
            title: '世界主要都市への直接設置、どこでも送料無料',
            body: '設置が必要な大型制作物（ブース）の場合、世界の主要都市に設置チームが直接訪問して設置いたします。その他、配送可能なすべての製品は世界中どこでも送料無料でお届けします。カメレオンプリンティングは東京、ソウル、米国東部・西部、ドイツ、シンガポール、ドバイに生産工場を持ち、最寄りの拠点から迅速に製作・配送いたします。'
        }
    ]
});

const us = buildBlog({
    sections: [
        {
            title: 'Design and Order Easily with Our Free Online Editor',
            body: 'Chameleon Printing provides a free online editor that anyone can use to design and place orders with ease — no professional design skills required. There is no need to install complex software; simply work directly from your web browser with an intuitive interface to quickly create exactly what you need.'
        },
        {
            title: 'From Pop-up Stores to Exhibition Booths and Interior Displays',
            body: 'Chameleon Printing produces re-board (honeycomb board) booths for pop-up stores, events, and exhibitions, as well as fabric printing for interior space design, along with a wide range of printed materials and merchandise. As an eco-friendly printing company, we are committed to environmentally responsible printing methods that produce no harmful pollutants.'
        },
        {
            title: 'On-site Installation Worldwide, Free Shipping Everywhere',
            body: 'For large-scale installations such as booths, our installation teams travel to major cities around the world to set up on site. All other shippable products are delivered free of charge anywhere in the world. Chameleon Printing operates production facilities in Tokyo, Seoul, US East Coast, US West Coast, Germany, Singapore, and Dubai — ensuring fast production and delivery from the nearest location.'
        }
    ]
});

const cn = buildBlog({
    sections: [
        {
            title: '人人都能轻松使用，免费编辑器从设计到下单一站搞定',
            body: '变色龙印刷提供免费在线编辑器，即使不是专业设计师也能轻松完成设计和下单。无需安装复杂软件，直接在网页浏览器中操作，凭借直观的界面快速完成您想要的作品。'
        },
        {
            title: '从快闪店到展览展位，再到室内空间装饰',
            body: '变色龙印刷生产快闪店、活动、展览所需的蜂窝板展位，以及用于室内空间装饰的布艺印刷、各类印刷品和周边商品。作为环保印刷专业企业，我们坚持使用不产生污染物质的环保印刷方式。'
        },
        {
            title: '全球主要城市上门安装，全球免费配送',
            body: '对于需要安装的大型制作物（展位），我们的安装团队将亲赴全球主要城市进行现场安装。其他所有可配送产品均可在全球任何地方免费收货。变色龙印刷在东京、首尔、美国东部和西部、德国、新加坡、迪拜设有生产工厂，从最近的基地快速生产和配送。'
        }
    ]
});

const ar = buildBlog({
    sections: [
        {
            title: 'تصميم وطلب بسهولة مع محررنا المجاني عبر الإنترنت',
            body: 'يوفر كاميليون للطباعة محررًا مجانيًا عبر الإنترنت يمكن لأي شخص استخدامه لتصميم الطلبات وتقديمها بسهولة — دون الحاجة إلى مهارات تصميم احترافية. لا حاجة لتثبيت برامج معقدة؛ ما عليك سوى العمل مباشرة من متصفح الويب بواجهة بديهية لإنشاء ما تحتاجه بسرعة.'
        },
        {
            title: 'من المتاجر المؤقتة إلى أكشاك المعارض والديكورات الداخلية',
            body: 'ينتج كاميليون للطباعة أكشاك الألواح المموجة (ألواح قرص العسل) للمتاجر المؤقتة والفعاليات والمعارض، بالإضافة إلى الطباعة على الأقمشة لتصميم المساحات الداخلية، إلى جانب مجموعة واسعة من المواد المطبوعة والبضائع. كشركة طباعة صديقة للبيئة، نلتزم بأساليب طباعة مسؤولة بيئيًا لا تنتج ملوثات ضارة.'
        },
        {
            title: 'تركيب في الموقع حول العالم، شحن مجاني في كل مكان',
            body: 'بالنسبة للمنشآت الكبيرة مثل الأكشاك، تسافر فرق التركيب لدينا إلى المدن الرئيسية حول العالم للتركيب في الموقع. يتم تسليم جميع المنتجات الأخرى القابلة للشحن مجانًا إلى أي مكان في العالم. يمتلك كاميليون للطباعة مرافق إنتاج في طوكيو وسيول والساحل الشرقي والغربي للولايات المتحدة وألمانيا وسنغافورة ودبي — لضمان إنتاج وتسليم سريع من أقرب موقع.'
        }
    ]
});

const es = buildBlog({
    sections: [
        {
            title: 'Diseña y pide fácilmente con nuestro editor online gratuito',
            body: 'Chameleon Printing ofrece un editor online gratuito que cualquiera puede usar para diseñar y realizar pedidos con facilidad, sin necesidad de habilidades profesionales de diseño. No es necesario instalar software complejo; simplemente trabaja directamente desde tu navegador web con una interfaz intuitiva para crear rápidamente exactamente lo que necesitas.'
        },
        {
            title: 'Desde tiendas pop-up hasta stands de exposición y decoración interior',
            body: 'Chameleon Printing produce stands de re-board (panel de nido de abeja) para tiendas pop-up, eventos y exposiciones, así como impresión en tela para diseño de espacios interiores, junto con una amplia gama de materiales impresos y merchandising. Como empresa de impresión ecológica, estamos comprometidos con métodos de impresión ambientalmente responsables que no producen contaminantes nocivos.'
        },
        {
            title: 'Instalación presencial mundial, envío gratuito a cualquier lugar',
            body: 'Para instalaciones a gran escala como stands, nuestros equipos de instalación viajan a las principales ciudades del mundo para montar en el sitio. Todos los demás productos enviables se entregan de forma gratuita en cualquier parte del mundo. Chameleon Printing opera instalaciones de producción en Tokio, Seúl, costa este y oeste de EE.UU., Alemania, Singapur y Dubái, garantizando una producción y entrega rápidas desde la ubicación más cercana.'
        }
    ]
});

const de = buildBlog({
    sections: [
        {
            title: 'Einfach gestalten und bestellen mit unserem kostenlosen Online-Editor',
            body: 'Chameleon Printing bietet einen kostenlosen Online-Editor, den jeder nutzen kann, um mühelos zu gestalten und zu bestellen — ohne professionelle Designkenntnisse. Keine komplizierte Softwareinstallation nötig; arbeiten Sie einfach direkt in Ihrem Webbrowser mit einer intuitiven Oberfläche, um schnell genau das zu erstellen, was Sie brauchen.'
        },
        {
            title: 'Von Pop-up-Stores über Messestände bis zur Innenraumgestaltung',
            body: 'Chameleon Printing produziert Re-Board (Wabenplatten)-Stände für Pop-up-Stores, Veranstaltungen und Messen sowie Stoffdruck für die Innenraumgestaltung, zusammen mit einer breiten Palette an Druckmaterialien und Merchandise. Als umweltfreundliches Druckunternehmen setzen wir konsequent auf umweltverantwortliche Druckverfahren, die keine schädlichen Schadstoffe erzeugen.'
        },
        {
            title: 'Vor-Ort-Installation weltweit, kostenloser Versand überall',
            body: 'Für großformatige Installationen wie Messestände reisen unsere Installationsteams in die wichtigsten Städte weltweit, um vor Ort aufzubauen. Alle anderen versandfähigen Produkte werden weltweit kostenlos geliefert. Chameleon Printing betreibt Produktionsstätten in Tokio, Seoul, US-Ostküste, US-Westküste, Deutschland, Singapur und Dubai — für schnelle Produktion und Lieferung vom nächstgelegenen Standort.'
        }
    ]
});

const fr = buildBlog({
    sections: [
        {
            title: 'Concevez et commandez facilement avec notre éditeur en ligne gratuit',
            body: "Chameleon Printing propose un éditeur en ligne gratuit que tout le monde peut utiliser pour concevoir et passer des commandes en toute simplicité — aucune compétence professionnelle en design n'est requise. Pas besoin d'installer de logiciel complexe ; travaillez directement depuis votre navigateur web avec une interface intuitive pour créer rapidement exactement ce dont vous avez besoin."
        },
        {
            title: "Des pop-up stores aux stands d'exposition et à la décoration intérieure",
            body: "Chameleon Printing produit des stands en re-board (panneau nid d'abeille) pour les pop-up stores, événements et expositions, ainsi que l'impression sur tissu pour l'aménagement d'espaces intérieurs, accompagnés d'une large gamme de supports imprimés et de produits dérivés. En tant qu'entreprise d'impression écologique, nous nous engageons dans des méthodes d'impression respectueuses de l'environnement qui ne produisent aucun polluant nocif."
        },
        {
            title: 'Installation sur site dans le monde entier, livraison gratuite partout',
            body: "Pour les installations de grande envergure comme les stands, nos équipes d'installation se déplacent dans les grandes villes du monde entier pour effectuer le montage sur place. Tous les autres produits expédiables sont livrés gratuitement partout dans le monde. Chameleon Printing dispose d'installations de production à Tokyo, Séoul, côte est et ouest des États-Unis, Allemagne, Singapour et Dubaï — garantissant une production et une livraison rapides depuis le site le plus proche."
        }
    ]
});

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
    console.log('상품 공통정보 8개 언어 업데이트 완료! (블로그 서술형)');
}

})();

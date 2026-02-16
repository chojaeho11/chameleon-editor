// supabase/functions/shipping-calc/index.ts
// 배포: supabase functions deploy shipping-calc
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── 공장 (화성 + 도쿄만) ──
const FACTORIES = [
    { id: "hwaseong", lat: 37.20, lng: 126.83, name: { kr: "화성시 공장", ja: "華城市工場", en: "Hwaseong Factory", zh: "华城工厂", ar: "مصنع هواسونغ", es: "Fábrica Hwaseong", de: "Hwaseong Fabrik", fr: "Usine Hwaseong" } },
    { id: "tokyo", lat: 35.6938, lng: 139.7034, name: { kr: "도쿄(신주쿠) 공장", ja: "東京(新宿)工場", en: "Tokyo (Shinjuku) Factory", zh: "东京(新宿)工厂", ar: "مصنع طوكيو (شينجوكو)", es: "Fábrica Tokio (Shinjuku)", de: "Tokio (Shinjuku) Fabrik", fr: "Usine Tokyo (Shinjuku)" } },
];

// ── 주요 도시 좌표 (50+) ──
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
    // Korea
    "서울": { lat: 37.57, lng: 126.98 }, "seoul": { lat: 37.57, lng: 126.98 },
    "부산": { lat: 35.18, lng: 129.08 }, "busan": { lat: 35.18, lng: 129.08 },
    "인천": { lat: 37.46, lng: 126.71 }, "incheon": { lat: 37.46, lng: 126.71 },
    "대전": { lat: 36.35, lng: 127.38 }, "daejeon": { lat: 36.35, lng: 127.38 },
    "대구": { lat: 35.87, lng: 128.60 }, "daegu": { lat: 35.87, lng: 128.60 },
    "광주": { lat: 35.16, lng: 126.85 }, "gwangju": { lat: 35.16, lng: 126.85 },
    "제주": { lat: 33.50, lng: 126.53 }, "jeju": { lat: 33.50, lng: 126.53 },
    "수원": { lat: 37.26, lng: 127.03 }, "suwon": { lat: 37.26, lng: 127.03 },
    "울산": { lat: 35.54, lng: 129.31 }, "ulsan": { lat: 35.54, lng: 129.31 },
    "창원": { lat: 35.23, lng: 128.68 }, "changwon": { lat: 35.23, lng: 128.68 },
    "경기": { lat: 37.41, lng: 127.52 }, "경기도": { lat: 37.41, lng: 127.52 },
    "화성": { lat: 37.20, lng: 126.83 }, "hwaseong": { lat: 37.20, lng: 126.83 }, "화성시": { lat: 37.20, lng: 126.83 },
    // Japan
    "東京": { lat: 35.6938, lng: 139.7034 }, "tokyo": { lat: 35.6938, lng: 139.7034 }, "新宿": { lat: 35.6938, lng: 139.7034 }, "shinjuku": { lat: 35.6938, lng: 139.7034 },
    "大阪": { lat: 34.69, lng: 135.50 }, "osaka": { lat: 34.69, lng: 135.50 },
    "名古屋": { lat: 35.18, lng: 136.91 }, "nagoya": { lat: 35.18, lng: 136.91 },
    "福岡": { lat: 33.59, lng: 130.40 }, "fukuoka": { lat: 33.59, lng: 130.40 },
    "札幌": { lat: 43.06, lng: 141.35 }, "sapporo": { lat: 43.06, lng: 141.35 },
    "横浜": { lat: 35.44, lng: 139.64 }, "yokohama": { lat: 35.44, lng: 139.64 },
    "京都": { lat: 35.01, lng: 135.77 }, "kyoto": { lat: 35.01, lng: 135.77 },
    "神戸": { lat: 34.69, lng: 135.20 }, "kobe": { lat: 34.69, lng: 135.20 },
    "仙台": { lat: 38.27, lng: 140.87 }, "sendai": { lat: 38.27, lng: 140.87 },
    "広島": { lat: 34.40, lng: 132.46 }, "hiroshima": { lat: 34.40, lng: 132.46 },
    // US
    "new york": { lat: 40.71, lng: -74.01 }, "nyc": { lat: 40.71, lng: -74.01 }, "뉴욕": { lat: 40.71, lng: -74.01 },
    "los angeles": { lat: 34.05, lng: -118.24 }, "la": { lat: 34.05, lng: -118.24 },
    "chicago": { lat: 41.88, lng: -87.63 },
    "las vegas": { lat: 36.17, lng: -115.14 }, "라스베가스": { lat: 36.17, lng: -115.14 },
    "san francisco": { lat: 37.77, lng: -122.42 },
    "miami": { lat: 25.76, lng: -80.19 },
    "houston": { lat: 29.76, lng: -95.37 },
    "seattle": { lat: 47.61, lng: -122.33 },
    "dallas": { lat: 32.78, lng: -96.80 },
    "boston": { lat: 42.36, lng: -71.06 },
    // China
    "上海": { lat: 31.23, lng: 121.47 }, "shanghai": { lat: 31.23, lng: 121.47 },
    "北京": { lat: 39.90, lng: 116.41 }, "beijing": { lat: 39.90, lng: 116.41 },
    "深圳": { lat: 22.54, lng: 114.06 }, "shenzhen": { lat: 22.54, lng: 114.06 },
    "广州": { lat: 23.13, lng: 113.26 }, "guangzhou": { lat: 23.13, lng: 113.26 },
    // SE Asia
    "kuala lumpur": { lat: 3.14, lng: 101.69 }, "쿠알라룸푸르": { lat: 3.14, lng: 101.69 }, "malaysia": { lat: 3.14, lng: 101.69 },
    "singapore": { lat: 1.35, lng: 103.82 }, "싱가포르": { lat: 1.35, lng: 103.82 },
    "bangkok": { lat: 13.76, lng: 100.50 }, "방콕": { lat: 13.76, lng: 100.50 },
    // Europe
    "madrid": { lat: 40.42, lng: -3.70 }, "barcelona": { lat: 41.39, lng: 2.17 },
    "berlin": { lat: 52.52, lng: 13.41 }, "münchen": { lat: 48.14, lng: 11.58 }, "munich": { lat: 48.14, lng: 11.58 },
    "hamburg": { lat: 53.55, lng: 9.99 }, "frankfurt": { lat: 50.11, lng: 8.68 },
    "paris": { lat: 48.86, lng: 2.35 }, "lyon": { lat: 45.76, lng: 4.84 },
    "london": { lat: 51.51, lng: -0.13 },
    // Middle East
    "dubai": { lat: 25.20, lng: 55.27 }, "두바이": { lat: 25.20, lng: 55.27 }, "دبي": { lat: 25.20, lng: 55.27 },
    "riyadh": { lat: 24.71, lng: 46.68 }, "الرياض": { lat: 24.71, lng: 46.68 },
    "jeddah": { lat: 21.49, lng: 39.19 }, "جدة": { lat: 21.49, lng: 39.19 },
};

// ── 배송 라벨 ──
const LABELS: Record<string, Record<string, string>> = {
    air:     { kr: "항공 배송", ja: "航空配送", en: "Air Freight", zh: "航空运输", ar: "الشحن الجوي", es: "Envío aéreo", de: "Luftfracht", fr: "Fret aérien" },
    sea:     { kr: "해상 배송", ja: "海上配送", en: "Sea Freight", zh: "海运", ar: "الشحن البحري", es: "Envío marítimo", de: "Seefracht", fr: "Fret maritime" },
    truck:   { kr: "용차 배송", ja: "トラック配送", en: "Truck Delivery", zh: "卡车运输", ar: "التوصيل بالشاحنة", es: "Envío por camión", de: "LKW-Lieferung", fr: "Livraison par camion" },
    courier: { kr: "택배 / 항공택배", ja: "宅配便 / 航空宅配", en: "Courier / Air Parcel", zh: "快递 / 航空快递", ar: "البريد السريع / الجوي", es: "Mensajería / Aérea", de: "Paketdienst / Luftpaket", fr: "Colis express / Aérien" },
};
const DAYS_LABEL: Record<string, string> = { kr: "일", ja: "日", en: " days", zh: "天", ar: " أيام", es: " días", de: " Tage", fr: " jours" };

const CURRENCY_RATES: Record<string, number> = { KR: 1, JP: 0.2, US: 0.002, CN: 0.01, AR: 0.005, ES: 0.001, DE: 0.001, FR: 0.001 };

function formatPrice(krw: number, country: string): string {
    const rate = CURRENCY_RATES[country] || 1;
    const val = Math.round(krw * rate);
    if (["US"].includes(country)) return "$" + val.toLocaleString("en");
    if (["ES", "DE", "FR"].includes(country)) return "€" + val.toLocaleString("en");
    if (["JP", "CN"].includes(country)) return "¥" + val.toLocaleString("en");
    if (country === "AR") return val.toLocaleString("en") + "﷼";
    return val.toLocaleString("ko") + "원";
}

// ── 공장별 배송 요금표 (KRW 기준) ──
// 화성: 서울경기=용차3만+택배3천(허니콤무료배송), 지방=용차20만+택배3천, 제주=50만, 항공없음
// 도쿄: 도쿄=용차1만엔+택배기본(허니콤무료), 지방=항공+용차2~3만엔+택배
const FACTORY_RATES: Record<string, Record<string, Record<string, number | null>>> = {
    hwaseong: {
        general:   { local_truck: 30000, local_courier: 3000, domestic_truck: 200000, domestic_courier: 3000, jeju_truck: 500000 },
        honeycomb: { local_truck: 0,     local_courier: null, domestic_truck: 200000, domestic_courier: null, jeju_truck: 500000 },
        fabric:    { local_truck: 30000, local_courier: 3000, domestic_truck: 200000, domestic_courier: 3000, jeju_truck: 500000 },
        acrylic:   { local_truck: 30000, local_courier: 3000, domestic_truck: 200000, domestic_courier: 3000, jeju_truck: 500000 },
    },
    tokyo: {
        general:   { local_truck: 50000, local_courier: 5000, domestic_air: 80000, domestic_truck: 125000, domestic_courier: 7500 },
        honeycomb: { local_truck: 0,     local_courier: null, domestic_air: 1500000, domestic_truck: 150000, domestic_courier: null },
        fabric:    { local_truck: 50000, local_courier: 5000, domestic_air: 50000, domestic_truck: 125000, domestic_courier: 7500 },
        acrylic:   { local_truck: 50000, local_courier: 5000, domestic_air: 100000, domestic_truck: 125000, domestic_courier: 7500 },
    },
};
// ── 해외 배송 요금표 (항공~$600, 해상~$280) ──
const INTL_RATES: Record<string, Record<string, number | null>> = {
    general:   { air: 300000, sea: 140000, courier: 50000 },
    honeycomb: { air: 10000000, sea: 4000000, courier: null },
    fabric:    { air: 300000, sea: 140000, courier: 50000 },
    acrylic:   { air: 300000, sea: 140000, courier: 100000 },
};
const ETA: Record<string, string> = {
    local_truck: "1", local_courier: "1-2",
    domestic_air: "1-2", domestic_truck: "1-2", domestic_courier: "2-3",
    jeju_truck: "2-3", jeju_courier: "3-5",
    intl_air: "3-7", intl_sea: "14-30", intl_courier: "5-10",
};
const FREE_LABEL: Record<string, string> = { kr: "무료", ja: "無料", en: "FREE", zh: "免费", ar: "مجاني", es: "GRATIS", de: "KOSTENLOS", fr: "GRATUIT" };

// ── 허니콤보드 설치비 (기사 2명, 기본 100만원/한화 기준) ──
// 도쿄: 무료, 오사카: 20만엔, 미국: $1000 + 전시노조 별도, 기타: 100만원 환산
function getInstallationInfo(productType: string, nearestFactory: string, destCity: string, distKm: number, country: string, lang: string): string | null {
    if (productType !== "honeycomb") return null;

    const cityLower = destCity.toLowerCase();
    // 공장 근처 (< 100km) → 무료 설치 (화성·도쿄 모두)
    const isFactoryLocal = distKm < 100;
    // 오사카 판별
    const isOsaka = ["大阪", "osaka", "오사카"].some(k => cityLower.includes(k));
    // 미국 판별
    const isUS = ["US"].includes(country) || ["new york", "nyc", "los angeles", "la", "chicago", "las vegas", "san francisco", "miami", "houston", "seattle", "dallas", "boston", "뉴욕", "라스베가스"].some(k => cityLower.includes(k));

    const crew: Record<string, string> = {
        kr: "전문 기사 2명이 직접 방문 설치합니다.",
        ja: "専門スタッフ2名が直接訪問設置いたします。",
        en: "2 professional technicians will visit for installation.",
        zh: "2名专业技师上门安装。",
        ar: "فنيان محترفان سيقومان بالتركيب.",
        es: "2 técnicos profesionales realizarán la instalación.",
        de: "2 Fachtechniker kommen zur Installation.",
        fr: "2 techniciens professionnels viendront pour l'installation.",
    };

    const globalNote: Record<string, string> = {
        kr: "해외 모든 지역에 우리와 연결된 전문가가 있습니다. 친절하고 빠르게 시공해 드립니다.",
        ja: "世界各地に当社と連携した専門家がいます。丁寧かつ迅速に施工いたします。",
        en: "We have professional partners worldwide. They will provide friendly and prompt installation.",
        zh: "我们在全球各地都有合作专家，提供友好快速的安装服务。",
        ar: "لدينا شركاء محترفون حول العالم. سيقدمون خدمة تركيب ودية وسريعة.",
        es: "Tenemos socios profesionales en todo el mundo. Brindan instalación amable y rápida.",
        de: "Wir haben professionelle Partner weltweit. Freundliche und schnelle Installation.",
        fr: "Nous avons des partenaires professionnels dans le monde entier. Installation rapide et soignée.",
    };

    let costLine = "";
    if (isFactoryLocal) {
        const free: Record<string, string> = { kr: "설치비: 무료", ja: "設置費: 無料", en: "Installation: FREE", zh: "安装费: 免费", ar: "التركيب: مجاني", es: "Instalación: GRATIS", de: "Installation: KOSTENLOS", fr: "Installation: GRATUIT" };
        costLine = free[lang] || free["en"];
    } else if (isOsaka) {
        costLine = lang === "ja" ? "設置費: ¥200,000" : lang === "kr" ? "설치비: ¥200,000 (약 100만원)" : "Installation: ¥200,000";
    } else if (isUS) {
        const usNote: Record<string, string> = {
            kr: "설치비: $1,000 (전시노조 비용 별도)",
            ja: "設置費: $1,000 (展示組合費用別途)",
            en: "Installation: $1,000 (Union labor costs separate)",
            zh: "安装费: $1,000 (工会费用另计)",
            ar: "التركيب: 1,000$ (تكاليف النقابة منفصلة)",
            es: "Instalación: $1,000 (Costos sindicales aparte)",
            de: "Installation: $1,000 (Gewerkschaftskosten separat)",
            fr: "Installation: 1 000$ (Coûts syndicaux en sus)",
        };
        costLine = usNote[lang] || usNote["en"];
    } else {
        // 기타: 100만원 환산
        costLine = (lang === "kr" ? "설치비: " : "Installation: ") + formatPrice(1000000, country);
    }

    const c = crew[lang] || crew["en"];
    const g = (distKm > 100) ? " " + (globalNote[lang] || globalNote["en"]) : "";
    return `${c} ${costLine}${g}`;
}

// ── Helpers ──
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getZone(km: number): "local" | "domestic" | "intl" {
    if (km < 100) return "local";
    if (km < 1500) return "domestic";
    return "intl";
}

async function resolveCity(cityName: string): Promise<{ lat: number; lng: number } | null> {
    const key = cityName.toLowerCase().trim();
    if (CITY_COORDS[key]) return CITY_COORDS[key];
    for (const [k, v] of Object.entries(CITY_COORDS)) {
        if (k.includes(key) || key.includes(k)) return v;
    }
    if (!ANTHROPIC_API_KEY) return null;
    try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
            body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 50, messages: [{ role: "user", content: `What are the latitude and longitude of "${cityName}"? Reply ONLY with: lat,lng (numbers only, no text)` }] }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        const text = data.content?.[0]?.text?.trim() || "";
        const parts = text.split(",").map((s: string) => parseFloat(s.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return { lat: parts[0], lng: parts[1] };
    } catch (_) { /* ignore */ }
    return null;
}

// ── 추천 메시지 ──
function getRecommendation(zone: string, whName: string, productType: string, bestMethod: string, lang: string, factoryId: string): string {
    const isHoneycomb = productType === "honeycomb";
    if (zone === "local") {
        if (isHoneycomb) {
            const t: Record<string, string> = {
                kr: `가장 가까운 공장은 ${whName}에 있습니다. 화물차량 배송이 가장 적합합니다.`,
                ja: `最寄りの工場は${whName}にあります。トラック配送が最適です。`,
                en: `The nearest factory is at ${whName}. Truck delivery is the most suitable option.`,
                zh: `最近的工厂在${whName}。卡车配送是最合适的。`, ar: `أقرب مصنع في ${whName}. التوصيل بالشاحنة هو الأنسب.`,
                es: `La fábrica más cercana está en ${whName}. Envío por camión es la mejor opción.`,
                de: `Die nächste Fabrik ist in ${whName}. LKW-Lieferung ist am besten.`,
                fr: `L'usine la plus proche est à ${whName}. Livraison par camion recommandée.`,
            };
            return t[lang] || t["en"];
        } else {
            const t: Record<string, string> = {
                kr: `가장 가까운 공장은 ${whName}에 있습니다. 소형 제품이므로 택배가 가장 적합합니다.`,
                ja: `最寄りの工場は${whName}にあります。小型製品のため宅配便が最適です。`,
                en: `The nearest factory is at ${whName}. Courier delivery is the best option for this product.`,
                zh: `最近的工厂在${whName}。小型产品适合快递。`, ar: `أقرب مصنع في ${whName}. البريد السريع هو الأنسب.`,
                es: `La fábrica más cercana está en ${whName}. Mensajería es la mejor opción.`,
                de: `Die nächste Fabrik ist in ${whName}. Paketdienst ist am besten.`,
                fr: `L'usine la plus proche est à ${whName}. Colis express recommandé.`,
            };
            return t[lang] || t["en"];
        }
    } else if (zone === "domestic") {
        if (factoryId === "hwaseong") {
            const t: Record<string, string> = {
                kr: `가장 가까운 공장은 ${whName}에 있습니다. 용차 배송 및 택배 배송이 가능합니다.`,
                ja: `最寄りの工場は${whName}にあります。トラック配送と宅配便が利用可能です。`,
                en: `The nearest factory is at ${whName}. Truck and courier delivery are available.`,
                zh: `最近的工厂在${whName}。卡车和快递可选择。`, ar: `أقرب مصنع في ${whName}. الشاحنة والبريد متاحة.`,
                es: `La fábrica más cercana está en ${whName}. Camión y mensajería disponibles.`,
                de: `Die nächste Fabrik ist in ${whName}. LKW und Paket verfügbar.`,
                fr: `L'usine la plus proche est à ${whName}. Camion et colis disponibles.`,
            };
            return t[lang] || t["en"];
        }
        const t: Record<string, string> = {
            kr: `가장 가까운 공장은 ${whName}에 있습니다. 항공·트럭·택배 배송이 가능합니다.`,
            ja: `最寄りの工場は${whName}にあります。航空・トラック・宅配便が利用可能です。`,
            en: `The nearest factory is at ${whName}. Air, truck, and courier options are available.`,
            zh: `最近的工厂在${whName}。航空、卡车和快递均可选择。`, ar: `أقرب مصنع في ${whName}. الشحن الجوي والشاحنة والبريد متاحة.`,
            es: `La fábrica más cercana está en ${whName}. Aéreo, camión y mensajería disponibles.`,
            de: `Die nächste Fabrik ist in ${whName}. Luft, LKW und Paket verfügbar.`,
            fr: `L'usine la plus proche est à ${whName}. Aérien, camion et colis disponibles.`,
        };
        return t[lang] || t["en"];
    } else {
        const t: Record<string, string> = {
            kr: `한국 또는 일본 공장(${whName})에서 발송합니다. 항공배송·해상배송·항공택배가 가능합니다.`,
            ja: `韓国または日本の工場(${whName})から発送します。航空便・海上便・航空宅配便が利用可能です。`,
            en: `Shipped from our factory at ${whName}. Air freight, sea freight, and air courier are available.`,
            zh: `从${whName}工厂发货。航空、海运和航空快递均可选择。`, ar: `يتم الشحن من مصنع ${whName}. الشحن الجوي والبحري والبريد الجوي متاحة.`,
            es: `Enviado desde nuestra fábrica en ${whName}. Aéreo, marítimo y mensajería aérea disponibles.`,
            de: `Versand von unserer Fabrik in ${whName}. Luft, See und Luftpaket verfügbar.`,
            fr: `Expédié depuis notre usine à ${whName}. Aérien, maritime et colis aérien disponibles.`,
        };
        return t[lang] || t["en"];
    }
}

// ── Main Handler ──
serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const { country = "KR", city, product_type = "general", lang = "kr" } = await req.json();

        // 1. 도시 좌표
        const dest = await resolveCity(city);
        if (!dest) {
            return new Response(JSON.stringify({ error: true, message: "City not found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // 2. 가장 가까운 공장 (화성 or 도쿄)
        let nearest = FACTORIES[0];
        let minDist = haversine(dest.lat, dest.lng, FACTORIES[0].lat, FACTORIES[0].lng);
        for (let i = 1; i < FACTORIES.length; i++) {
            const d = haversine(dest.lat, dest.lng, FACTORIES[i].lat, FACTORIES[i].lng);
            if (d < minDist) { minDist = d; nearest = FACTORIES[i]; }
        }
        const distKm = Math.round(minDist);
        const zone = getZone(distKm);
        const whName = nearest.name[lang] || nearest.name.en;

        // 3. 배송 옵션 (공장별·존별)
        const factoryId = nearest.id;
        const fRates = (FACTORY_RATES[factoryId] || {})[product_type] || (FACTORY_RATES[factoryId] || {})["general"] || {};
        const iRates = INTL_RATES[product_type] || INTL_RATES["general"];
        const dLabel = DAYS_LABEL[lang] || " days";
        const options: any[] = [];
        const cityLower = city.toLowerCase().trim();
        const isJeju = ["제주", "jeju"].some(k => cityLower.includes(k));
        const honeycombNA = { kr: "허니콤보드는 택배 불가", ja: "ハニカムボードは宅配不可", en: "Honeycomb: courier unavailable", zh: "蜂窝板无法快递" };

        function priceStr(krw: number): string {
            if (krw === 0) return FREE_LABEL[lang] || "FREE";
            return "~" + formatPrice(krw, country);
        }
        function addUnavailableCourier() {
            if (product_type === "honeycomb") options.push({ method: "courier", label: LABELS.courier[lang] || LABELS.courier.en, price: "-", eta: "-", unavailable: true, reason: honeycombNA[lang] || "Courier unavailable" });
        }

        if (zone === "local") {
            // 근거리 (서울경기 / 도쿄): 트럭 + 택배
            const truckP = fRates["local_truck"];
            if (truckP != null) options.push({ method: "truck", label: LABELS.truck[lang] || LABELS.truck.en, price: priceStr(truckP), eta: ETA.local_truck + dLabel });
            const courierP = fRates["local_courier"];
            if (courierP != null) options.push({ method: "courier", label: LABELS.courier[lang] || LABELS.courier.en, price: priceStr(courierP), eta: ETA.local_courier + dLabel });
            else addUnavailableCourier();
        } else if (zone === "domestic") {
            if (isJeju && factoryId === "hwaseong") {
                // 제주 특별 요금
                const jejuP = fRates["jeju_truck"];
                if (jejuP != null) options.push({ method: "truck", label: LABELS.truck[lang] || LABELS.truck.en, price: priceStr(jejuP), eta: ETA.jeju_truck + dLabel });
                const courierP = fRates["domestic_courier"];
                if (courierP != null) options.push({ method: "courier", label: LABELS.courier[lang] || LABELS.courier.en, price: priceStr(courierP), eta: ETA.jeju_courier + dLabel });
                else addUnavailableCourier();
            } else {
                // 국내 원거리 (한국=트럭+택배만, 일본=항공+트럭+택배)
                const airP = fRates["domestic_air"];
                if (airP != null) options.push({ method: "air", label: LABELS.air[lang] || LABELS.air.en, price: priceStr(airP), eta: ETA.domestic_air + dLabel });
                const truckP = fRates["domestic_truck"];
                if (truckP != null) options.push({ method: "truck", label: LABELS.truck[lang] || LABELS.truck.en, price: priceStr(truckP), eta: ETA.domestic_truck + dLabel });
                const courierP = fRates["domestic_courier"];
                if (courierP != null) options.push({ method: "courier", label: LABELS.courier[lang] || LABELS.courier.en, price: priceStr(courierP), eta: ETA.domestic_courier + dLabel });
                else addUnavailableCourier();
            }
        } else {
            // 해외: 항공($600) + 해상($280) + 항공택배
            const airP = iRates["air"];
            if (airP != null) options.push({ method: "air", label: LABELS.air[lang] || LABELS.air.en, price: "~" + formatPrice(airP, country), eta: ETA.intl_air + dLabel });
            const seaP = iRates["sea"];
            if (seaP != null) options.push({ method: "sea", label: LABELS.sea[lang] || LABELS.sea.en, price: "~" + formatPrice(seaP, country), eta: ETA.intl_sea + dLabel });
            const courierP = iRates["courier"];
            if (courierP != null) options.push({ method: "courier", label: LABELS.courier[lang] || LABELS.courier.en, price: "~" + formatPrice(courierP, country), eta: ETA.intl_courier + dLabel });
            else addUnavailableCourier();
        }

        // 4. BEST 표시 (첫번째 이용가능 옵션)
        const avail = options.filter(o => !o.unavailable);
        if (avail.length > 0) avail[0].recommended = true;

        // 5. 설치 정보 (허니콤보드)
        const installation = getInstallationInfo(product_type, nearest.id, city, distKm, country, lang);

        // 6. 추천 문구
        const bestMethod = avail.length > 0 ? avail[0].method : "truck";
        const recommendation = getRecommendation(zone, whName, product_type, bestMethod, lang, factoryId);

        return new Response(JSON.stringify({
            warehouse: whName,
            distance_km: distKm,
            zone,
            options,
            installation,
            recommendation,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (e) {
        console.error("shipping-calc error:", e);
        return new Response(JSON.stringify({ error: true, message: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
});

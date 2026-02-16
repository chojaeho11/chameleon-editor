// supabase/functions/shipping-calc/index.ts
// 배포: supabase functions deploy shipping-calc
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── 창고 좌표 ──
const WAREHOUSES: Record<string, { city: string; lat: number; lng: number; name: Record<string, string> }[]> = {
    KR: [{ city: "Hwaseong", lat: 37.20, lng: 126.83, name: { kr: "화성시 공장", ja: "華城市工場", en: "Hwaseong Factory" } }],
    JP: [
        { city: "Tokyo", lat: 35.68, lng: 139.65, name: { kr: "도쿄 물류센터", ja: "東京倉庫", en: "Tokyo Warehouse" } },
        { city: "Osaka", lat: 34.69, lng: 135.50, name: { kr: "오사카 물류센터", ja: "大阪倉庫", en: "Osaka Warehouse" } },
    ],
    US: [{ city: "Las Vegas", lat: 36.17, lng: -115.14, name: { kr: "라스베가스 물류센터", ja: "ラスベガス倉庫", en: "Las Vegas Warehouse" } }],
    CN: [{ city: "Shanghai", lat: 31.23, lng: 121.47, name: { kr: "상하이 물류센터", zh: "上海仓库", en: "Shanghai Warehouse" } }],
    AR: [{ city: "Riyadh", lat: 24.71, lng: 46.68, name: { kr: "리야드 물류센터", ar: "مستودع الرياض", en: "Riyadh Warehouse" } }],
    ES: [{ city: "Madrid", lat: 40.42, lng: -3.70, name: { kr: "마드리드 물류센터", es: "Almacén Madrid", en: "Madrid Warehouse" } }],
    DE: [{ city: "Berlin", lat: 52.52, lng: 13.41, name: { kr: "베를린 물류센터", de: "Lager Berlin", en: "Berlin Warehouse" } }],
    FR: [{ city: "Paris", lat: 48.86, lng: 2.35, name: { kr: "파리 물류센터", fr: "Entrepôt Paris", en: "Paris Warehouse" } }],
};

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
    "東京": { lat: 35.68, lng: 139.65 }, "tokyo": { lat: 35.68, lng: 139.65 },
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
    "new york": { lat: 40.71, lng: -74.01 }, "nyc": { lat: 40.71, lng: -74.01 },
    "los angeles": { lat: 34.05, lng: -118.24 }, "la": { lat: 34.05, lng: -118.24 },
    "chicago": { lat: 41.88, lng: -87.63 },
    "las vegas": { lat: 36.17, lng: -115.14 },
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
    // Europe
    "madrid": { lat: 40.42, lng: -3.70 }, "barcelona": { lat: 41.39, lng: 2.17 },
    "berlin": { lat: 52.52, lng: 13.41 }, "münchen": { lat: 48.14, lng: 11.58 }, "munich": { lat: 48.14, lng: 11.58 },
    "hamburg": { lat: 53.55, lng: 9.99 }, "frankfurt": { lat: 50.11, lng: 8.68 },
    "paris": { lat: 48.86, lng: 2.35 }, "lyon": { lat: 45.76, lng: 4.84 }, "marseille": { lat: 43.30, lng: 5.37 },
    "london": { lat: 51.51, lng: -0.13 },
    // Middle East
    "riyadh": { lat: 24.71, lng: 46.68 }, "الرياض": { lat: 24.71, lng: 46.68 },
    "jeddah": { lat: 21.49, lng: 39.19 }, "جدة": { lat: 21.49, lng: 39.19 },
    "dubai": { lat: 25.20, lng: 55.27 }, "دبي": { lat: 25.20, lng: 55.27 },
};

// ── 배송 요금표 (KRW 기준) ──
const RATES = {
    air:     { local: { base: 15000, perKg: 5000, eta: "1-2" }, regional: { base: 25000, perKg: 7000, eta: "1-2" }, domestic: { base: 40000, perKg: 9000, eta: "2-3" }, intl: { base: 80000, perKg: 15000, eta: "3-5" } },
    sea:     { local: null, regional: null, domestic: { base: 15000, perKg: 1500, eta: "5-7" }, intl: { base: 30000, perKg: 3000, eta: "14-21" } },
    truck:   { local: { base: 15000, perKm: 200, eta: "0-1" }, regional: { base: 25000, perKm: 250, eta: "1-2" }, domestic: { base: 40000, perKm: 300, eta: "2-3" }, intl: null },
    courier: { local: { base: 3000, perKg: 500, eta: "1-2" }, regional: { base: 5000, perKg: 700, eta: "2-3" }, domestic: { base: 8000, perKg: 1000, eta: "3-5" }, intl: { base: 25000, perKg: 5000, eta: "5-10" } },
};

const LABELS: Record<string, Record<string, string>> = {
    air:     { kr: "항공 배송", ja: "航空配送", en: "Air Freight", zh: "航空运输", ar: "الشحن الجوي", es: "Envío aéreo", de: "Luftfracht", fr: "Fret aérien" },
    sea:     { kr: "해상 배송", ja: "海上配送", en: "Sea Freight", zh: "海运", ar: "الشحن البحري", es: "Envío marítimo", de: "Seefracht", fr: "Fret maritime" },
    truck:   { kr: "트럭 배송", ja: "トラック配送", en: "Truck Delivery", zh: "卡车运输", ar: "التوصيل بالشاحنة", es: "Envío por camión", de: "LKW-Lieferung", fr: "Livraison par camion" },
    courier: { kr: "택배", ja: "宅配便", en: "Courier / Parcel", zh: "快递", ar: "البريد السريع", es: "Mensajería", de: "Paketdienst", fr: "Colis express" },
};

const DAYS_LABEL: Record<string, string> = { kr: "일", ja: "日", en: "days", zh: "天", ar: "أيام", es: "días", de: "Tage", fr: "jours" };
const NA_LABEL: Record<string, string> = { kr: "이용 불가", ja: "利用不可", en: "N/A", zh: "不可用", ar: "غير متاح", es: "No disponible", de: "Nicht verfügbar", fr: "Non disponible" };
const NA_REASON: Record<string, Record<string, string>> = {
    sea_short: { kr: "근거리는 해상운송 불가", ja: "近距離は海上輸送不可", en: "Sea freight unavailable for short distances", zh: "近距离不提供海运", ar: "غير متاح للمسافات القصيرة", es: "No disponible para distancias cortas", de: "Nicht für Kurzstrecken", fr: "Non disponible pour courtes distances" },
    truck_intl: { kr: "국제 트럭배송 불가", ja: "国際トラック配送不可", en: "Truck delivery unavailable internationally", zh: "不提供国际卡车运输", ar: "غير متاح دوليًا", es: "No disponible internacionalmente", de: "International nicht verfügbar", fr: "Non disponible à l'international" },
    honeycomb_courier: { kr: "허니콤보드 제품은 택배 발송이 불가합니다", ja: "ハニカムボード製品は宅配便での発送ができません", en: "Honeycomb board products cannot be shipped via courier", zh: "蜂窝板产品无法通过快递发送", ar: "لا يمكن شحن ألواح خلية النحل عبر البريد السريع", es: "Los paneles de nido de abeja no se pueden enviar por mensajería", de: "Wabenplatten können nicht per Paketdienst versendet werden", fr: "Les panneaux nid d'abeille ne peuvent pas être expédiés par colis" },
};

const CURRENCY_RATES: Record<string, number> = { KR: 1, JP: 0.2, US: 0.002, CN: 0.01, AR: 0.005, ES: 0.001, DE: 0.001, FR: 0.001 };
const CURRENCY_UNITS: Record<string, string> = { KR: "원", JP: "¥", US: "$", CN: "¥", AR: "﷼", ES: "€", DE: "€", FR: "€" };

// ── Helpers ──
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getZone(km: number): string {
    if (km <= 50) return "local";
    if (km <= 300) return "regional";
    if (km <= 1000) return "domestic";
    return "intl";
}

function formatPrice(krw: number, country: string): string {
    const rate = CURRENCY_RATES[country] || 1;
    const unit = CURRENCY_UNITS[country] || "원";
    const val = Math.round(krw * rate);
    if (["US"].includes(country)) return "$" + val.toLocaleString("en");
    if (["ES", "DE", "FR"].includes(country)) return "€" + val.toLocaleString("en");
    if (["JP", "CN"].includes(country)) return "¥" + val.toLocaleString("en");
    if (country === "AR") return val.toLocaleString("en") + "﷼";
    return val.toLocaleString("ko") + unit;
}

function calcInstallation(productType: string, wMm: number, hMm: number, lang: string): string | null {
    if (productType !== "honeycomb") return null;
    const area = (wMm / 1000) * (hMm / 1000);
    // 허니콤보드는 항상 2명 필요
    const msgs: Record<string, string> = {
        kr: `설치 인원: 2명 필요 (면적 ${area.toFixed(1)}㎡)`,
        ja: `設置人数: 2名必要 (面積 ${area.toFixed(1)}㎡)`,
        en: `Installation: 2 people required (${area.toFixed(1)}㎡)`,
        zh: `安装人员: 需要2人 (${area.toFixed(1)}㎡)`,
        ar: `التركيب: يلزم شخصان (${area.toFixed(1)}㎡)`,
        es: `Instalación: 2 personas necesarias (${area.toFixed(1)}㎡)`,
        de: `Installation: 2 Personen erforderlich (${area.toFixed(1)}㎡)`,
        fr: `Installation: 2 personnes requises (${area.toFixed(1)}㎡)`,
    };
    return msgs[lang] || msgs["en"];
}

async function resolveCity(cityName: string): Promise<{ lat: number; lng: number } | null> {
    const key = cityName.toLowerCase().trim();
    if (CITY_COORDS[key]) return CITY_COORDS[key];
    // 부분 매칭
    for (const [k, v] of Object.entries(CITY_COORDS)) {
        if (k.includes(key) || key.includes(k)) return v;
    }
    // Claude Haiku fallback
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

function getSmartRecommendation(options: any[], productType: string, distKm: number, whName: string, lang: string): string {
    // 이용 가능한 옵션 중 최저가 찾기
    const available = options.filter(o => !o.unavailable);
    if (available.length === 0) return "";

    const cheapest = available.reduce((a, b) => a.priceKrw < b.priceKrw ? a : b);
    const isLarge = productType === "honeycomb" || productType === "acrylic";
    const isSmall = !isLarge;

    // 가까운 거리(트럭 추천) vs 먼 거리(항공/해운 추천) vs 소형(택배 추천)
    let bestMethod = cheapest.method;
    if (isLarge && available.find(o => o.method === "truck")) bestMethod = "truck";
    else if (isSmall && available.find(o => o.method === "courier")) bestMethod = "courier";

    const bestOpt = available.find(o => o.method === bestMethod) || cheapest;

    const templates: Record<string, Record<string, string>> = {
        truck: {
            kr: `고객님 위치에서 가장 가까운 공장은 ${whName}에 있으며, 화물차량 배송이 가장 적합합니다.`,
            ja: `お客様の最寄り工場は${whName}にあり、トラック配送が最適です。`,
            en: `The nearest factory to your location is at ${whName}. Truck delivery is the most suitable option.`,
            zh: `距您最近的工厂位于${whName}，卡车配送是最合适的选择。`,
            ar: `أقرب مصنع إلى موقعك في ${whName}. التوصيل بالشاحنة هو الخيار الأنسب.`,
            es: `La fábrica más cercana a su ubicación está en ${whName}. El envío por camión es la opción más adecuada.`,
            de: `Die nächste Fabrik befindet sich in ${whName}. LKW-Lieferung ist die geeignetste Option.`,
            fr: `L'usine la plus proche se trouve à ${whName}. La livraison par camion est l'option la plus adaptée.`,
        },
        courier: {
            kr: `고객님 위치에서 가장 가까운 공장은 ${whName}에 있으며, 소형 제품이므로 택배가 가장 적합합니다.`,
            ja: `お客様の最寄り工場は${whName}にあり、小型製品のため宅配便が最適です。`,
            en: `The nearest factory is at ${whName}. As a smaller product, courier/parcel delivery is the best option.`,
            zh: `最近的工厂位于${whName}。作为小型产品，快递是最佳选择。`,
            ar: `أقرب مصنع في ${whName}. بما أن المنتج صغير، البريد السريع هو الخيار الأفضل.`,
            es: `La fábrica más cercana está en ${whName}. Al ser un producto pequeño, la mensajería es la mejor opción.`,
            de: `Die nächste Fabrik ist in ${whName}. Als kleineres Produkt ist der Paketdienst die beste Option.`,
            fr: `L'usine la plus proche est à ${whName}. Pour un petit produit, le colis express est la meilleure option.`,
        },
        air: {
            kr: `고객님 위치에서 가장 가까운 공장은 ${whName}에 있습니다. 빠른 배송을 원하시면 항공 배송을 추천드립니다.`,
            ja: `お客様の最寄り工場は${whName}にあります。お急ぎの場合は航空配送をおすすめします。`,
            en: `The nearest factory is at ${whName}. For faster delivery, we recommend air freight.`,
            zh: `最近的工厂位于${whName}。如需快速配送，推荐航空运输。`,
            ar: `أقرب مصنع في ${whName}. للتسليم الأسرع، نوصي بالشحن الجوي.`,
            es: `La fábrica más cercana está en ${whName}. Para entrega rápida, recomendamos el envío aéreo.`,
            de: `Die nächste Fabrik ist in ${whName}. Für schnelle Lieferung empfehlen wir Luftfracht.`,
            fr: `L'usine la plus proche est à ${whName}. Pour une livraison rapide, nous recommandons le fret aérien.`,
        },
        sea: {
            kr: `고객님 위치에서 가장 가까운 공장은 ${whName}에 있습니다. 비용 절감을 원하시면 해상 배송을 추천드립니다.`,
            ja: `お客様の最寄り工場は${whName}にあります。コスト重視なら海上配送がおすすめです。`,
            en: `The nearest factory is at ${whName}. For cost savings, we recommend sea freight.`,
            zh: `最近的工厂位于${whName}。如需节省费用，推荐海运。`,
            ar: `أقرب مصنع في ${whName}. لتوفير التكاليف، نوصي بالشحن البحري.`,
            es: `La fábrica más cercana está en ${whName}. Para ahorrar costos, recomendamos el envío marítimo.`,
            de: `Die nächste Fabrik ist in ${whName}. Zur Kosteneinsparung empfehlen wir Seefracht.`,
            fr: `L'usine la plus proche est à ${whName}. Pour économiser, nous recommandons le fret maritime.`,
        },
    };

    const tpl = templates[bestMethod] || templates["truck"];
    return tpl[lang] || tpl["en"];
}

// ── Main Handler ──
serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const { country = "KR", city, width_mm = 0, height_mm = 0, depth_mm = 10, product_type = "general", lang = "kr" } = await req.json();

        // 1. 도시 좌표 찾기
        const dest = await resolveCity(city);
        if (!dest) {
            return new Response(JSON.stringify({ error: true, message: "City not found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // 2. 가장 가까운 창고 찾기 (모든 나라 창고 대상)
        let nearestWh: any = null;
        let minDist = Infinity;
        for (const [, whs] of Object.entries(WAREHOUSES)) {
            for (const wh of whs) {
                const d = haversine(dest.lat, dest.lng, wh.lat, wh.lng);
                if (d < minDist) { minDist = d; nearestWh = wh; }
            }
        }
        const distKm = Math.round(minDist);
        const zone = getZone(distKm);
        const whName = nearestWh?.name?.[lang] || nearestWh?.name?.en || nearestWh?.city || "Warehouse";

        // 3. 체적/중량 계산
        const volWeight_air = (width_mm / 10) * (height_mm / 10) * (depth_mm / 10) / 5000; // kg
        const volWeight_sea = (width_mm / 10) * (height_mm / 10) * (depth_mm / 10) / 6000;
        const actualWeight = (width_mm / 10) * (height_mm / 10) * (depth_mm / 10) * 0.0003; // 대략 밀도

        // 4. 4가지 옵션 계산
        const options: any[] = [];
        const dLabel = DAYS_LABEL[lang] || "days";

        // 항공
        const airRate = (RATES.air as any)[zone];
        if (airRate) {
            const price = airRate.base + Math.max(volWeight_air, 1) * airRate.perKg;
            options.push({ method: "air", label: LABELS.air[lang] || LABELS.air.en, price: formatPrice(price, country), priceKrw: price, eta: `${airRate.eta}${dLabel}`, recommended: false });
        }

        // 해상
        const seaRate = (RATES.sea as any)[zone];
        if (seaRate) {
            const price = seaRate.base + Math.max(volWeight_sea, 1) * seaRate.perKg;
            options.push({ method: "sea", label: LABELS.sea[lang] || LABELS.sea.en, price: formatPrice(price, country), priceKrw: price, eta: `${seaRate.eta}${dLabel}`, recommended: false });
        } else {
            options.push({ method: "sea", label: LABELS.sea[lang] || LABELS.sea.en, price: NA_LABEL[lang] || "N/A", priceKrw: 0, eta: "-", unavailable: true, reason: NA_REASON.sea_short[lang] || NA_REASON.sea_short.en });
        }

        // 트럭
        const truckRate = (RATES.truck as any)[zone];
        if (truckRate) {
            const price = truckRate.base + distKm * truckRate.perKm;
            options.push({ method: "truck", label: LABELS.truck[lang] || LABELS.truck.en, price: formatPrice(price, country), priceKrw: price, eta: `${truckRate.eta}${dLabel}`, recommended: false });
        } else {
            options.push({ method: "truck", label: LABELS.truck[lang] || LABELS.truck.en, price: NA_LABEL[lang] || "N/A", priceKrw: 0, eta: "-", unavailable: true, reason: NA_REASON.truck_intl[lang] || NA_REASON.truck_intl.en });
        }

        // 택배 (허니콤보드는 택배 불가)
        if (product_type === "honeycomb") {
            options.push({ method: "courier", label: LABELS.courier[lang] || LABELS.courier.en, price: NA_LABEL[lang] || "N/A", priceKrw: 0, eta: "-", unavailable: true, reason: NA_REASON.honeycomb_courier[lang] || NA_REASON.honeycomb_courier.en });
        } else {
            const courierRate = (RATES.courier as any)[zone];
            if (courierRate) {
                const weight = Math.max(volWeight_air, actualWeight, 1);
                const price = courierRate.base + weight * courierRate.perKg;
                options.push({ method: "courier", label: LABELS.courier[lang] || LABELS.courier.en, price: formatPrice(price, country), priceKrw: price, eta: `${courierRate.eta}${dLabel}`, recommended: false });
            }
        }

        // 5. BEST 마크 (가장 저렴한 이용 가능 옵션)
        const available = options.filter(o => !o.unavailable);
        if (available.length > 0) {
            const cheapest = available.reduce((a, b) => a.priceKrw < b.priceKrw ? a : b);
            cheapest.recommended = true;
        }

        // 6. 설치 인원
        const installation = calcInstallation(product_type, width_mm, height_mm, lang);

        // 7. 스마트 추천 (가장 가까운 공장 + 최적 배송)
        const recommendation = getSmartRecommendation(options, product_type, distKm, whName, lang);

        return new Response(JSON.stringify({
            warehouse: whName,
            distance_km: distKm,
            zone,
            options: options.map(({ priceKrw, ...rest }) => rest),
            installation,
            recommendation,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (e) {
        console.error("shipping-calc error:", e);
        return new Response(JSON.stringify({ error: true, message: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
});

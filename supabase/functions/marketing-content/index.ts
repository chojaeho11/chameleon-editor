import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
        if (!ANTHROPIC_API_KEY) {
            return new Response(
                JSON.stringify({ error: "API key not configured" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const body = await req.json();
        const { platform, topic, tone, lang, instructions, coreKeywords, usp, ctaMsg, imageBase64 } = body;

        if (!platform || !topic) {
            return new Response(
                JSON.stringify({ error: "platform and topic are required" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 플랫폼별 프롬프트 구성
        const platformPrompts: Record<string, string> = {
            youtube_shorts: `YouTube Shorts 대본을 작성하세요.
- 60초 이내에 읽을 수 있는 분량
- 첫 3초에 시선을 사로잡는 훅(hook) 문장으로 시작
- 중간에 핵심 정보/팁 전달
- 마지막에 CTA (구독, 좋아요, 링크 클릭 유도)
- 자막 형식으로 작성 (짧은 문장, 줄바꿈)
- BGM/효과음 지시 포함 [BGM: 밝은 분위기] 형식

JSON 출력 형식:
{
  "title": "영상 제목 (50자 이내, SEO 최적화)",
  "short_script": "60초 대본 전체",
  "body": "영상 설명란에 들어갈 텍스트",
  "hashtags": ["해시태그1", "해시태그2", ...최대 15개],
  "thumbnail_prompt": "썸네일 이미지 생성용 영어 프롬프트 (DALL-E/Midjourney 스타일)"
}`,

            blog: `SEO 최적화된 블로그 포스트를 작성하세요.

## SEO 핵심 규칙
- 제목: 해당 언어의 검색 사용자가 실제로 검색할 키워드를 포함한 매력적인 제목 (50-60자)
- meta_description: 검색 결과에 표시될 설명 (120-155자, 핵심 키워드 포함, 클릭 유도)
- 본문: 1000-1500자, 소제목(H2) 3-5개로 구조화
- 첫 문단 100자 안에 핵심 키워드 자연스럽게 포함
- 각 소제목(H2)에도 관련 키워드 포함
- 내부 링크: 본문에 자연스럽게 웹사이트 링크 1-2회 포함
- 실용적인 팁, 사례, 구체적 수치 등 고품질 정보 제공
- 마지막에 CTA 포함
- HTML 태그 사용하지 않고 마크다운 형식

## 언어별 SEO 전략
- 한국어: 네이버/구글 한국 검색에 최적화, 자연스러운 한국어 표현
- 日本語: Google Japan 검색에 최적화, 일본 시장 관점의 키워드와 표현
- English: Google US/Global 검색에 최적화, 영어권 검색 트렌드 반영

## focus_keyword 규칙
- 해당 언어로 사용자가 가장 많이 검색하는 핵심 키워드 1개 (2-4단어)
- 예: "허니콤보드 인쇄", "ハニカムボード 印刷", "honeycomb board printing"

JSON 출력 형식:
{
  "title": "블로그 제목 (SEO 최적화)",
  "meta_description": "검색 결과 설명 (120-155자)",
  "focus_keyword": "핵심 검색 키워드",
  "body": "본문 전체 (마크다운)",
  "hashtags": ["키워드1", "키워드2", ...최대 10개],
  "thumbnail_prompt": "대표 이미지 생성용 영어 프롬프트"
}`,

            instagram: `Instagram 게시물을 작성하세요.
- 캡션: 첫 줄에 후킹 문구
- 이모지 적절히 사용
- 150-300자 캡션
- 해시태그 20-30개 (관련성 높은 것)
- 슬라이드(캐러셀) 구성 제안 포함

JSON 출력 형식:
{
  "title": "게시물 핵심 메시지 (한 줄)",
  "body": "Instagram 캡션 전체",
  "hashtags": ["해시태그1", ...최대 30개],
  "thumbnail_prompt": "게시물 이미지 생성용 영어 프롬프트"
}`,

            tiktok: `TikTok 숏폼 영상 대본을 작성하세요.
- 15-60초 대본
- 첫 1초에 강렬한 훅
- 트렌디한 표현과 톤
- 음악 추천 포함
- 촬영 앵글/편집 지시 포함

JSON 출력 형식:
{
  "title": "영상 제목",
  "short_script": "대본 전체",
  "body": "영상 설명",
  "hashtags": ["해시태그1", ...최대 10개],
  "thumbnail_prompt": "썸네일 이미지 생성용 영어 프롬프트"
}`,

            youtube_shorts_from_image: `제공된 이미지를 분석하여 "꿀팁! 반값 제작" 스타일의 YouTube Shorts 빠른 설명 나레이션을 생성하세요.

★ 핵심 콘셉트: 빨리 읽는 말투로 빠르게 설명하는 꿀팁 쇼츠
- "OOO 반값으로 제작하기 꿀팁!" 형식의 후킹
- 왜 카멜레온프린팅에서 제작하면 반값인지 구체적 이유 설명
- 에디터로 쉽게 디자인하고, 빠르게 주문하는 과정 설명
- 빠르고 자신감 있는 말투 (예: "~거든요", "~잖아요", "진짜 대박인게", "이거 꼭 알아두세요")

이미지를 분석하여 해당 상품/서비스에 맞는 나레이션 스크립트를 작성하세요.

JSON 출력 형식:
{
  "title": "영상 제목 (60자 이내, SEO 최적화, 예: 'OOO 반값으로 제작하는 방법 🔥 #꿀팁')",
  "body": "YouTube 설명란 텍스트 (200-500자, 키워드 포함)",
  "hashtags": ["Shorts", "꿀팁", "반값제작", ...최대 15개],
  "narration": [
    "첫번째 나레이션 문장 (후킹 - 3초, 예: 'OOO 아직도 비싸게 만드세요? 반값에 제작하는 꿀팁 알려드릴게요!')",
    "두번째 나레이션 문장 (이유1 - 4초, 예: '카멜레온프린팅은 자체 공장 직영이라 중간 마진이 없거든요')",
    "세번째 나레이션 문장 (이유2 - 4초, 예: '게다가 무료 온라인 에디터로 직접 디자인하면 디자인비도 제로!')",
    "네번째 나레이션 문장 (쉬운과정 - 4초, 예: '에디터에서 템플릿 골라서 수정하고 바로 주문 끝!')",
    "다섯번째 나레이션 문장 (CTA - 3초, 예: '링크 타고 지금 바로 무료로 디자인해보세요!')"
  ],
  "overlay_texts": {
    "hook": "후킹 자막 (나레이션 1번과 매칭, 15자 이내 핵심만)",
    "main": "핵심 포인트 자막 (나레이션 2-3번 요약, 20자 이내)",
    "detail": "쉬운 과정 자막 (나레이션 4번 요약, 20자 이내)",
    "cta": "CTA 자막 (나레이션 5번 요약, 15자 이내)"
  },
  "video_style": {
    "mood": "energetic",
    "zoom_direction": "in 또는 out 또는 left_to_right 또는 right_to_left 중 하나",
    "color_accent": "#hex 이미지 분위기에 맞는 강조 색상"
  }
}`,

            website: `자사 웹사이트에 게시할 콘텐츠를 작성하세요.
- 상품/서비스 홍보 + 정보 제공의 균형
- 고객이 실제로 관심가질 실용적 정보
- 전문적이면서 친근한 톤
- 500-800자
- 이미지 설명 포함

JSON 출력 형식:
{
  "title": "콘텐츠 제목",
  "body": "본문 전체",
  "hashtags": ["키워드1", ...최대 10개],
  "thumbnail_prompt": "대표 이미지 생성용 영어 프롬프트"
}`
        };

        const langMap: Record<string, string> = {
            kr: "한국어",
            ja: "日本語 (일본어)",
            en: "English"
        };

        const domainMap: Record<string, string> = {
            kr: "www.cafe2626.com",
            ja: "www.cafe0101.com",
            en: "www.cafe3355.com"
        };

        const toneMap: Record<string, string> = {
            professional: "전문적이고 신뢰감 있는 톤",
            casual: "캐주얼하고 친근한 톤",
            energetic: "에너지 넘치고 열정적인 톤",
            educational: "교육적이고 정보 제공적인 톤",
            storytelling: "스토리텔링 방식의 서사적 톤"
        };

        const systemPrompt = `당신은 전문 디지털 마케팅 콘텐츠 크리에이터입니다.

## 브랜드 정보
- 브랜드: 카멜레온프린팅 (Chameleon Printing)
- 사업: 친환경 종이 허니컴보드, 패브릭 인쇄, 포토존, 등신대, 배너, PVC/폼보드, 디스플레이 전문 인쇄 업체
- 웹사이트: ${domainMap[lang] || 'www.cafe2626.com'} (이 언어의 대상 웹사이트)
- 전체 도메인: cafe2626.com (한국), cafe0101.com (일본), cafe3355.com (미국)
- 특징: 무료 온라인 디자인 에디터, 전국 당일배송, 친환경 소재
- 중요: 콘텐츠 내 웹사이트 링크는 반드시 ${domainMap[lang] || 'www.cafe2626.com'} 을 사용하세요
${coreKeywords ? `- 핵심 키워드: ${coreKeywords}` : ''}
${usp ? `- 핵심 강점: ${usp}` : ''}
${ctaMsg ? `- CTA: ${ctaMsg}` : ''}

## 작성 규칙
- 언어: ${langMap[lang] || '한국어'}
- 톤: ${toneMap[tone] || '전문적'}
- 반드시 유효한 JSON만 출력하세요. 설명이나 마크다운 코드블록 없이 순수 JSON만 반환하세요.
${instructions ? `- 추가 지시: ${instructions}` : ''}

## 플랫폼별 작성 가이드
${platformPrompts[platform] || platformPrompts.blog}`;

        const userMessage = `주제: "${topic}"

위 가이드에 따라 콘텐츠를 생성하세요. 반드시 지정된 JSON 형식으로만 출력하세요.`;

        // 멀티모달 메시지 구성 (이미지가 있으면 Vision 모드)
        let userContent: any;
        if (imageBase64) {
            userContent = [
                {
                    type: "image",
                    source: {
                        type: "base64",
                        media_type: "image/jpeg",
                        data: imageBase64
                    }
                },
                { type: "text", text: userMessage }
            ];
        } else {
            userContent = userMessage;
        }

        // Claude API 호출
        const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
                model: "claude-sonnet-4-5-20250929",
                max_tokens: 4000,
                system: systemPrompt,
                messages: [{ role: "user", content: userContent }],
            }),
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error("Claude API Error:", res.status, errText);

            // Sonnet 실패 시 Haiku로 폴백
            if (res.status === 429 || res.status >= 500) {
                console.log("Sonnet failed, trying Haiku...");
                const fallbackRes = await fetch("https://api.anthropic.com/v1/messages", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-api-key": ANTHROPIC_API_KEY,
                        "anthropic-version": "2023-06-01",
                    },
                    body: JSON.stringify({
                        model: "claude-haiku-4-5-20251001",
                        max_tokens: 4000,
                        system: systemPrompt,
                        messages: [{ role: "user", content: userContent }],
                    }),
                });

                if (!fallbackRes.ok) {
                    return new Response(
                        JSON.stringify({ error: "AI API 오류: " + res.status }),
                        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                }

                const fallbackData = await fallbackRes.json();
                const fallbackText = fallbackData.content
                    .map((b: any) => (b.type === "text" ? b.text : ""))
                    .filter(Boolean)
                    .join("");

                const fallbackContent = parseJsonResponse(fallbackText);
                return new Response(
                    JSON.stringify({ content: fallbackContent }),
                    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            return new Response(
                JSON.stringify({ error: "AI API 오류: " + res.status }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const data = await res.json();
        const rawText = data.content
            .map((b: any) => (b.type === "text" ? b.text : ""))
            .filter(Boolean)
            .join("");

        const content = parseJsonResponse(rawText);

        return new Response(
            JSON.stringify({ content }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error: any) {
        console.error("Marketing Content Error:", error);
        return new Response(
            JSON.stringify({ error: String(error?.message || error) }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});

function parseJsonResponse(text: string): any {
    // JSON 블록 추출 시도
    let cleaned = text.trim();

    // ```json ... ``` 블록 제거
    const jsonBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonBlockMatch) {
        cleaned = jsonBlockMatch[1].trim();
    }

    try {
        return JSON.parse(cleaned);
    } catch (e) {
        // JSON 파싱 실패 시 텍스트 그대로 반환
        console.error("JSON parse failed:", e);
        return {
            title: "생성된 콘텐츠",
            body: text,
            hashtags: [],
            thumbnail_prompt: ""
        };
    }
}

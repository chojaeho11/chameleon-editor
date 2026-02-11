import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    try {
        const body = await req.json();
        const action = body.action;

        // YouTube 설정 가져오기
        const { data: config } = await sb.from("marketing_youtube_config").select("*").limit(1).single();
        if (!config) {
            return jsonRes({ error: "YouTube config not found" });
        }

        // 토큰 리프레시 필요 시
        let accessToken = config.access_token;
        if (config.token_expires_at && new Date(config.token_expires_at) < new Date()) {
            accessToken = await refreshToken(config, sb);
        }

        if (!accessToken) {
            return jsonRes({ error: "YouTube 인증이 필요합니다" });
        }

        // ===== 액션별 처리 =====
        if (action === "check_comments") {
            // 자사 채널의 최근 영상 댓글 확인 + 자동 답글
            return await handleCheckComments(config, accessToken, sb);
        }

        if (action === "get_videos") {
            // 자사 채널 영상 목록 가져오기
            return await handleGetVideos(config, accessToken);
        }

        if (action === "reply_comment") {
            // 수동 댓글 답글
            const { commentId, replyText, videoId } = body;
            return await handleReplyComment(accessToken, commentId, replyText, videoId, sb);
        }

        return jsonRes({ error: "Unknown action: " + action });

    } catch (error: any) {
        console.error("YouTube Auto Reply Error:", error);
        return jsonRes({ error: String(error?.message || error) });
    }
});

// 댓글 확인 및 자동 답글
async function handleCheckComments(config: any, accessToken: string, sb: any) {
    if (!config.auto_reply_enabled) {
        return jsonRes({ message: "Auto reply is disabled", replies: [] });
    }

    const channelId = config.channel_id;
    if (!channelId) {
        return jsonRes({ error: "Channel ID not configured" });
    }

    // 1. 자사 채널의 최근 영상 가져오기
    const videosRes = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&maxResults=10&type=video`,
        { headers: { Authorization: "Bearer " + accessToken } }
    );
    const videosData = await videosRes.json();
    if (!videosData.items) {
        return jsonRes({ error: "Failed to fetch videos", detail: videosData });
    }

    const videoIds = videosData.items.map((v: any) => v.id.videoId).filter(Boolean);
    if (videoIds.length === 0) {
        return jsonRes({ message: "No videos found", replies: [] });
    }

    // 2. 각 영상의 댓글 가져오기
    const replies: any[] = [];
    const template = config.auto_reply_template || "감사합니다! 😊";

    for (const videoId of videoIds) {
        try {
            const commentsRes = await fetch(
                `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&maxResults=20&order=time`,
                { headers: { Authorization: "Bearer " + accessToken } }
            );
            const commentsData = await commentsRes.json();

            if (!commentsData.items) continue;

            for (const thread of commentsData.items) {
                const comment = thread.snippet.topLevelComment;
                const commentId = comment.id;
                const commentText = comment.snippet.textDisplay;
                const authorName = comment.snippet.authorDisplayName;
                const videoTitle = thread.snippet.videoId;

                // 이미 답글한 댓글인지 확인
                const { data: existing } = await sb.from("marketing_comment_replies")
                    .select("id")
                    .eq("comment_id", commentId)
                    .limit(1)
                    .single();

                if (existing) continue;

                // 자사 채널 댓글인지 확인 (자기 댓글에는 답글 안 함)
                if (comment.snippet.authorChannelId?.value === channelId) continue;

                // 답글 텍스트 생성
                const replyText = template
                    .replace(/{commenter}/g, authorName)
                    .replace(/{video_title}/g, videoTitle);

                // YouTube API로 답글 게시
                const replyRes = await fetch(
                    "https://www.googleapis.com/youtube/v3/comments?part=snippet",
                    {
                        method: "POST",
                        headers: {
                            Authorization: "Bearer " + accessToken,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            snippet: {
                                parentId: commentId,
                                textOriginal: replyText,
                            },
                        }),
                    }
                );

                if (replyRes.ok) {
                    // DB에 기록
                    await sb.from("marketing_comment_replies").insert({
                        video_id: videoId,
                        comment_id: commentId,
                        comment_text: commentText.substring(0, 500),
                        reply_text: replyText,
                    });

                    replies.push({
                        videoId,
                        commentId,
                        author: authorName,
                        comment: commentText.substring(0, 100),
                        reply: replyText,
                    });
                } else {
                    const errText = await replyRes.text();
                    console.error("Reply failed:", errText);
                }

                // Rate limit 방지
                await new Promise((r) => setTimeout(r, 500));
            }
        } catch (e) {
            console.error("Error processing video:", videoId, e);
        }
    }

    return jsonRes({ message: `Processed ${videoIds.length} videos`, replies });
}

// 영상 목록 가져오기
async function handleGetVideos(config: any, accessToken: string) {
    const channelId = config.channel_id;
    if (!channelId) {
        return jsonRes({ error: "Channel ID not configured" });
    }

    const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&maxResults=20&type=video`,
        { headers: { Authorization: "Bearer " + accessToken } }
    );
    const data = await res.json();

    const videos = (data.items || []).map((v: any) => ({
        videoId: v.id.videoId,
        title: v.snippet.title,
        thumbnail: v.snippet.thumbnails?.medium?.url,
        publishedAt: v.snippet.publishedAt,
    }));

    return jsonRes({ videos });
}

// 수동 댓글 답글
async function handleReplyComment(accessToken: string, commentId: string, replyText: string, videoId: string, sb: any) {
    const res = await fetch(
        "https://www.googleapis.com/youtube/v3/comments?part=snippet",
        {
            method: "POST",
            headers: {
                Authorization: "Bearer " + accessToken,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                snippet: {
                    parentId: commentId,
                    textOriginal: replyText,
                },
            }),
        }
    );

    if (!res.ok) {
        const err = await res.text();
        return jsonRes({ error: "Reply failed: " + err });
    }

    // DB에 기록
    await sb.from("marketing_comment_replies").insert({
        video_id: videoId || "",
        comment_id: commentId,
        comment_text: "",
        reply_text: replyText,
    });

    return jsonRes({ success: true });
}

// 토큰 리프레시
async function refreshToken(config: any, sb: any): Promise<string | null> {
    if (!config.refresh_token || !config.client_id || !config.client_secret) {
        return null;
    }

    try {
        const res = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: config.client_id,
                client_secret: config.client_secret,
                refresh_token: config.refresh_token,
                grant_type: "refresh_token",
            }),
        });

        const data = await res.json();
        if (data.error) {
            console.error("Token refresh failed:", data);
            return null;
        }

        // DB 업데이트
        await sb.from("marketing_youtube_config").update({
            access_token: data.access_token,
            token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
            updated_at: new Date().toISOString(),
        }).eq("id", config.id);

        return data.access_token;
    } catch (e) {
        console.error("Token refresh error:", e);
        return null;
    }
}

function jsonRes(data: any) {
    return new Response(JSON.stringify(data), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

-- Update ALL common_info JP content where content_jp is empty (falling back to Korean)
-- Also update 'all' entry with delivery time (10 business days)
UPDATE common_info
SET content_jp = '<div style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:10px; padding:14px 16px; font-size:13px; color:#0c4a6e; line-height:1.8;">
<b>📦 配送について</b><br>
・東京・大阪近郊：<b style="color:#059669;">送料無料</b><br>
・地方都市：宅配便の場合 <b style="color:#059669;">送料無料</b><br>
・展示ブースなど配送車両が必要な場合：<b>別途お問い合わせください</b><br>
・納期：ご注文確定後 <b>約10営業日</b>でお届けいたします
</div>

<div style="background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:14px 16px; font-size:13px; color:#92400e; line-height:1.8; margin-top:10px;">
<b>💳 お支払い方法</b><br>
・クレジットカード（VISA / MASTER / JCB / AMEX）<br>
・銀行振込（ご注文確認後、製作開始）
</div>

<div style="background:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:14px 16px; font-size:13px; color:#991b1b; line-height:1.8; margin-top:10px;">
<b>⚠️ ご注文時の注意事項</b><br>
・すべての商品は<b>受注生産</b>のため、製作開始後のキャンセル・変更はできません。<br>
・モニター環境により実際の印刷色と若干異なる場合があります。<br>
・アップロードファイルの解像度は<b>300dpi以上</b>を推奨します。<br>
・大量注文（50個以上）は別途お見積りをご依頼ください。
</div>

<div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:14px 16px; font-size:13px; color:#166534; line-height:1.8; margin-top:10px;">
<b>🔄 交換・返品</b><br>
・受注生産品のため、お客様都合による返品・交換はお受けできません。<br>
・印刷不良や破損がある場合は、到着後7日以内にご連絡ください。
</div>',
    content_backup_jp = content_jp
WHERE section = 'top' AND category_code = 'all';

-- For category-specific entries that have no JP content, copy the all-category JP content
UPDATE common_info c
SET content_jp = (SELECT content_jp FROM common_info WHERE section = 'top' AND category_code = 'all' LIMIT 1),
    content_backup_jp = c.content_jp
WHERE c.section = 'top'
  AND c.category_code != 'all'
  AND (c.content_jp IS NULL OR c.content_jp = '');

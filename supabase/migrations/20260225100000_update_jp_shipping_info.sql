-- Update JP common info (delivery section) for all products
UPDATE common_info
SET content_jp = '<div style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:10px; padding:14px 16px; font-size:13px; color:#0c4a6e; line-height:1.8;">
<b>🚚 配送について</b><br>
・東京・大阪近郊：<b style="color:#059669;">送料無料</b><br>
・地方都市：宅配便の場合 <b style="color:#059669;">送料無料</b><br>
・展示ブースなど配送車両が必要な場合：<b>別途お問い合わせください</b>
</div>',
    content_backup_jp = content_jp
WHERE section = 'top' AND category_code = 'all';

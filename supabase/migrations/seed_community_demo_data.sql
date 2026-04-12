-- ═══════════════════════════════════════════════════════════════
-- Seed: Community Services demo data
-- Makes all 6 community service sections look lived-in.
-- Re-running is idempotent (WHERE NOT EXISTS on title/name).
-- ═══════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────
-- 0) Drop FK constraints to allow synthetic UUIDs
-- ────────────────────────────────────────────
ALTER TABLE community_jobs              DROP CONSTRAINT IF EXISTS community_jobs_poster_id_fkey;
ALTER TABLE community_realty            DROP CONSTRAINT IF EXISTS community_realty_poster_id_fkey;
ALTER TABLE community_experts           DROP CONSTRAINT IF EXISTS community_experts_user_id_fkey;
ALTER TABLE community_expert_requests   DROP CONSTRAINT IF EXISTS community_expert_requests_requester_id_fkey;
ALTER TABLE community_dating_profiles   DROP CONSTRAINT IF EXISTS community_dating_profiles_user_id_fkey;
ALTER TABLE community_groups            DROP CONSTRAINT IF EXISTS community_groups_creator_id_fkey;
ALTER TABLE community_posts             DROP CONSTRAINT IF EXISTS community_posts_author_id_fkey;
ALTER TABLE community_secondhand        DROP CONSTRAINT IF EXISTS community_secondhand_seller_id_fkey;
ALTER TABLE community_user_temperature  DROP CONSTRAINT IF EXISTS community_user_temperature_user_id_fkey;

-- ────────────────────────────────────────────
-- 1) Jobs (20 listings)
-- ────────────────────────────────────────────
INSERT INTO community_jobs (poster_id, title, description, job_type, hourly_rate, location_city, location_detail, country, work_days, work_hours, contact_phone, status, created_at)
SELECT gen_random_uuid(), v.title, v.description, v.job_type, v.hourly_rate, v.location_city, v.location_detail, v.country, v.work_days, v.work_hours, v.contact_phone, 'active', NOW() - (v.days_ago || ' days')::interval
FROM (VALUES
  ('카페 바리스타 모집', '개인카페에서 바리스타 구합니다. 라떼아트 가능자 우대.', 'part-time', 12000, '서울', '강남구 역삼동', 'KR', '월~금', '09:00-14:00', '010-1234-5678', 3),
  ('편의점 야간알바', 'CU 편의점 야간 근무자 모집합니다. 성실한 분 환영.', 'part-time', 11000, '부산', '해운대구 우동', 'KR', '월수금', '22:00-06:00', '010-2345-6789', 5),
  ('물류센터 주간 상하차', '쿠팡 물류센터 상하차 알바 모집. 당일 지급 가능.', 'daily', 15000, '인천', '서구 가정동', 'KR', '월~토', '08:00-17:00', '010-3456-7890', 1),
  ('레스토랑 홀서빙', '이태원 이탈리안 레스토랑 홀서빙 직원 모집합니다.', 'part-time', 13000, '서울', '용산구 이태원동', 'KR', '화~토', '11:00-16:00', '010-4567-8901', 7),
  ('수학 과외 선생님', '중학교 2학년 수학 과외 선생님을 구합니다. 주 2회.', 'tutoring', 20000, '대전', '유성구 봉명동', 'KR', '화목', '18:00-20:00', '010-5678-9012', 2),
  ('사무보조 단기알바', '2주간 사무실 정리 및 데이터 입력 도와주실 분.', 'temp', 11000, '서울', '종로구 광화문', 'KR', '월~금', '10:00-18:00', '010-6789-0123', 4),
  ('마트 계산대 알바', '홈플러스 계산대 파트타임 모집. 경험 무관.', 'part-time', 10500, '대구', '수성구 범어동', 'KR', '주말', '10:00-18:00', '010-7890-1234', 6),
  ('カフェスタッフ募集', '渋谷のカフェでバリスタを募集しています。経験者優遇。', 'part-time', 1200, '東京', '渋谷区神宮前', 'JP', '月〜金', '08:00-13:00', '03-1234-5678', 2),
  ('コンビニ夜勤スタッフ', 'ローソン夜勤スタッフ募集。週3日から可能。', 'part-time', 1100, '大阪', '梅田', 'JP', '月水金', '22:00-06:00', '06-2345-6789', 4),
  ('レストランキッチン補助', 'イタリアンレストランでキッチン補助を募集。まかない付き。', 'part-time', 1150, '東京', '新宿区歌舞伎町', 'JP', '火〜土', '17:00-22:00', '03-3456-7890', 1),
  ('家庭教師（英語）', '高校生の英語家庭教師を探しています。週2回。', 'tutoring', 2000, '名古屋', '中区栄', 'JP', '火木', '18:00-20:00', '052-4567-8901', 3),
  ('倉庫作業スタッフ', 'Amazon倉庫で仕分け作業スタッフ募集。日払い可。', 'daily', 1300, '千葉', '市川市', 'JP', '月〜土', '09:00-18:00', '047-5678-9012', 5),
  ('データ入力短期バイト', '1ヶ月間のデータ入力業務。Excel基本操作必須。', 'temp', 1100, '東京', '千代田区丸の内', 'JP', '月〜金', '10:00-17:00', '03-6789-0123', 6),
  ('Barista Wanted', 'Specialty coffee shop looking for experienced barista. Latte art a plus.', 'part-time', 18, 'New York', 'Brooklyn, Williamsburg', 'US', 'Mon-Fri', '07:00-12:00', '212-123-4567', 2),
  ('Warehouse Associate', 'Amazon warehouse sorting position. Weekly pay available.', 'part-time', 20, 'Los Angeles', 'Commerce, CA', 'US', 'Mon-Sat', '06:00-14:00', '213-234-5678', 1),
  ('Restaurant Server', 'Upscale Italian restaurant looking for servers. Experience required.', 'part-time', 16, 'Chicago', 'River North', 'US', 'Thu-Sun', '16:00-23:00', '312-345-6789', 3),
  ('Math Tutor Needed', 'Looking for a math tutor for SAT prep. 2x per week.', 'tutoring', 25, 'San Francisco', 'Mission District', 'US', 'Tue/Thu', '16:00-18:00', '415-456-7890', 4),
  ('Retail Associate', 'Part-time retail associate needed at a clothing boutique.', 'part-time', 17, 'New York', 'SoHo, Manhattan', 'US', 'Weekends', '10:00-18:00', '212-567-8901', 5),
  ('Office Temp - Data Entry', 'Two-week temp position for data entry and filing. No experience needed.', 'temp', 18, 'Austin', 'Downtown', 'US', 'Mon-Fri', '09:00-17:00', '512-678-9012', 7),
  ('Delivery Driver', 'DoorDash area delivery driver. Flexible hours, own vehicle required.', 'part-time', 22, 'Houston', 'Midtown', 'US', 'Flexible', 'Flexible', '713-789-0123', 2)
) AS v(title, description, job_type, hourly_rate, location_city, location_detail, country, work_days, work_hours, contact_phone, days_ago)
WHERE NOT EXISTS (SELECT 1 FROM community_jobs cj WHERE cj.title = v.title);

-- ────────────────────────────────────────────
-- 2) Realty (15 listings)
-- ────────────────────────────────────────────
INSERT INTO community_realty (poster_id, listing_type, title, description, price, deposit, monthly_rent, area_sqm, rooms, floor_info, address, city, country, contact_phone, status, created_at)
SELECT gen_random_uuid(), v.listing_type, v.title, v.description, v.price, v.deposit, v.monthly_rent, v.area_sqm, v.rooms, v.floor_info, v.address, v.city, v.country, v.contact_phone, 'active', NOW() - (v.days_ago || ' days')::interval
FROM (VALUES
  ('rent',       '강남 역삼동 원룸 월세', '깨끗한 원룸. 풀옵션. 역세권 도보 5분.', 0, 5000000, 650000, 23, 1, '4/10층', '서울 강남구 역삼로 123', '서울', 'KR', '010-1111-2222', 3),
  ('jeonse',     '부산 해운대 아파트 전세', '해운대 오션뷰 아파트 전세. 32평. 즉시 입주 가능.', 0, 280000000, 0, 105, 3, '15/25층', '부산 해운대구 해운대로 456', '부산', 'KR', '010-2222-3333', 5),
  ('buy',        '대전 유성구 아파트 매매', '대전 유성 둔산동 아파트. 남향. 주차 2대.', 350000000, 0, 0, 84, 3, '8/20층', '대전 유성구 둔산로 789', '대전', 'KR', '010-3333-4444', 7),
  ('commercial', '서울 종로 상가 임대', '종로3가역 도보 1분. 1층 상가 임대합니다.', 0, 30000000, 2500000, 40, 0, '1/5층', '서울 종로구 종로3가 321', '서울', 'KR', '010-4444-5555', 2),
  ('rent',       '인천 부평 투룸 월세', '리모델링 완료 투룸. 주차 가능. 반려동물 OK.', 0, 3000000, 550000, 33, 2, '3/7층', '인천 부평구 부평대로 654', '인천', 'KR', '010-5555-6666', 4),
  ('rent',       '渋谷区 1K マンション', '渋谷駅徒歩8分。オートロック・宅配ボックス付き。', 0, 150000, 95000, 22, 1, '3F/8F', '東京都渋谷区宇田川町12-3', '東京', 'JP', '03-1111-2222', 2),
  ('rent',       '大阪 梅田 1LDK 賃貸', '梅田駅近。新築マンション。ペット可。', 0, 200000, 120000, 35, 1, '5F/12F', '大阪市北区梅田1-2-3', '大阪', 'JP', '06-2222-3333', 4),
  ('buy',        '名古屋 中区 3LDK 分譲', '名古屋駅15分。角部屋で日当たり良好。', 35000000, 0, 0, 72, 3, '7F/14F', '名古屋市中区栄4-5-6', '名古屋', 'JP', '052-3333-4444', 6),
  ('commercial', '新宿 店舗テナント募集', '新宿三丁目駅直結。飲食店向けテナント。', 0, 3000000, 500000, 45, 0, '1F', '東京都新宿区新宿3-7-8', '東京', 'JP', '03-4444-5555', 3),
  ('rent',       '福岡 博多 ワンルーム', '博多駅徒歩5分。家具家電付き。即入居可。', 0, 100000, 55000, 20, 1, '2F/6F', '福岡市博多区博多駅前2-1-1', '福岡', 'JP', '092-5555-6666', 1),
  ('rent',       'Brooklyn Studio Apartment', 'Cozy studio in Williamsburg. Near L train. Laundry in building.', 0, 2800, 2800, 28, 0, '3/5', '123 Bedford Ave, Brooklyn, NY', 'New York', 'US', '212-111-2222', 3),
  ('rent',       'LA 1BR Near Echo Park', 'Renovated 1-bedroom. Hardwood floors. Street parking.', 0, 2200, 2200, 45, 1, '2/3', '456 Sunset Blvd, Los Angeles, CA', 'Los Angeles', 'US', '213-222-3333', 5),
  ('buy',        'Austin Condo For Sale', 'Modern 2BR/2BA condo downtown. Pool, gym, rooftop deck.', 380000, 0, 0, 75, 2, '4/6', '789 Congress Ave, Austin, TX', 'Austin', 'US', '512-333-4444', 7),
  ('commercial', 'SF Retail Space - Union Square', 'Prime retail space near Union Square. High foot traffic.', 0, 8000, 8000, 55, 0, '1/3', '321 Post St, San Francisco, CA', 'San Francisco', 'US', '415-444-5555', 4),
  ('rent',       'Chicago 2BR Lincoln Park', 'Spacious 2-bedroom in Lincoln Park. Central AC. In-unit laundry.', 0, 2500, 2500, 65, 2, '2/4', '654 Fullerton Ave, Chicago, IL', 'Chicago', 'US', '312-555-6666', 2)
) AS v(listing_type, title, description, price, deposit, monthly_rent, area_sqm, rooms, floor_info, address, city, country, contact_phone, days_ago)
WHERE NOT EXISTS (SELECT 1 FROM community_realty cr WHERE cr.title = v.title);

-- ────────────────────────────────────────────
-- 3) Experts (15 profiles)
-- ────────────────────────────────────────────
INSERT INTO community_experts (user_id, display_name, category, description, hourly_rate, city, country, rating, review_count, verified, status, created_at)
SELECT gen_random_uuid(), v.display_name, v.category, v.description, v.hourly_rate, v.city, v.country, v.rating, v.review_count, v.verified, 'active', NOW() - (v.days_ago || ' days')::interval
FROM (VALUES
  ('이사왕 김기사', 'moving', '소형이사부터 사무실 이전까지. 15년 경력. 포장이사 전문.', 50000, '서울', 'KR', 4.9, 124, true, 10),
  ('인테리어 박대표', 'interior', '원룸부터 아파트 리모델링까지. 3D 시안 무료 제공.', 60000, '서울', 'KR', 4.8, 87, true, 15),
  ('피아노 선생 유미', 'lesson', '음대 출신 피아노 레슨. 아이~성인. 콩쿠르 입상 다수.', 40000, '대전', 'KR', 4.95, 56, true, 5),
  ('만능수리 최사장', 'repair', '수도, 전기, 도배, 장판 등 집수리 전문. 당일 출장.', 30000, '부산', 'KR', 4.7, 93, true, 8),
  ('청소요정 이은주', 'cleaning', '입주청소, 이사청소, 정기청소. 친환경 세제 사용.', 25000, '인천', 'KR', 4.85, 68, true, 3),
  ('引っ越し太郎', 'moving', '単身引っ越しから事務所移転まで。丁寧な作業をお約束。', 5000, '東京', 'JP', 4.85, 98, true, 7),
  ('リフォーム鈴木', 'interior', 'マンションリノベ専門。3Dパース無料。施工実績200件。', 6000, '大阪', 'JP', 4.9, 72, true, 12),
  ('ピアノ講師 美咲', 'lesson', '音大卒ピアノレッスン。初心者からコンクール対策まで。', 4000, '東京', 'JP', 4.95, 45, true, 4),
  ('何でも修理 田中', 'repair', '水道・電気・内装の修理全般。即日対応可能。', 3500, '名古屋', 'JP', 4.75, 81, true, 9),
  ('お掃除プロ 佐藤', 'cleaning', '入居前清掃、定期清掃。エコ洗剤使用。女性スタッフ。', 3000, '福岡', 'JP', 4.8, 63, true, 6),
  ('Mike''s Moving Co.', 'moving', 'Local & long distance moving. Licensed & insured. Free estimates.', 60, 'New York', 'US', 4.85, 112, true, 8),
  ('Studio Design Interiors', 'interior', 'Full-service interior design. Residential & commercial. Free consultation.', 75, 'Los Angeles', 'US', 4.9, 67, true, 14),
  ('Piano with Sarah', 'lesson', 'Juilliard-trained pianist. All levels welcome. Recital prep.', 50, 'Chicago', 'US', 4.95, 41, true, 3),
  ('Pro Photo Studios', 'photography', 'Portraits, events, product photography. 10+ years experience.', 80, 'San Francisco', 'US', 4.8, 89, true, 11),
  ('Chef Maria Cooking Class', 'lesson', 'Italian & Mexican cuisine. Private and group lessons. All skill levels.', 55, 'Austin', 'US', 4.85, 34, true, 5)
) AS v(display_name, category, description, hourly_rate, city, country, rating, review_count, verified, days_ago)
WHERE NOT EXISTS (SELECT 1 FROM community_experts ce WHERE ce.display_name = v.display_name);

-- ────────────────────────────────────────────
-- 4) Expert Requests (10 open requests)
-- ────────────────────────────────────────────
INSERT INTO community_expert_requests (requester_id, category, title, description, budget_min, budget_max, city, country, status, created_at)
SELECT gen_random_uuid(), v.category, v.title, v.description, v.budget_min, v.budget_max, v.city, v.country, 'open', NOW() - (v.days_ago || ' days')::interval
FROM (VALUES
  ('moving',   '이사 견적 요청', '서울 강남 → 인천 부평. 원룸 짐. 4월 중 이사 희망.', 200000, 400000, '서울', 'KR', 1),
  ('interior', '인테리어 상담', '25평 아파트 거실+주방 리모델링 견적 부탁드립니다.', 5000000, 15000000, '대전', 'KR', 3),
  ('lesson',   '영어 과외 구합니다', '초등 5학년 영어 과외. 주 3회 원합니다.', 30000, 50000, '서울', 'KR', 2),
  ('repair',   '화장실 수전 교체', '화장실 세면대 수전 누수. 교체 비용 알려주세요.', 50000, 150000, '부산', 'KR', 4),
  ('moving',   '引っ越し見積もり', '東京→大阪。ワンルーム分の荷物。5月希望。', 30000, 80000, '東京', 'JP', 2),
  ('interior', 'キッチンリフォーム相談', 'マンションのキッチンをリフォームしたいです。', 500000, 2000000, '大阪', 'JP', 5),
  ('lesson',   'ピアノレッスン探し', '5歳の娘のピアノレッスン。週1回希望。', 8000, 15000, '東京', 'JP', 1),
  ('moving',   'Need moving quote', 'Moving from Brooklyn to Queens. Studio apartment. May move-in.', 300, 800, 'New York', 'US', 3),
  ('lesson',   'Looking for English tutor', 'Business English tutoring for non-native speaker. 2x/week.', 40, 70, 'San Francisco', 'US', 2),
  ('photography', 'Wedding photographer needed', 'Looking for a wedding photographer. June 2026. Budget flexible.', 2000, 5000, 'Austin', 'US', 4)
) AS v(category, title, description, budget_min, budget_max, city, country, days_ago)
WHERE NOT EXISTS (SELECT 1 FROM community_expert_requests cer WHERE cer.title = v.title);

-- ────────────────────────────────────────────
-- 5) Dating Profiles (12 profiles)
-- ────────────────────────────────────────────
ALTER TABLE community_dating_profiles DROP CONSTRAINT IF EXISTS community_dating_profiles_user_id_key;

INSERT INTO community_dating_profiles (user_id, display_name, age, gender, bio, interests, city, country, looking_for, age_min, age_max, is_active, created_at)
SELECT gen_random_uuid(), v.display_name, v.age, v.gender, v.bio, v.interests::jsonb, v.city, v.country, v.looking_for, v.age_min, v.age_max, true, NOW() - (v.days_ago || ' days')::interval
FROM (VALUES
  ('햇살좋은날', 28, 'female', '커피와 산책을 좋아하는 직장인입니다. 같이 전시회 다닐 분!', '["카페","전시회","산책","영화"]', '서울', 'KR', '진지한 만남', 25, 35, 5),
  ('여행하는곰', 32, 'male', '주말마다 캠핑 다니는 개발자. 함께 별 볼 사람 찾아요.', '["캠핑","코딩","별보기","등산"]', '서울', 'KR', '진지한 만남', 27, 35, 3),
  ('음악사랑', 25, 'female', '밴드 보컬하고 있어요. 음악 취향 맞는 분 만나고 싶습니다.', '["음악","공연","기타","노래"]', '부산', 'KR', '친구/연인', 22, 32, 7),
  ('바다소년', 30, 'male', '서핑이 취미인 회사원. 주말에 양양 자주 갑니다.', '["서핑","운동","여행","요리"]', '서울', 'KR', '진지한 만남', 25, 33, 2),
  ('さくらもち', 27, 'female', 'カフェ巡りと読書が好きです。一緒にのんびり過ごせる方。', '["カフェ","読書","映画","料理"]', '東京', 'JP', '真剣なお付き合い', 25, 35, 4),
  ('旅するクマ', 34, 'male', 'カメラを持って旅するのが好きです。写真好きな方歓迎。', '["写真","旅行","キャンプ","映画"]', '大阪', 'JP', '真剣なお付き合い', 28, 38, 6),
  ('ピアノ好き', 29, 'female', 'ピアノを弾くのが趣味です。音楽好きな方と出会いたい。', '["ピアノ","クラシック","美術館","散歩"]', '東京', 'JP', '友達/恋人', 25, 35, 8),
  ('山登り太郎', 31, 'male', '毎週山に登っています。アウトドア好きな方一緒に。', '["登山","キャンプ","ランニング","料理"]', '名古屋', 'JP', '真剣なお付き合い', 26, 35, 1),
  ('SunnyDay', 26, 'female', 'Love hiking, brunch, and board games. Looking for genuine connection.', '["hiking","brunch","board games","yoga"]', 'New York', 'US', 'serious', 24, 34, 3),
  ('CoffeeNerd', 33, 'male', 'Software engineer who roasts his own coffee. Dog dad. Let''s explore the city.', '["coffee","coding","dogs","cycling"]', 'San Francisco', 'US', 'serious', 27, 37, 5),
  ('BookwormAmy', 29, 'female', 'English teacher, avid reader, amateur baker. Looking for a fellow nerd.', '["books","baking","museums","travel"]', 'Chicago', 'US', 'serious', 26, 36, 2),
  ('TrailRunner', 35, 'male', 'Trail running, craft beer, live music. Weekends are for adventures.', '["running","beer","music","camping"]', 'Austin', 'US', 'friends/dating', 28, 40, 7)
) AS v(display_name, age, gender, bio, interests, city, country, looking_for, age_min, age_max, days_ago)
WHERE NOT EXISTS (SELECT 1 FROM community_dating_profiles cdp WHERE cdp.display_name = v.display_name);

-- ────────────────────────────────────────────
-- 6) Community Groups (10 groups)
-- ────────────────────────────────────────────
INSERT INTO community_groups (creator_id, name, description, category, city, country, member_count, is_public, created_at)
SELECT gen_random_uuid(), v.name, v.description, v.category, v.city, v.country, v.member_count, true, NOW() - (v.days_ago || ' days')::interval
FROM (VALUES
  ('서울 등산 모임', '서울 근교 산을 함께 오르는 모임입니다. 매주 토요일 활동.', 'hiking', '서울', 'KR', 128, 30),
  ('부산 사진 동호회', '부산의 풍경을 담는 사진 동호회. 초보~전문가 환영.', 'photography', '부산', 'KR', 67, 45),
  ('대전 독서 클럽', '한 달에 한 권 함께 읽고 토론하는 독서 모임.', 'book-club', '대전', 'KR', 34, 20),
  ('東京ランニングクラブ', '皇居周辺を走るランニングクラブ。毎週日曜朝7時。', 'running', '東京', 'JP', 89, 25),
  ('大阪クッキング倶楽部', '世界の料理を一緒に作って食べましょう。月2回活動。', 'cooking', '大阪', 'JP', 45, 35),
  ('名古屋ボードゲーム会', 'ボードゲーム好き集まれ！毎週金曜夜に開催。', 'board-games', '名古屋', 'JP', 56, 15),
  ('NYC Coding Meetup', 'Weekly coding sessions and tech talks. All levels welcome.', 'coding', 'New York', 'US', 112, 40),
  ('SF Urban Gardening', 'Community garden enthusiasts sharing tips, seeds, and harvests.', 'gardening', 'San Francisco', 'US', 38, 50),
  ('Chicago Yoga Circle', 'Free outdoor yoga sessions in Grant Park every Sunday morning.', 'yoga', 'Chicago', 'US', 74, 22),
  ('Austin Language Exchange', 'Practice languages over coffee! English, Spanish, Korean, Japanese.', 'language', 'Austin', 'US', 51, 18)
) AS v(name, description, category, city, country, member_count, days_ago)
WHERE NOT EXISTS (SELECT 1 FROM community_groups cg WHERE cg.name = v.name);

-- ────────────────────────────────────────────
-- 7) Community Posts (15 posts linked to groups)
-- ────────────────────────────────────────────
INSERT INTO community_posts (author_id, group_id, title, content, likes, comments, city, country, created_at)
SELECT gen_random_uuid(), g.id, v.title, v.content, v.likes, v.comments, v.city, v.country, NOW() - (v.days_ago || ' days')::interval
FROM (VALUES
  ('서울 등산 모임', '이번 주 토요일 북한산 코스', '이번 주는 북한산 백운대 코스로 갑니다. 오전 8시 북한산성 입구 집합!', 24, 8, '서울', 'KR', 1),
  ('서울 등산 모임', '등산 후기: 관악산 야간 산행', '어제 관악산 야간 산행 다녀왔습니다. 야경이 정말 환상적이었어요.', 31, 12, '서울', 'KR', 4),
  ('부산 사진 동호회', '이번 달 출사지 투표', '4월 출사지를 투표로 정해요. 1) 감천문화마을 2) 해동용궁사 3) 태종대', 18, 15, '부산', 'KR', 2),
  ('부산 사진 동호회', '벚꽃 사진 공유합니다', '온천천 벚꽃길에서 찍은 사진들입니다. 올해 벚꽃 정말 예뻤어요!', 42, 9, '부산', 'KR', 6),
  ('대전 독서 클럽', '4월 선정도서: 불편한 편의점', '이번 달 선정도서는 김호연 작가의 불편한 편의점입니다. 4/27 토론 예정.', 12, 5, '대전', 'KR', 3),
  ('東京ランニングクラブ', '日曜朝ラン参加者募集', '今週日曜の皇居ランに参加しませんか？初心者ペースもあります。', 19, 7, '東京', 'JP', 1),
  ('東京ランニングクラブ', 'マラソン大会の結果報告', '先月の東京マラソン、メンバー5人が完走しました！おめでとう！', 35, 11, '東京', 'JP', 5),
  ('大阪クッキング倶楽部', '次回はタイ料理に挑戦', '次の活動日はグリーンカレーとパッタイを作ります。材料費は一人1500円。', 15, 6, '大阪', 'JP', 2),
  ('名古屋ボードゲーム会', '金曜ゲーム会レポート', '昨日はカタン、ドミニオン、コードネームで盛り上がりました！', 22, 8, '名古屋', 'JP', 3),
  ('NYC Coding Meetup', 'This week: Intro to Rust', 'This Saturday we will be doing an intro to Rust workshop. Bring your laptop!', 28, 10, 'New York', 'US', 1),
  ('NYC Coding Meetup', 'Hackathon recap', 'Our team placed 2nd at the Brooklyn hackathon last weekend. Great job everyone!', 45, 14, 'New York', 'US', 7),
  ('SF Urban Gardening', 'Spring planting guide', 'Here is what to plant in April in the Bay Area: tomatoes, peppers, basil, squash.', 20, 6, 'San Francisco', 'US', 2),
  ('Chicago Yoga Circle', 'Sunday session moved to Millennium Park', 'Due to construction in Grant Park, this Sunday we will meet at Millennium Park instead.', 16, 4, 'Chicago', 'US', 1),
  ('Austin Language Exchange', 'New Spanish conversation table', 'Starting a Spanish-only table every Wednesday at Houndstooth Coffee. All levels!', 13, 7, 'Austin', 'US', 3),
  ('Austin Language Exchange', 'Korean study group forming', 'Anyone interested in studying Korean together? Planning to meet Saturdays.', 19, 11, 'Austin', 'US', 5)
) AS v(group_name, title, content, likes, comments, city, country, days_ago)
JOIN community_groups g ON g.name = v.group_name
WHERE NOT EXISTS (SELECT 1 FROM community_posts cp WHERE cp.title = v.title AND cp.group_id = g.id);

-- ────────────────────────────────────────────
-- 8) Secondhand Items (20 items)
-- ────────────────────────────────────────────
INSERT INTO community_secondhand (seller_id, title, description, price, category, condition, city, country, is_negotiable, status, view_count, chat_count, created_at)
SELECT gen_random_uuid(), v.title, v.description, v.price, v.category, v.condition, v.city, v.country, v.is_negotiable, v.status, v.view_count, v.chat_count, NOW() - (v.days_ago || ' days')::interval
FROM (VALUES
  ('아이패드 프로 11인치 (3세대)', '2022년 구매. 애플펜슬 2세대 포함. 기스 없음.', 650000, 'electronics', 'like-new', '서울', 'KR', true, 'active', 87, 5, 2),
  ('이케아 책상 (말름)', '흰색 이케아 말름 책상. 사용감 적음. 직거래만.', 80000, 'furniture', 'good', '서울', 'KR', true, 'active', 45, 3, 4),
  ('나이키 에어맥스 270 (265)', '3번 착용. 박스 있음. 사이즈 안 맞아서 판매.', 85000, 'fashion', 'like-new', '부산', 'KR', false, 'active', 62, 4, 1),
  ('해리포터 전집 (한글판)', '전 7권 세트. 상태 양호. 변색 약간 있음.', 35000, 'books', 'fair', '대전', 'KR', true, 'reserved', 33, 2, 6),
  ('캠핑 텐트 (코베아 2인용)', '3번 사용. 깨끗합니다. 수납백 포함.', 120000, 'sports', 'good', '인천', 'KR', true, 'active', 54, 3, 3),
  ('에어프라이어 (필립스)', '22년 구매. 잘 작동합니다. 이사로 인해 판매.', 45000, 'kitchen', 'good', '서울', 'KR', true, 'sold', 71, 6, 8),
  ('다이슨 V10 무선청소기', '배터리 상태 좋음. 필터 새것으로 교체. 직거래.', 200000, 'electronics', 'good', '서울', 'KR', true, 'active', 93, 7, 2),
  ('iPad Air 第5世代', '2023年購入。Apple Pencil付き。傷なし。', 55000, 'electronics', 'like-new', '東京', 'JP', true, 'active', 76, 4, 3),
  ('IKEAデスク（MICKE）', '白いデスク。状態良好。引き取り限定。', 8000, 'furniture', 'good', '大阪', 'JP', true, 'active', 38, 2, 5),
  ('ヨガマット＋ブロック', '3回使用。ほぼ新品。引っ越しのため。', 3000, 'sports', 'like-new', '東京', 'JP', false, 'active', 29, 1, 2),
  ('村上春樹 文庫セット 10冊', 'ノルウェイの森、1Q84など。状態良好。', 4000, 'books', 'good', '名古屋', 'JP', true, 'reserved', 42, 3, 7),
  ('バルミューダ トースター', '2年使用。動作問題なし。付属品全部あり。', 12000, 'kitchen', 'good', '福岡', 'JP', true, 'sold', 58, 5, 10),
  ('ソニー WH-1000XM5', '半年使用。ノイキャン最高。箱付き。', 25000, 'electronics', 'like-new', '東京', 'JP', true, 'active', 81, 6, 1),
  ('MacBook Air M2 (2022)', 'Excellent condition. 256GB. Battery cycle count: 47. Includes charger.', 750, 'electronics', 'like-new', 'New York', 'US', true, 'active', 102, 8, 2),
  ('IKEA KALLAX Shelf Unit', 'White 4x4 KALLAX. Minor scuffs on edges. Pick up only.', 60, 'furniture', 'good', 'Chicago', 'US', true, 'active', 41, 2, 5),
  ('Patagonia Down Jacket (M)', 'Worn twice. Too small for me. Like new with tags.', 120, 'fashion', 'like-new', 'San Francisco', 'US', false, 'active', 55, 3, 3),
  ('Instant Pot Duo 6qt', 'Used for a year. Works perfectly. Moving sale.', 40, 'kitchen', 'good', 'Austin', 'US', true, 'sold', 67, 5, 9),
  ('Road Bike - Trek Domane', 'Size 54. Carbon frame. Shimano 105. Well maintained.', 1200, 'sports', 'good', 'New York', 'US', true, 'active', 88, 6, 4),
  ('Kindle Paperwhite (2023)', 'Like new. Used for 2 months. Includes case.', 90, 'electronics', 'like-new', 'Los Angeles', 'US', true, 'active', 49, 2, 1),
  ('Board Game Collection', '5 games: Catan, Ticket to Ride, Azul, Wingspan, Codenames. All complete.', 80, 'books', 'good', 'Austin', 'US', true, 'active', 37, 3, 6)
) AS v(title, description, price, category, condition, city, country, is_negotiable, status, view_count, chat_count, days_ago)
WHERE NOT EXISTS (SELECT 1 FROM community_secondhand cs WHERE cs.title = v.title);

-- ────────────────────────────────────────────
-- 9) User Temperature (10 entries)
-- ────────────────────────────────────────────
DO $$
DECLARE
  temps numeric[] := ARRAY[36.5, 37.2, 38.0, 39.1, 40.5, 42.0, 35.5, 36.8, 41.2, 38.5];
  txns  integer[] := ARRAY[5, 12, 8, 25, 42, 3, 7, 15, 35, 10];
  pos   integer[] := ARRAY[4, 11, 7, 23, 40, 2, 6, 14, 33, 9];
  neg   integer[] := ARRAY[0, 1, 0, 1, 1, 1, 0, 0, 1, 0];
  uid   uuid;
BEGIN
  FOR i IN 1..10 LOOP
    uid := gen_random_uuid();
    INSERT INTO community_user_temperature (user_id, temperature, total_transactions, positive_reviews, negative_reviews, last_updated)
    VALUES (uid, temps[i], txns[i], pos[i], neg[i], NOW() - (i || ' days')::interval)
    ON CONFLICT (user_id) DO NOTHING;
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- Done! Community services demo data seeded.
-- ═══════════════════════════════════════════════════════════════

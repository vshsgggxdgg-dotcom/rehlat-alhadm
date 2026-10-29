-- ============================================================================
-- «رحلة الهضم» (Digestion Journey) — Approved Grade 6 Curriculum Seed v1.4.0
-- Migration: 20261028000002_seed_approved_content_v1_4_0.sql
-- Non-destructive idempotent seed (ON CONFLICT DO NOTHING).
-- Separates public presentation payloads from protected server answer keys.
-- ============================================================================

BEGIN;

-- 1. Insert Content Version as draft first so triggers allow child rows
INSERT INTO public.content_versions (
  content_version_id, status, title_ar, subtitle_ar, grade_ar, subject_ar, about_text_ar, instructions_json
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'draft', 'رحلة الهضم', 'رحلة علمية تفاعلية عبر ستة مستويات متدرجة (٢٦ نشاطاً بإجمالي ١٨٦ نقطة) لاستكشاف مفهوم الهضم، مسار القناة الهضمية، العصارات الهاضمة واللعاب، الامتصاص ودور الكبد، الخملات، والتخلص من بقايا الطعام غير المهضوم.',
  'الصف السادس الابتدائي', 'العلوم — الجهاز الهضمي للإنسان', 'مشروع تعليمي تفاعلي من فكرة وإعداد الطالبة نورهان السيد محمد أبو شادي، بالفرقة الثالثة، قسم تكنولوجيا التعليم، ضمن مقرر طرق واستراتيجيات التدريس في التخصص.', '{"instructionsTitleAr":"قبل ما تبدأ رحلتك!","instructionsSubtitleAr":"اعرف قواعد اللعب، واجمع النقاط، وافتح المستويات واحدًا بعد الآخر!","instructionCards":[{"cardNumber":1,"id":"inst-card-1","iconKey":"sparkles-points","titleAr":"جاوب واجمع النقاط","bodyAr":"جاوب صح من أول محاولة وخد نقاط النشاط كاملة!"},{"cardNumber":2,"id":"inst-card-2","iconKey":"two-attempts-help","titleAr":"عندك محاولتان","bodyAr":"لو إجابتك غلط، هتظهرلك مساعدة عشان تحاول مرة تانية."},{"cardNumber":3,"id":"inst-card-3","iconKey":"score-calculator","titleAr":"كل محاولة ليها حسابها","bodyAr":"صح من التانية؟ تاخد نصف النقاط. ولو غلطت تاني، هتشوف الحل وشرحه."},{"cardNumber":4,"id":"inst-card-4","iconKey":"badge-medal","titleAr":"كمّل واجمع الشارات","bodyAr":"خلّص أنشطة المستوى وخد شارتك، حتى لو مجمعتش كل النقاط."},{"cardNumber":5,"id":"inst-card-5","iconKey":"unlock-next","titleAr":"افتح المستوى التالي","bodyAr":"كمّل كل أنشطة مستواك عشان تبدأ اللي بعده. ومفيش نقاط بتتخصم بسبب الغلط!"}],"instructionsReminderAr":"محتاج تفتكر القواعد؟ ارجع للتعليمات من علامة الاستفهام في أي وقت، من غير ما تخسر تقدمك.","instructionsPrimaryActionAr":"فهمت، يلا نبدأ! ←"}'::jsonb
) ON CONFLICT (content_version_id) DO NOTHING;

-- 2. Insert 6 Curriculum Levels
INSERT INTO public.curriculum_levels (
  content_version_id, level_id, level_order, station_name_ar, organ_name_ar, subtitle_ar,
  illustration_key, badge_json, learning_objectives_json, core_facts_json, key_concepts_json, max_possible_score
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'lvl-station-1-mouth', 1, 'المستوى الأول: مفهوم الهضم',
  'مفهوم الهضم وأهميته الحيوية للجسم', 'تحويل جزيئات الغذاء المعقدة إلى صورة بسيطة يستفيد منها الجسم (نشاطان × ٢ = ٤ نقاط)', 'station-1-mouth',
  '{"badgeId":"badge-lvl-1-mouth","titleAr":"شارة مستكشف مفهوم الهضم","descriptionAr":"أنهيت أنشطة المستوى الأول وتعرفت على المفهوم العلمي لعملية الهضم وأهميتها لخلايا الجسم.","scientificTakeawayAr":"الهضم هو تحويل جزيئات الغذاء الكبيرة والمعقدة إلى جزيئات أصغر وأبسط قابلة للذوبان والامتصاص."}'::jsonb, '["تعريف عملية الهضم علمياً بأنها تحويل المركبات الغذائية المعقدة إلى مركبات بسيطة قابلة للذوبان والامتصاص.","تفسير سبب حاجة الجسم لهضم الطعام قبل أن تتمكن الخلايا من الاستفادة منه في إنتاج الطاقة والنمو."]'::jsonb, '["الطعام الذي نتناوله يحتوي على عناصر غذائية معقدة وكبيرة الحجم لا تستطيع عبور جدران الخلايا مباشرة.","تعمل عملية الهضم على تفكيك جزيئات الطعام المعقدة إلى جزيئات بسيطة تذوب في الماء ويسهل امتصاصها.","يستخدم الجسم الغذاء المهضوم في توليد الطاقة اللازمة للحركة والنشاط وبناء الأنسجة وتعويض التالف منها."]'::jsonb,
  '[{"termAr":"عملية الهضم","summaryAr":"تحويل جزيئات الطعام الكبيرة والمعقدة إلى جزيئات أصغر وأبسط يسهل امتصاصها في الدم."},{"termAr":"الغذاء المهضوم","summaryAr":"العناصر الغذائية بعد تفكيكها إلى أبسط صورة قابلة للذوبان والعبور إلى الدم."}]'::jsonb, 4
) ON CONFLICT (content_version_id, level_id) DO NOTHING;
INSERT INTO public.curriculum_levels (
  content_version_id, level_id, level_order, station_name_ar, organ_name_ar, subtitle_ar,
  illustration_key, badge_json, learning_objectives_json, core_facts_json, key_concepts_json, max_possible_score
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'lvl-station-2-esophagus', 2, 'المستوى الثاني: القناة الهضمية ومسار الطعام',
  'الفم والبلعوم والمريء والمعدة والأمعاء', 'تتبّع مسار اللقمة الغذائية عبر أعضاء القناة الهضمية بالترتيب (٥ أنشطة × ٤ = ٢٠ نقطة)', 'station-2-esophagus',
  '{"badgeId":"badge-lvl-2-esophagus","titleAr":"شارة خبير مسار القناة الهضمية","descriptionAr":"أنهيت أنشطة المستوى الثاني وحددت أعضاء القناة الهضمية وترتيب مسار الطعام بدقة.","scientificTakeawayAr":"يمر الطعام بالترتيب عبر الفم ثم البلعوم ثم المريء ثم المعدة ثم الأمعاء الدقيقة فالأمعاء الغليظة."}'::jsonb, '["تحديد مواقع أعضاء القناة الهضمية على الرسم التشريحي بدقة.","ترتيب مسار الطعام عبر القناة الهضمية من الفم حتى الأمعاء الغليظة.","التمييز بين القناة الهضمية التي يمر بها الطعام وملحقات القناة الهضمية."]'::jsonb, '["يتكون الجهاز الهضمي من القناة الهضمية وملحقات القناة الهضمية.","القناة الهضمية أنبوب عضلي طويل يمر بداخله الطعام بالترتيب: الفم، البلعوم، المريء، المعدة، الأمعاء الدقيقة، ثم الأمعاء الغليظة.","يغلق لسان المزمار القصبة الهوائية عند البلع، وينقل المريء الطعام إلى المعدة بالحركة الدودية."]'::jsonb,
  '[{"termAr":"القناة الهضمية","summaryAr":"المسار الأنبوبي المتصل الذي يعبره الطعام من الفم حتى فتحة الشرج."},{"termAr":"الحركة الدودية في المريء","summaryAr":"انقباضات عضلية متتابعة تدفع البلعة الغذائية من البلعوم إلى المعدة."}]'::jsonb, 20
) ON CONFLICT (content_version_id, level_id) DO NOTHING;
INSERT INTO public.curriculum_levels (
  content_version_id, level_id, level_order, station_name_ar, organ_name_ar, subtitle_ar,
  illustration_key, badge_json, learning_objectives_json, core_facts_json, key_concepts_json, max_possible_score
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'lvl-station-3-stomach', 3, 'المستوى الثالث: العصارات الهاضمة واللعاب ووظيفته',
  'الغدد اللعابية واللعاب والعصارة المعدية والصفراوية والبنكرياسية', 'دراسة اللعاب ووظيفته في هضم النشويات وتكامل العصارات الهاضمة (٧ أنشطة × ٦ = ٤٢ نقطة)', 'station-3-stomach',
  '{"badgeId":"badge-lvl-3-stomach","titleAr":"شارة عالم العصارات الهاضمة","descriptionAr":"أنهيت أنشطة المستوى الثالث وأتقنت وظيفة اللعاب وإنزيم الأميليز ودور العصارات الهاضمة.","scientificTakeawayAr":"يحتوي اللعاب على إنزيم الأميليز الذي يحوّل النشويات إلى سكريات أبسط، وتستكمل العصارات المعدية والصفراوية والبنكرياسية والمعوية الهضم."}'::jsonb, '["تحديد الغدد اللعابية ومكونات تجويف الفم على الرسم التشريحي.","توضيح وظيفة اللعاب في ترطيب الطعام وتحويل النشويات كيميائياً إلى سكريات أبسط بإنزيم الأميليز.","المقارنة بين العصارة اللعابية والعصارة المعدية والعصارة الصفراوية والعصارة البنكرياسية والمعوية."]'::jsonb, '["تفرز الغدد اللعابية (ثلاثة أزواج) سائل اللعاب داخل تجويف الفم.","يقوم اللعاب بترطيب الطعام لتسهيل بلعه، ويحتوي على إنزيم الأميليز الذي يهضم النشويات كيميائياً إلى سكريات أبسط.","تفرز المعدة العصارة المعدية لهضم البروتينات جزئياً، بينما تفرز الأمعاء الدقيقة والبنكرياس والكبد عصارات لاستكمال الهضم."]'::jsonb,
  '[{"termAr":"اللعاب وإنزيم الأميليز","summaryAr":"سائل تفرزه الغدد اللعابية يرطب الطعام ويحوّل المواد النشوية إلى سكريات أبسط."},{"termAr":"العصارات الهاضمة","summaryAr":"سوائل حيوية تحتوي على إنزيمات ومواد كيميائية تفكك النشويات والبروتينات والدهون."}]'::jsonb, 42
) ON CONFLICT (content_version_id, level_id) DO NOTHING;
INSERT INTO public.curriculum_levels (
  content_version_id, level_id, level_order, station_name_ar, organ_name_ar, subtitle_ar,
  illustration_key, badge_json, learning_objectives_json, core_facts_json, key_concepts_json, max_possible_score
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'lvl-station-4-small-intestine', 4, 'المستوى الرابع: الامتصاص ودور الكبد',
  'الأمعاء الدقيقة والكبد والحويصلة الصفراوية', 'انتقال الغذاء المهضوم إلى الدم ودور الكبد في الهضم وتنظيم الغذاء الممتص (٤ أنشطة × ٨ = ٣٢ نقطة)', 'station-4-small-intestine',
  '{"badgeId":"badge-lvl-4-small-intestine","titleAr":"شارة خبير الامتصاص ودور الكبد","descriptionAr":"أنهيت أنشطة المستوى الرابع وتعرفت على عملية الامتصاص في الأمعاء الدقيقة والأدوار الحيوية للكبد.","scientificTakeawayAr":"تمتص الأمعاء الدقيقة الغذاء المهضوم لينتقل إلى الدم، ويفرز الكبد العصارة الصفراوية وينقّي الدم وينظّم مخزون السكر."}'::jsonb, '["تعريف عملية الامتصاص وتحديد موقع حدوثها في الأمعاء الدقيقة.","تحديد الكبد والحويصلة الصفراوية والاثني عشر على الرسم التشريحي.","شرح دور الكبد في إفراز العصارة الصفراوية والتعامل مع الغذاء الممتص القادم من الأمعاء الدقيقة."]'::jsonb, '["الامتصاص هو انتقال المركبات الغذائية المهضومة من تجويف الأمعاء الدقيقة إلى الدم واللمف.","يفرز الكبد العصارة الصفراوية التي تُخزن في الحويصلة الصفراوية وتصب في الاثني عشر لتجزئة الدهون إلى مستحلب دهني.","ينتقل الدم المحمّل بالغذاء الممتص من الأمعاء الدقيقة إلى الكبد عبر الوريد البابي الكبدي لتنظيم نسبة السكر وتنقية الدم من السموم."]'::jsonb,
  '[{"termAr":"عملية الامتصاص","summaryAr":"عبور الجزيئات الغذائية المهضومة من جدار الأمعاء الدقيقة إلى الدورة الدموية واللمفاوية."},{"termAr":"دور الكبد الحيوي","summaryAr":"إفراز العصارة الصفراوية لهضم الدهون، وتخزين الفائض من الجلوكوز، وتنقية الدم من السموم."}]'::jsonb, 32
) ON CONFLICT (content_version_id, level_id) DO NOTHING;
INSERT INTO public.curriculum_levels (
  content_version_id, level_id, level_order, station_name_ar, organ_name_ar, subtitle_ar,
  illustration_key, badge_json, learning_objectives_json, core_facts_json, key_concepts_json, max_possible_score
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'lvl-station-5-absorption', 5, 'المستوى الخامس: الخملات وكفاءة الامتصاص',
  'الخملات المعوية والشعيرات الدموية والأوعية اللمفاوية', 'مقارنة مساحة سطح الامتصاص وتركيب الخملات الدقيقة (٤ أنشطة × ١٠ = ٤٠ نقطة)', 'station-5-villi-absorption',
  '{"badgeId":"badge-lvl-5-absorption","titleAr":"شارة مهندس الخملات وكفاءة الامتصاص","descriptionAr":"أنهيت أنشطة المستوى الخامس وقارنت عملياً بين السطح الأملس والسطح المزوّد بالخملات في كفاءة الامتصاص.","scientificTakeawayAr":"تضاعف الخملات الدقيقة مساحة السطح الداخلي للأمعاء الدقيقة وتسرّع انتقال الغذاء المهضوم إلى الشعيرات الدموية والأوعية اللمفاوية."}'::jsonb, '["إجراء مقارنة علمية بين جدار أملس وجدار غني بالخملات من حيث مساحة السطح وكفاءة الامتصاص.","تحديد التراكيب الدقيقة داخل الخملة المعوية (الجدار الطلائي الرقيق، الشعيرات الدموية، الوعاء اللمفاوي).","تفسير الملاءمة الوظيفية للخملات المعوية لعملية امتصاص الغذاء المهضوم."]'::jsonb, '["الخملات هي انثناءات وبروزات إصبعية دقيقة جداً تبطّن الجدار الداخلي للأمعاء الدقيقة.","وجود ملايين الخملات يضاعف مساحة سطح الامتصاص أضعافاً كبيرة مقارنة بالأنبوب الأملس.","تتميّز الخملات بجدار طلائي رقيق جداً (طبقة خلوية واحدة) وغزارة الشعيرات الدموية والأوعية اللمفاوية بداخلها لسرعة الامتصاص."]'::jsonb,
  '[{"termAr":"الخملات المعوية (Villi)","summaryAr":"انثناءات إصبعية دقيقة في بطانة الأمعاء الدقيقة تزيد مساحة سطح الامتصاص بكفاءة عالية."},{"termAr":"الشعيرات الدموية في الخملة","summaryAr":"شبكة أوعية دقيقة داخل كل خملة تستقبل السكريات البسيطة والأحماض الأمينية والفيتامينات الذائبة في الماء."}]'::jsonb, 40
) ON CONFLICT (content_version_id, level_id) DO NOTHING;
INSERT INTO public.curriculum_levels (
  content_version_id, level_id, level_order, station_name_ar, organ_name_ar, subtitle_ar,
  illustration_key, badge_json, learning_objectives_json, core_facts_json, key_concepts_json, max_possible_score
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'lvl-station-6-large-intestine', 6, 'المستوى السادس: التخلص من بقايا الطعام غير المهضوم',
  'الأمعاء الغليظة والمستقيم وفتحة الشرج', 'إعادة امتصاص الماء والأملاح والتخلص من الفضلات وصحة الجهاز الهضمي (٤ أنشطة × ١٢ = ٤٨ نقطة)', 'station-6-large-intestine',
  '{"badgeId":"badge-lvl-6-large-intestine","titleAr":"شارة إتمام رحلة الهضم الكاملة","descriptionAr":"أتممت جميع المستويات الستة وتعرفت على دور الأمعاء الغليظة والمستقيم في التخلص من بقايا الطعام غير المهضوم.","scientificTakeawayAr":"تمتص الأمعاء الغليظة الماء والأملاح المعدنية من بقايا الطعام غير المهضوم، وتتجمع الفضلات في المستقيم ليتم التخلص منها خارج الجسم."}'::jsonb, '["تحديد الأمعاء الغليظة والمستقيم وعملية إعادة امتصاص الماء على الرسم التشريحي.","تفسير دور الأمعاء الغليظة في استعادة الماء والأملاح المعدنية لحماية الجسم من الجفاف.","ترتيب خطوات التعامل مع بقايا الطعام غير المهضوم واستنتاج العادات الصحية للجهاز الهضمي."]'::jsonb, '["تدخل بقايا الطعام غير المهضوم من نهاية الأمعاء الدقيقة إلى الأمعاء الغليظة.","تفرز الأمعاء الغليظة مخاطاً يسهّل حركة الفضلات، وتمتص معظم الماء والأملاح المعدنية المتبقية لإعادتها للجسم.","تتجمع الفضلات شبه الصلبة في المستقيم ثم تُطرد خارج الجسم عبر فتحة الشرج، وتساعد الألياف الغذائية وشرب الماء على انتظام الإخراج."]'::jsonb,
  '[{"termAr":"الأمعاء الغليظة (القولون)","summaryAr":"الجزء الأخير من القناة الهضمية المسؤول عن امتصاص الماء والأملاح من بقايا الطعام غير المهضوم."},{"termAr":"المستقيم","summaryAr":"الجزء النهائي من الأمعاء الغليظة الذي يختزن الفضلات مؤقتاً قبل التخلص منها خارج الجسم."}]'::jsonb, 48
) ON CONFLICT (content_version_id, level_id) DO NOTHING;

-- 3. Insert 26 Public Curriculum Activities (NO answer keys or premature hints/explanations)
INSERT INTO public.curriculum_activities (
  content_version_id, activity_id, level_id, activity_order, activity_type, title_ar, prompt_ar,
  max_score, public_options_json, public_interaction_config_json, visual_asset_url
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l1-1', 'lvl-station-1-mouth', 1,
  'multiple_choice', 'النشاط ١: المفهوم العلمي لعملية الهضم', 'ما المقصود علمياً بعملية الهضم داخل جسم الإنسان؟', 2,
  '[{"optionId":"opt-l1-1a","labelAr":"تحويل جزيئات الطعام الكبيرة والمعقدة إلى جزيئات أصغر وأبسط يسهل امتصاصها","feedbackAr":""},{"optionId":"opt-l1-1b","labelAr":"نقل الأكسجين من الرئتين إلى خلايا الجسم لإنتاج الطاقة دون تفكيك الطعام","feedbackAr":""},{"optionId":"opt-l1-1c","labelAr":"تخزين الطعام بحالته الصلبة داخل المعدة دون تغيير تركيبه الكيميائي","feedbackAr":""}]'::jsonb, '{"fillInConfig":null,"orderingConfig":null,"matchingConfig":null,"imageIdentificationConfig":null,"villiComparisonConfig":null}'::jsonb, NULL
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.curriculum_activities (
  content_version_id, activity_id, level_id, activity_order, activity_type, title_ar, prompt_ar,
  max_score, public_options_json, public_interaction_config_json, visual_asset_url
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l1-2', 'lvl-station-1-mouth', 2,
  'fill_in', 'النشاط ٢: إكمال مفهوم الهضم وأهميته', 'اسحب بطاقة الكلمة المناسبة أو انقر عليها لوضعها في الفراغ الصحيح لإكمال العبارة العلمية:', 2,
  '[{"optionId":"blank-l1-2-1:word-simple|blank-l1-2-2:word-energy","labelAr":"بسيطة — الطاقة","feedbackAr":""}]'::jsonb, '{"fillInConfig":{"blanks":[{"blankId":"blank-l1-2-1","beforeTextAr":"تعمل عملية الهضم على تفكيك جزيئات الغذاء الكبيرة إلى مواد ","afterTextAr":" يسهل امتصاصها،","correctWordId":"__SERVER_PROTECTED_ANSWER_KEY__"},{"blankId":"blank-l1-2-2","beforeTextAr":"ليستخدمها الجسم في النمو والحصول على ","afterTextAr":" اللازمة لأداء الأنشطة الحيوية.","correctWordId":"__SERVER_PROTECTED_ANSWER_KEY__"}],"wordCards":[{"wordId":"word-simple","labelAr":"بسيطة"},{"wordId":"word-energy","labelAr":"الطاقة"},{"wordId":"word-complex","labelAr":"معقدة غير ذائبة"},{"wordId":"word-waste","labelAr":"فضلات صلبة"}]},"orderingConfig":null,"matchingConfig":null,"imageIdentificationConfig":null,"villiComparisonConfig":null}'::jsonb, NULL
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.curriculum_activities (
  content_version_id, activity_id, level_id, activity_order, activity_type, title_ar, prompt_ar,
  max_score, public_options_json, public_interaction_config_json, visual_asset_url
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l2-1', 'lvl-station-2-esophagus', 1,
  'image_identification', 'النشاط ١: تحديد موقع المعدة على مخطط القناة الهضمية', 'انقر مباشرةً على الموضع التشريحي الذي يمثّل الكيس العضلي الذي يستقبل الطعام من المريء ويمزجه بالعصارة الهاضمة:', 4,
  '[{"optionId":"zone-a","labelAr":"الموضع التشريحي (أ) — المريء","feedbackAr":""},{"optionId":"zone-b","labelAr":"الموضع التشريحي (ب) — المعدة","feedbackAr":""},{"optionId":"zone-c","labelAr":"الموضع التشريحي (ج) — الأمعاء الدقيقة","feedbackAr":""},{"optionId":"zone-d","labelAr":"الموضع التشريحي (د) — الأمعاء الغليظة","feedbackAr":""}]'::jsonb, '{"fillInConfig":null,"orderingConfig":null,"matchingConfig":null,"imageIdentificationConfig":{"assetId":"asset-digestive-tract-pathway","mode":"hotspot_select"},"villiComparisonConfig":null}'::jsonb, 'asset-digestive-tract-pathway'
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.curriculum_activities (
  content_version_id, activity_id, level_id, activity_order, activity_type, title_ar, prompt_ar,
  max_score, public_options_json, public_interaction_config_json, visual_asset_url
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l2-2', 'lvl-station-2-esophagus', 2,
  'ordering', 'النشاط ٢: ترتيب مسار الطعام في القناة الهضمية', 'اسحب البطاقات لترتيب الأعضاء التي يمر بها الطعام داخل القناة الهضمية من بداية دخوله حتى نهايتها:', 4,
  '[{"optionId":"org-mouth>org-pharynx>org-esophagus>org-stomach>org-small-intestine>org-large-intestine","labelAr":"الفم ← البلعوم ← المريء ← المعدة ← الأمعاء الدقيقة ← الأمعاء الغليظة","feedbackAr":""}]'::jsonb, '{"fillInConfig":null,"orderingConfig":{"items":[{"itemId":"org-mouth","labelAr":"الفم"},{"itemId":"org-pharynx","labelAr":"البلعوم"},{"itemId":"org-esophagus","labelAr":"المريء"},{"itemId":"org-stomach","labelAr":"المعدة"},{"itemId":"org-small-intestine","labelAr":"الأمعاء الدقيقة"},{"itemId":"org-large-intestine","labelAr":"الأمعاء الغليظة"}],"initialOrderIds":["org-mouth","org-stomach","org-pharynx","org-large-intestine","org-esophagus","org-small-intestine"],"correctOrderIds":[]},"matchingConfig":null,"imageIdentificationConfig":null,"villiComparisonConfig":null}'::jsonb, NULL
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.curriculum_activities (
  content_version_id, activity_id, level_id, activity_order, activity_type, title_ar, prompt_ar,
  max_score, public_options_json, public_interaction_config_json, visual_asset_url
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l2-3', 'lvl-station-2-esophagus', 3,
  'matching', 'النشاط ٣: توصيل أعضاء المسار الهضمي بوظيفتها التشريحية', 'صِل كل تركيب تشريحي في العمود الأيمن بوظيفته الصحيحة في مسار الطعام بالعمود الأيسر:', 4,
  '[{"optionId":"mp-epiglottis:mt-epiglottis|mp-esophagus:mt-esophagus|mp-pharynx:mt-pharynx|mp-stomach:mt-stomach","labelAr":"البلعوم: تجويف مشترك | لسان المزمار: يغلق القصبة الهوائية | المريء: أنبوب عضلي يدفع البلعة | المعدة: كيس عضلي يخلط الطعام","feedbackAr":""}]'::jsonb, '{"fillInConfig":null,"orderingConfig":null,"matchingConfig":{"rightColumnTitleAr":"التركيب التشريحي","leftColumnTitleAr":"الدور في مسار الطعام","prompts":[{"promptId":"mp-pharynx","labelAr":"البلعوم"},{"promptId":"mp-epiglottis","labelAr":"لسان المزمار"},{"promptId":"mp-esophagus","labelAr":"المريء"},{"promptId":"mp-stomach","labelAr":"المعدة"}],"targets":[{"targetId":"mt-esophagus","labelAr":"أنبوب عضلي يدفع البلعة الغذائية نحو المعدة بالحركة الدودية"},{"targetId":"mt-pharynx","labelAr":"تجويف مشترك يؤدي إلى كلٍّ من المريء والقصبة الهوائية"},{"targetId":"mt-stomach","labelAr":"كيس عضلي يخلط الطعام بالعصارة الهاضمة عبر انقباضاته"},{"targetId":"mt-epiglottis","labelAr":"يغلق فتحة القصبة الهوائية أثناء البلع لمنع دخول الطعام لمجرى التنفس"}],"correctPairs":[]},"imageIdentificationConfig":null,"villiComparisonConfig":null}'::jsonb, NULL
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.curriculum_activities (
  content_version_id, activity_id, level_id, activity_order, activity_type, title_ar, prompt_ar,
  max_score, public_options_json, public_interaction_config_json, visual_asset_url
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l2-4', 'lvl-station-2-esophagus', 4,
  'fill_in', 'النشاط ٤: القناة الهضمية وملحقاتها', 'أكمل الفراغات ببطاقات الكلمات المناسبة للتمييز بين آلية حركة المريء وملحقات القناة الهضمية:', 4,
  '[{"optionId":"blank-l2-4-1:word-peristalsis|blank-l2-4-2:word-accessories","labelAr":"الحركة الدودية — ملحقات القناة الهضمية","feedbackAr":""}]'::jsonb, '{"fillInConfig":{"blanks":[{"blankId":"blank-l2-4-1","beforeTextAr":"ينتقل الطعام عبر المريء إلى المعدة بفضل انقباضات عضلية تُسمى ","afterTextAr":"،","correctWordId":"__SERVER_PROTECTED_ANSWER_KEY__"},{"blankId":"blank-l2-4-2","beforeTextAr":"بينما يُعد الكبد والبنكرياس والغدد اللعابية من ","afterTextAr":" لأن الطعام لا يمر بداخلها.","correctWordId":"__SERVER_PROTECTED_ANSWER_KEY__"}],"wordCards":[{"wordId":"word-peristalsis","labelAr":"الحركة الدودية"},{"wordId":"word-accessories","labelAr":"ملحقات القناة الهضمية"},{"wordId":"word-gravity","labelAr":"الجاذبية فقط"},{"wordId":"word-alveoli","labelAr":"الحويصلات الهوائية"}]},"orderingConfig":null,"matchingConfig":null,"imageIdentificationConfig":null,"villiComparisonConfig":null}'::jsonb, NULL
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.curriculum_activities (
  content_version_id, activity_id, level_id, activity_order, activity_type, title_ar, prompt_ar,
  max_score, public_options_json, public_interaction_config_json, visual_asset_url
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l2-5', 'lvl-station-2-esophagus', 5,
  'image_identification', 'النشاط ٥: تسمية أجزاء مسار البلع والمريء على الرسم التشريحي', 'اسحب كل بطاقة مسمّى تشريحي أو انقر عليها لوضعها على الموضع الصحيح (أ، ب، ج، د) فوق الرسم التشريحي:', 4,
  '[{"optionId":"zone-a:lbl-pharynx|zone-b:lbl-epiglottis|zone-c:lbl-esophagus|zone-d:lbl-stomach","labelAr":"(أ) البلعوم | (ب) لسان المزمار | (ج) المريء | (د) المعدة","feedbackAr":""}]'::jsonb, '{"fillInConfig":null,"orderingConfig":null,"matchingConfig":null,"imageIdentificationConfig":{"assetId":"asset-pharynx-epiglottis-esophagus","mode":"label_placement","labelsToPlace":[{"labelId":"lbl-pharynx","labelAr":"البلعوم","correctZoneId":"__SERVER_PROTECTED_ANSWER_KEY__"},{"labelId":"lbl-epiglottis","labelAr":"لسان المزمار","correctZoneId":"__SERVER_PROTECTED_ANSWER_KEY__"},{"labelId":"lbl-esophagus","labelAr":"المريء","correctZoneId":"__SERVER_PROTECTED_ANSWER_KEY__"},{"labelId":"lbl-stomach","labelAr":"المعدة","correctZoneId":"__SERVER_PROTECTED_ANSWER_KEY__"}]},"villiComparisonConfig":null}'::jsonb, 'asset-pharynx-epiglottis-esophagus'
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.curriculum_activities (
  content_version_id, activity_id, level_id, activity_order, activity_type, title_ar, prompt_ar,
  max_score, public_options_json, public_interaction_config_json, visual_asset_url
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l3-1', 'lvl-station-3-stomach', 1,
  'image_identification', 'النشاط ١: تحديد التراكيب المفرزة للعاب على مخطط الفم', 'انقر على الموضع التشريحي في مخطط الفم الذي يمثّل الغدد المسؤولة عن إفراز اللعاب المحتوي على إنزيم الأميليز:', 6,
  '[{"optionId":"zone-a","labelAr":"الموضع التشريحي (أ) — الأسنان","feedbackAr":""},{"optionId":"zone-b","labelAr":"الموضع التشريحي (ب) — اللسان","feedbackAr":""},{"optionId":"zone-c","labelAr":"الموضع التشريحي (ج) — الغدد اللعابية","feedbackAr":""},{"optionId":"zone-d","labelAr":"الموضع التشريحي (د) — البلعوم","feedbackAr":""}]'::jsonb, '{"fillInConfig":null,"orderingConfig":null,"matchingConfig":null,"imageIdentificationConfig":{"assetId":"asset-oral-cavity-salivary","mode":"hotspot_select"},"villiComparisonConfig":null}'::jsonb, 'asset-oral-cavity-salivary'
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.curriculum_activities (
  content_version_id, activity_id, level_id, activity_order, activity_type, title_ar, prompt_ar,
  max_score, public_options_json, public_interaction_config_json, visual_asset_url
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l3-2', 'lvl-station-3-stomach', 2,
  'multiple_choice', 'النشاط ٢: الوظيفة الكيميائية للعاب في الفم', 'ما الوظيفة الكيميائية الأساسية التي يقوم بها اللعاب عند مضغ قطعة من الخبز في الفم؟', 6,
  '[{"optionId":"opt-l3-2a","labelAr":"تحويل المواد النشوية كيميائياً إلى سكريات أبسط بفعل إنزيم الأميليز وترطيب الطعام","feedbackAr":""},{"optionId":"opt-l3-2b","labelAr":"تجزئة الدهون إلى مستحلب دهني داخل تجويف الفم","feedbackAr":""},{"optionId":"opt-l3-2c","labelAr":"امتصاص الماء والأملاح المعدنية من بقايا الطعام غير المهضوم","feedbackAr":""}]'::jsonb, '{"fillInConfig":null,"orderingConfig":null,"matchingConfig":null,"imageIdentificationConfig":null,"villiComparisonConfig":null}'::jsonb, NULL
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.curriculum_activities (
  content_version_id, activity_id, level_id, activity_order, activity_type, title_ar, prompt_ar,
  max_score, public_options_json, public_interaction_config_json, visual_asset_url
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l3-3', 'lvl-station-3-stomach', 3,
  'fill_in', 'النشاط ٣: تكامل الأسنان واللسان واللعاب', 'ضع بطاقات الكلمات في الفراغات المناسبة لتوضيح تكامل الهضم الميكانيكي والكيميائي في الفم:', 6,
  '[{"optionId":"blank-l3-3-1:word-teeth|blank-l3-3-2:word-starch","labelAr":"الأسنان — النشويات","feedbackAr":""}]'::jsonb, '{"fillInConfig":{"blanks":[{"blankId":"blank-l3-3-1","beforeTextAr":"تقوم ","afterTextAr":" بتقطيع الطعام وطحنه ميكانيكياً لزيادة مساحة سطحه،","correctWordId":"__SERVER_PROTECTED_ANSWER_KEY__"},{"blankId":"blank-l3-3-2","beforeTextAr":"بينما يمزجه اللسان باللعاب الذي يحوّل ","afterTextAr":" إلى سكريات أبسط.","correctWordId":"__SERVER_PROTECTED_ANSWER_KEY__"}],"wordCards":[{"wordId":"word-teeth","labelAr":"الأسنان"},{"wordId":"word-starch","labelAr":"النشويات"},{"wordId":"word-villi","labelAr":"الخملات"},{"wordId":"word-fibers","labelAr":"الألياف السيليلوزية"}]},"orderingConfig":null,"matchingConfig":null,"imageIdentificationConfig":null,"villiComparisonConfig":null}'::jsonb, NULL
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.curriculum_activities (
  content_version_id, activity_id, level_id, activity_order, activity_type, title_ar, prompt_ar,
  max_score, public_options_json, public_interaction_config_json, visual_asset_url
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l3-4', 'lvl-station-3-stomach', 4,
  'multiple_choice', 'النشاط ٤: دور العصارة المعدية في المعدة', 'ما الوظيفة العلمية للعصارة المعدية التي تفرزها المعدة (حمض الهيدروكلوريك وإنزيم الببسين)؟', 6,
  '[{"optionId":"opt-l3-4a","labelAr":"قتل البكتيريا الضارة وهضم البروتينات جزئياً في وسط حمضي","feedbackAr":""},{"optionId":"opt-l3-4b","labelAr":"إفراز اللعاب لترطيب اللقمة قبل بلعها","feedbackAr":""},{"optionId":"opt-l3-4c","labelAr":"نقل الغذاء المهضوم مباشرة عبر الخملات إلى الدم","feedbackAr":""}]'::jsonb, '{"fillInConfig":null,"orderingConfig":null,"matchingConfig":null,"imageIdentificationConfig":null,"villiComparisonConfig":null}'::jsonb, NULL
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.curriculum_activities (
  content_version_id, activity_id, level_id, activity_order, activity_type, title_ar, prompt_ar,
  max_score, public_options_json, public_interaction_config_json, visual_asset_url
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l3-5', 'lvl-station-3-stomach', 5,
  'matching', 'النشاط ٥: توصيل العصارات الهاضمة بوظائفها العلمية', 'صِل كل عصارة هاضمة في العمود الأيمن بوظيفتها العلمية الدقيقة في العمود الأيسر:', 6,
  '[{"optionId":"juice-bile:fn-bile|juice-gastric:fn-gastric|juice-pancreatic:fn-pancreatic|juice-saliva:fn-saliva","labelAr":"اللعاب: هضم النشويات | العصارة المعدية: هضم البروتينات جزئياً | العصارة الصفراوية: تجزئة الدهون | البنكرياسية والمعوية: استكمال الهضم","feedbackAr":""}]'::jsonb, '{"fillInConfig":null,"orderingConfig":null,"matchingConfig":{"rightColumnTitleAr":"العصارة الهاضمة","leftColumnTitleAr":"الوظيفة العلمية","prompts":[{"promptId":"juice-saliva","labelAr":"اللعاب (الأميليز اللعابي)"},{"promptId":"juice-gastric","labelAr":"العصارة المعدية"},{"promptId":"juice-bile","labelAr":"العصارة الصفراوية"},{"promptId":"juice-pancreatic","labelAr":"العصارة البنكرياسية والمعوية"}],"targets":[{"targetId":"fn-gastric","labelAr":"هضم البروتينات جزئياً داخل المعدة في وسط حمضي"},{"targetId":"fn-saliva","labelAr":"ترطيب الطعام في الفم وتحويل النشويات إلى سكريات أبسط"},{"targetId":"fn-pancreatic","labelAr":"استكمال هضم الغذاء في الأمعاء الدقيقة إلى أبسط صورة قابلة للامتصاص"},{"targetId":"fn-bile","labelAr":"تجزئة الدهون إلى قطرات دقيقة (مستحلب دهني) في الاثني عشر"}],"correctPairs":[]},"imageIdentificationConfig":null,"villiComparisonConfig":null}'::jsonb, NULL
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.curriculum_activities (
  content_version_id, activity_id, level_id, activity_order, activity_type, title_ar, prompt_ar,
  max_score, public_options_json, public_interaction_config_json, visual_asset_url
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l3-6', 'lvl-station-3-stomach', 6,
  'ordering', 'النشاط ٦: ترتيب مراحل عمل العصارات الهاضمة على الوجبة', 'رتّب المراحل التالية زمنياً حسب تعرض الطعام للعصارات الهاضمة من بداية تناوله حتى اكتمال هضمه:', 6,
  '[{"optionId":"step-j1>step-j2>step-j3>step-j4","labelAr":"اللعاب في الفم ← العصارة المعدية ← العصارة الصفراوية في الاثني عشر ← العصارة البنكرياسية والمعوية","feedbackAr":""}]'::jsonb, '{"fillInConfig":null,"orderingConfig":{"items":[{"itemId":"step-j1","labelAr":"إفراز اللعاب في الفم لترطيب الطعام وتحويل النشويات لسكريات أبسط"},{"itemId":"step-j2","labelAr":"إفراز العصارة المعدية في المعدة لهضم البروتينات جزئياً"},{"itemId":"step-j3","labelAr":"صبّ العصارة الصفراوية من الكبد في الاثني عشر لتجزئة الدهون"},{"itemId":"step-j4","labelAr":"عمل العصارة البنكرياسية والمعوية في الأمعاء الدقيقة لإتمام الهضم الكامل"}],"initialOrderIds":["step-j3","step-j1","step-j4","step-j2"],"correctOrderIds":[]},"matchingConfig":null,"imageIdentificationConfig":null,"villiComparisonConfig":null}'::jsonb, NULL
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.curriculum_activities (
  content_version_id, activity_id, level_id, activity_order, activity_type, title_ar, prompt_ar,
  max_score, public_options_json, public_interaction_config_json, visual_asset_url
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l3-7', 'lvl-station-3-stomach', 7,
  'image_identification', 'النشاط ٧: تحديد العصارة المفرزة من كل عضو على الرسم التشريحي', 'ضع بطاقة كل عصارة هاضمة على العضو المسؤول عن إفرازها (أ، ب، ج، د) فوق المخطط التشريحي:', 6,
  '[{"optionId":"zone-a:lbl-saliva|zone-b:lbl-gastric|zone-c:lbl-bile|zone-d:lbl-pancreatic","labelAr":"(أ) اللعاب | (ب) العصارة المعدية | (ج) العصارة الصفراوية | (د) العصارة البنكرياسية والمعوية","feedbackAr":""}]'::jsonb, '{"fillInConfig":null,"orderingConfig":null,"matchingConfig":null,"imageIdentificationConfig":{"assetId":"asset-digestive-juices-glands","mode":"label_placement","labelsToPlace":[{"labelId":"lbl-saliva","labelAr":"اللعاب","correctZoneId":"__SERVER_PROTECTED_ANSWER_KEY__"},{"labelId":"lbl-gastric","labelAr":"العصارة المعدية","correctZoneId":"__SERVER_PROTECTED_ANSWER_KEY__"},{"labelId":"lbl-bile","labelAr":"العصارة الصفراوية","correctZoneId":"__SERVER_PROTECTED_ANSWER_KEY__"},{"labelId":"lbl-pancreatic","labelAr":"العصارة البنكرياسية والمعوية","correctZoneId":"__SERVER_PROTECTED_ANSWER_KEY__"}]},"villiComparisonConfig":null}'::jsonb, 'asset-digestive-juices-glands'
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.curriculum_activities (
  content_version_id, activity_id, level_id, activity_order, activity_type, title_ar, prompt_ar,
  max_score, public_options_json, public_interaction_config_json, visual_asset_url
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l4-1', 'lvl-station-4-small-intestine', 1,
  'multiple_choice', 'النشاط ١: مفهوم عملية الامتصاص وموقعها', 'ماذا يحدث للعناصر الغذائية بعد اكتمال هضمها تماماً داخل الأمعاء الدقيقة؟', 8,
  '[{"optionId":"opt-l4-1a","labelAr":"تُمتص عبر جدار الأمعاء الدقيقة وتنتقل إلى الدم لتوزيعها على خلايا الجسم","feedbackAr":""},{"optionId":"opt-l4-1b","labelAr":"تخرج جميعها مع الفضلات دون أن يستفيد منها الجسم","feedbackAr":""},{"optionId":"opt-l4-1c","labelAr":"تعود مرة أخرى إلى المعدة والمريء لإعادة مضغها","feedbackAr":""}]'::jsonb, '{"fillInConfig":null,"orderingConfig":null,"matchingConfig":null,"imageIdentificationConfig":null,"villiComparisonConfig":null}'::jsonb, NULL
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.curriculum_activities (
  content_version_id, activity_id, level_id, activity_order, activity_type, title_ar, prompt_ar,
  max_score, public_options_json, public_interaction_config_json, visual_asset_url
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l4-2', 'lvl-station-4-small-intestine', 2,
  'image_identification', 'النشاط ٢: تحديد موقع الكبد على الرسم التشريحي', 'انقر مباشرةً على العضو الذي يفرز العصارة الصفراوية ويستقبل الدم المحمّل بالغذاء الممتص لتنقيته وتنظيم السكر فيه:', 8,
  '[{"optionId":"zone-a","labelAr":"الموضع التشريحي (أ) — الكبد","feedbackAr":""},{"optionId":"zone-b","labelAr":"الموضع التشريحي (ب) — الحويصلة الصفراوية","feedbackAr":""},{"optionId":"zone-c","labelAr":"الموضع التشريحي (ج) — البنكرياس","feedbackAr":""},{"optionId":"zone-d","labelAr":"الموضع التشريحي (د) — الاثنا عشر","feedbackAr":""}]'::jsonb, '{"fillInConfig":null,"orderingConfig":null,"matchingConfig":null,"imageIdentificationConfig":{"assetId":"asset-liver-bile-duodenum","mode":"hotspot_select"},"villiComparisonConfig":null}'::jsonb, 'asset-liver-bile-duodenum'
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.curriculum_activities (
  content_version_id, activity_id, level_id, activity_order, activity_type, title_ar, prompt_ar,
  max_score, public_options_json, public_interaction_config_json, visual_asset_url
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l4-3', 'lvl-station-4-small-intestine', 3,
  'fill_in', 'النشاط ٣: دور الكبد في الهضم وما بعد الامتصاص', 'ضع بطاقات الكلمات في الفراغات لتوضيح الوظيفة المزدوجة للكبد في الهضم والامتصاص:', 8,
  '[{"optionId":"blank-l4-3-1:word-bile|blank-l4-3-2:word-toxins","labelAr":"العصارة الصفراوية — السموم","feedbackAr":""}]'::jsonb, '{"fillInConfig":{"blanks":[{"blankId":"blank-l4-3-1","beforeTextAr":"يساعد الكبد في عملية الهضم عبر إفراز ","afterTextAr":" التي تجزّئ الدهون إلى مستحلب دهني،","correctWordId":"__SERVER_PROTECTED_ANSWER_KEY__"},{"blankId":"blank-l4-3-2","beforeTextAr":"وبعد الامتصاص يمر الدم القادم من الأمعاء الدقيقة بالكبد لتنظيم مستوى السكر وتنقية الدم من ","afterTextAr":".","correctWordId":"__SERVER_PROTECTED_ANSWER_KEY__"}],"wordCards":[{"wordId":"word-bile","labelAr":"العصارة الصفراوية"},{"wordId":"word-toxins","labelAr":"السموم"},{"wordId":"word-saliva","labelAr":"اللعاب"},{"wordId":"word-oxygen","labelAr":"الأكسجين"}]},"orderingConfig":null,"matchingConfig":null,"imageIdentificationConfig":null,"villiComparisonConfig":null}'::jsonb, NULL
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.curriculum_activities (
  content_version_id, activity_id, level_id, activity_order, activity_type, title_ar, prompt_ar,
  max_score, public_options_json, public_interaction_config_json, visual_asset_url
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l4-4', 'lvl-station-4-small-intestine', 4,
  'matching', 'النشاط ٤: تكامل الأمعاء الدقيقة والكبد والحويصلة الصفراوية', 'صِل كل تركيب تشريحي في العمود الأيمن بوظيفته الحيوية في الهضم والامتصاص بالعمود الأيسر:', 8,
  '[{"optionId":"p-duodenum:t-duodenum|p-gallbladder:t-gallbladder|p-ileum:t-ileum|p-liver:t-liver","labelAr":"الكبد: إنتاج الصفراوية وتنقية الدم | الحويصلة: تخزين الصفراوية | الاثنا عشر: تصب فيه العصارات | اللفائفي: امتصاص الغذاء","feedbackAr":""}]'::jsonb, '{"fillInConfig":null,"orderingConfig":null,"matchingConfig":{"rightColumnTitleAr":"العضو أو التركيب","leftColumnTitleAr":"الوظيفة الحيوية","prompts":[{"promptId":"p-liver","labelAr":"الكبد"},{"promptId":"p-gallbladder","labelAr":"الحويصلة الصفراوية"},{"promptId":"p-duodenum","labelAr":"الاثنا عشر"},{"promptId":"p-ileum","labelAr":"اللفائفي (الأمعاء الدقيقة)"}],"targets":[{"targetId":"t-gallbladder","labelAr":"تخزين العصارة الصفراوية وتركيزها لحين وصول الطعام الدهني"},{"targetId":"t-liver","labelAr":"إنتاج العصارة الصفراوية وتنقية الدم القادم من الأمعاء وتخزين السكر الزائد"},{"targetId":"t-ileum","labelAr":"امتصاص العناصر الغذائية المهضومة ونقلها إلى الدم واللمف"},{"targetId":"t-duodenum","labelAr":"أول أجزاء الأمعاء الدقيقة وتصب فيه العصارة الصفراوية والبنكرياسية"}],"correctPairs":[]},"imageIdentificationConfig":null,"villiComparisonConfig":null}'::jsonb, NULL
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.curriculum_activities (
  content_version_id, activity_id, level_id, activity_order, activity_type, title_ar, prompt_ar,
  max_score, public_options_json, public_interaction_config_json, visual_asset_url
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l5-1', 'lvl-station-5-absorption', 1,
  'villi_comparison', 'النشاط ١: مهمة مقارنة الأسطح — أثر الخملات في كفاءة الامتصاص', 'قارن بين (النموذج أ: أنبوب معوي أملس بلا انثناءات) و(النموذج ب: جدار الأمعاء الدقيقة الغني بالخملات) عبر تصنيف كل خاصية للنموذج الصحيح ثم اختيار الاستنتاج العلمي:', 10,
  '[{"optionId":"crit-capillary-rich:villi_surface|crit-low-absorption:smooth_surface|crit-surface-area:villi_surface||conc:conc-villi-correct","labelAr":"السطح ذو الخملات: مساحة مضاعفة وشعيرات كثيفة | السطح الأملس: مساحة محدودة | الاستنتاج: زيادة مساحة سطح وكفاءة الامتصاص","feedbackAr":""}]'::jsonb, '{"fillInConfig":null,"orderingConfig":null,"matchingConfig":null,"imageIdentificationConfig":null,"villiComparisonConfig":{"assetId":"asset-villi-microstructure","criteria":[{"criterionId":"crit-surface-area","statementAr":"يمتلك مساحة سطح داخلية مضاعفة وكبيرة جداً ملامسة للغذاء المهضوم","correctSurfaceId":"__SERVER_PROTECTED_ANSWER_KEY__"},{"criterionId":"crit-low-absorption","statementAr":"مساحة سطحه محدودة جداً وتمر معظم جزيئات الغذاء عبره دون امتصاص كافٍ","correctSurfaceId":"__SERVER_PROTECTED_ANSWER_KEY__"},{"criterionId":"crit-capillary-rich","statementAr":"تخترق كل انثناءة فيه شبكة كثيفة من الشعيرات الدموية والأوعية اللمفاوية","correctSurfaceId":"__SERVER_PROTECTED_ANSWER_KEY__"}],"conclusionPromptAr":"بناءً على مقارنتك للسطحين، ما الاستنتاج العلمي الصحيح حول وظيفة الخملات في الأمعاء الدقيقة؟","conclusionOptions":[{"optionId":"conc-villi-correct","labelAr":"تزيد الخملات مساحة سطح الامتصاص أضعافاً مضاعفة مما يرفع كفاءة وسرعة انتقال الغذاء المهضوم إلى الدم","feedbackAr":"استنتاج علمي دقيق؛ فزيادة مساحة السطح بالانثناءات هي السبب الرئيسي لكفاءة الامتصاص العالية."},{"optionId":"conc-villi-wrong1","labelAr":"السطح الأملس يمتص الغذاء بكفاءة أعلى لأن الطعام ينزلق فوقه بسرعة دون عوائق","feedbackAr":"انزلاق الطعام بسرعة فوق سطح أملس يقلل زمن ومساحة التلامس فيضعف الامتصاص."},{"optionId":"conc-villi-wrong2","labelAr":"لا فرق في كفاءة الامتصاص بين السطح الأملس والسطح المزوّد بالخملات","feedbackAr":"هناك فرق جوهري كبير؛ فالخملات تضاعف مساحة السطح وكفاءة الامتصاص."}],"correctConclusionId":"__SERVER_PROTECTED_ANSWER_KEY__"}}'::jsonb, 'asset-villi-microstructure'
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.curriculum_activities (
  content_version_id, activity_id, level_id, activity_order, activity_type, title_ar, prompt_ar,
  max_score, public_options_json, public_interaction_config_json, visual_asset_url
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l5-2', 'lvl-station-5-absorption', 2,
  'image_identification', 'النشاط ٢: تسمية التراكيب الدقيقة للخملة المعوية', 'ضع بطاقة كل تركيب تشريحي في موضعه الصحيح (أ، ب، ج، د) على المقطع المكبّر للخملة المعوية:', 10,
  '[{"optionId":"zone-a:lbl-epithelium|zone-b:lbl-capillaries|zone-c:lbl-lacteal|zone-d:lbl-base-vessels","labelAr":"(أ) الطبقة الطلائية | (ب) شبكة الشعيرات الدموية | (ج) الوعاء اللمفاوي | (د) قاعدة جدار الأمعاء","feedbackAr":""}]'::jsonb, '{"fillInConfig":null,"orderingConfig":null,"matchingConfig":null,"imageIdentificationConfig":{"assetId":"asset-villi-microstructure","mode":"label_placement","labelsToPlace":[{"labelId":"lbl-epithelium","labelAr":"الطبقة الطلائية الرقيقة للخملة","correctZoneId":"__SERVER_PROTECTED_ANSWER_KEY__"},{"labelId":"lbl-capillaries","labelAr":"شبكة الشعيرات الدموية","correctZoneId":"__SERVER_PROTECTED_ANSWER_KEY__"},{"labelId":"lbl-lacteal","labelAr":"الوعاء اللمفاوي المركزي","correctZoneId":"__SERVER_PROTECTED_ANSWER_KEY__"},{"labelId":"lbl-base-vessels","labelAr":"قاعدة جدار الأمعاء وأوعية النقل","correctZoneId":"__SERVER_PROTECTED_ANSWER_KEY__"}]},"villiComparisonConfig":null}'::jsonb, 'asset-villi-microstructure'
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.curriculum_activities (
  content_version_id, activity_id, level_id, activity_order, activity_type, title_ar, prompt_ar,
  max_score, public_options_json, public_interaction_config_json, visual_asset_url
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l5-3', 'lvl-station-5-absorption', 3,
  'multiple_choice', 'النشاط ٣: الملاءمة الوظيفية لجدار الخملات', 'لماذا يتميّز جدار الخملة المعوية بأنه رقيق جداً (يتكون من طبقة طلائـية واحدة) وغني بالشعيرات الدموية؟', 10,
  '[{"optionId":"opt-l5-3a","labelAr":"لتسهيل وتسريع عبور جزيئات الغذاء المهضوم من تجويف الأمعاء إلى الدم واللمف","feedbackAr":""},{"optionId":"opt-l5-3b","labelAr":"لمنع مرور أي جزيئات غذائية أو ماء إلى الدورة الدموية","feedbackAr":""},{"optionId":"opt-l5-3c","labelAr":"لإفراز حمض الهيدروكلوريك القوي وطحن العظام الصلبة","feedbackAr":""}]'::jsonb, '{"fillInConfig":null,"orderingConfig":null,"matchingConfig":null,"imageIdentificationConfig":null,"villiComparisonConfig":null}'::jsonb, NULL
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.curriculum_activities (
  content_version_id, activity_id, level_id, activity_order, activity_type, title_ar, prompt_ar,
  max_score, public_options_json, public_interaction_config_json, visual_asset_url
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l5-4', 'lvl-station-5-absorption', 4,
  'ordering', 'النشاط ٤: ترتيب مسار عبور الغذاء عبر الخملات إلى خلايا الجسم', 'رتّب الخطوات التالية لتوضيح رحلة جزيئات الجلوكوز والأحماض الأمينية من لحظة وجودها في تجويف الأمعاء الدقيقة حتى وصولها لخلايا الجسم:', 10,
  '[{"optionId":"abs-step-1>abs-step-2>abs-step-3>abs-step-4","labelAr":"عبور جدار الخملة ← دخول الشعيرات الدموية ← المرور بالكبد والدورة الدموية ← الوصول لخلايا الجسم","feedbackAr":""}]'::jsonb, '{"fillInConfig":null,"orderingConfig":{"items":[{"itemId":"abs-step-1","labelAr":"عبور جزيئات الغذاء المهضوم عبر الجدار الطلائي الرقيق للخملات المعوية"},{"itemId":"abs-step-2","labelAr":"دخول الجزيئات الغذائية إلى شبكة الشعيرات الدموية الدقيقة داخل الخملة"},{"itemId":"abs-step-3","labelAr":"انتقال الدم المحمّل بالغذاء الممتص عبر الوريد البابي إلى الكبد ثم الدورة الدموية"},{"itemId":"abs-step-4","labelAr":"توزيع الغذاء عبر الدم إلى جميع خلايا الجسم لإنتاج الطاقة وبناء الأنسجة"}],"initialOrderIds":["abs-step-3","abs-step-1","abs-step-4","abs-step-2"],"correctOrderIds":[]},"matchingConfig":null,"imageIdentificationConfig":null,"villiComparisonConfig":null}'::jsonb, NULL
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.curriculum_activities (
  content_version_id, activity_id, level_id, activity_order, activity_type, title_ar, prompt_ar,
  max_score, public_options_json, public_interaction_config_json, visual_asset_url
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l6-1', 'lvl-station-6-large-intestine', 1,
  'image_identification', 'النشاط ١: تحديد موقع المستقيم على مخطط الأمعاء الغليظة', 'انقر على الموضع التشريحي الذي يمثّل الجزء العضلي الأخير من الأمعاء الغليظة حيث تتجمع الفضلات شبه الصلبة تمهيداً لطردها خارج الجسم:', 12,
  '[{"optionId":"zone-a","labelAr":"الموضع التشريحي (أ) — اتصال الأمعاء الدقيقة بالغليظة","feedbackAr":""},{"optionId":"zone-b","labelAr":"الموضع التشريحي (ب) — القولون","feedbackAr":""},{"optionId":"zone-c","labelAr":"الموضع التشريحي (ج) — المستقيم","feedbackAr":""},{"optionId":"zone-d","labelAr":"الموضع التشريحي (د) — أسهم إعادة امتصاص الماء","feedbackAr":""}]'::jsonb, '{"fillInConfig":null,"orderingConfig":null,"matchingConfig":null,"imageIdentificationConfig":{"assetId":"asset-large-intestine-excretion","mode":"hotspot_select"},"villiComparisonConfig":null}'::jsonb, 'asset-large-intestine-excretion'
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.curriculum_activities (
  content_version_id, activity_id, level_id, activity_order, activity_type, title_ar, prompt_ar,
  max_score, public_options_json, public_interaction_config_json, visual_asset_url
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l6-2', 'lvl-station-6-large-intestine', 2,
  'fill_in', 'النشاط ٢: وظيفة الأمعاء الغليظة واستعادة الماء', 'أكمل الفراغات ببطاقات الكلمات المناسبة لتوضيح ما يحدث لبقايا الطعام غير المهضوم داخل الأمعاء الغليظة:', 12,
  '[{"optionId":"blank-l6-2-1:word-water|blank-l6-2-2:word-rectum","labelAr":"الماء — المستقيم","feedbackAr":""}]'::jsonb, '{"fillInConfig":{"blanks":[{"blankId":"blank-l6-2-1","beforeTextAr":"تقوم الأمعاء الغليظة بامتصاص ","afterTextAr":" والأملاح المعدنية المتبقية من بقايا الطعام غير المهضوم،","correctWordId":"__SERVER_PROTECTED_ANSWER_KEY__"},{"blankId":"blank-l6-2-2","beforeTextAr":"ثم تتجمع الفضلات شبه الصلبة في ","afterTextAr":" ليتم التخلص منها خارج الجسم عبر فتحة الشرج.","correctWordId":"__SERVER_PROTECTED_ANSWER_KEY__"}],"wordCards":[{"wordId":"word-water","labelAr":"الماء"},{"wordId":"word-rectum","labelAr":"المستقيم"},{"wordId":"word-starch2","labelAr":"النشويات المعقدة"},{"wordId":"word-esophagus2","labelAr":"المريء"}]},"orderingConfig":null,"matchingConfig":null,"imageIdentificationConfig":null,"villiComparisonConfig":null}'::jsonb, NULL
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.curriculum_activities (
  content_version_id, activity_id, level_id, activity_order, activity_type, title_ar, prompt_ar,
  max_score, public_options_json, public_interaction_config_json, visual_asset_url
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l6-3', 'lvl-station-6-large-intestine', 3,
  'matching', 'النشاط ٣: التخلص من الفضلات والعادات الصحية للهضم', 'صِل كل عنصر في العمود الأيمن بدوره الحيوي أو الصحي في العمود الأيسر:', 12,
  '[{"optionId":"ex-chew:ef-chew|ex-colon:ef-colon|ex-fiber:ef-fiber|ex-rectum:ef-rectum","labelAr":"الأمعاء الغليظة: امتصاص الماء | المستقيم: تجميع وطرد الفضلات | الألياف والماء: الوقاية من الإمساك | المضغ الجيد: تفتيت الطعام","feedbackAr":""}]'::jsonb, '{"fillInConfig":null,"orderingConfig":null,"matchingConfig":{"rightColumnTitleAr":"العضو أو السلوك الصحي","leftColumnTitleAr":"الأثر العلمي في الجهاز الهضمي","prompts":[{"promptId":"ex-colon","labelAr":"الأمعاء الغليظة (القولون)"},{"promptId":"ex-rectum","labelAr":"المستقيم وفتحة الشرج"},{"promptId":"ex-fiber","labelAr":"تناول الخضروات والفواكه الغنية بالألياف وشرب الماء"},{"promptId":"ex-chew","labelAr":"مضغ الطعام جيداً وبهدوء في الفم"}],"targets":[{"targetId":"ef-rectum","labelAr":"تجميع الفضلات شبه الصلبة وطردها خارج الجسم بانتظام"},{"targetId":"ef-colon","labelAr":"امتصاص الماء والأملاح المعدنية من بقايا الطعام لحماية الجسم من الجفاف"},{"targetId":"ef-chew","labelAr":"تفتيت الطعام ومزجه جيداً باللعاب لتسهيل البلع والهضم"},{"targetId":"ef-fiber","labelAr":"تسهيل حركة الفضلات في الأمعاء الغليظة والوقاية من الإمساك"}],"correctPairs":[]},"imageIdentificationConfig":null,"villiComparisonConfig":null}'::jsonb, NULL
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.curriculum_activities (
  content_version_id, activity_id, level_id, activity_order, activity_type, title_ar, prompt_ar,
  max_score, public_options_json, public_interaction_config_json, visual_asset_url
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l6-4', 'lvl-station-6-large-intestine', 4,
  'ordering', 'النشاط ٤: ترتيب مراحل التخلص من بقايا الطعام غير المهضوم', 'رتّب المراحل التالية بالتسلسل الصحيح منذ مغادرة بقايا الطعام غير المهضوم للأمعاء الدقيقة حتى التخلص منها خارج الجسم:', 12,
  '[{"optionId":"ex-step-1>ex-step-2>ex-step-3>ex-step-4","labelAr":"انتقال البقايا للأمعاء الغليظة ← امتصاص الماء والأملاح ← تجمّع الفضلات في المستقيم ← طردها عبر فتحة الشرج","feedbackAr":""}]'::jsonb, '{"fillInConfig":null,"orderingConfig":{"items":[{"itemId":"ex-step-1","labelAr":"انتقال بقايا الطعام غير المهضوم من نهاية الأمعاء الدقيقة إلى الأمعاء الغليظة"},{"itemId":"ex-step-2","labelAr":"امتصاص جدار الأمعاء الغليظة للماء والأملاح المعدنية المتبقية وإعادتها للجسم"},{"itemId":"ex-step-3","labelAr":"تحوّل البقايا إلى فضلات شبه صلبة وتجمّعها داخل المستقيم"},{"itemId":"ex-step-4","labelAr":"التخلص من الفضلات وطردها خارج الجسم عبر فتحة الشرج"}],"initialOrderIds":["ex-step-3","ex-step-1","ex-step-4","ex-step-2"],"correctOrderIds":[]},"matchingConfig":null,"imageIdentificationConfig":null,"villiComparisonConfig":null}'::jsonb, NULL
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;

-- 4. Insert 26 Protected Server-Only Answer Keys, Hints, and Scientific Explanations
INSERT INTO public.activity_answer_keys (
  content_version_id, activity_id, canonical_correct_answer, answer_key_payload_json,
  scientific_hint_ar, scientific_explanation_ar, option_feedback_json
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l1-1', 'opt-l1-1a',
  '{"type":"multiple_choice","correctOptionId":"opt-l1-1a"}'::jsonb, 'فكّر في حجم جزيئات الطعام عند تناولها وكيف يجب أن تتغير ليتمكن الدم من نقلها للخلايا.', 'عملية الهضم هي تحويل جزيئات الطعام الكبيرة والمعقدة غير القابلة للذوبان إلى جزيئات أصغر وأبسط قابلة للذوبان والامتصاص ليستفيد منها الجسم.',
  '{"opt-l1-1a":"إجابة دقيقة؛ فالهضم يفكك المركبات الغذائية المعقدة إلى صورة بسيطة قابلة للامتصاص.","opt-l1-1b":"نقل الأكسجين هو وظيفة الجهاز التنفسي والدوري وليس تعريف عملية الهضم.","opt-l1-1c":"الطعام الصلب المعقد لا يستفيد منه الجسم إلا بعد تفكيكه وهضمه إلى جزيئات بسيطة."}'::jsonb
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_answer_keys (
  content_version_id, activity_id, canonical_correct_answer, answer_key_payload_json,
  scientific_hint_ar, scientific_explanation_ar, option_feedback_json
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l1-2', 'blank-l1-2-1:word-simple|blank-l1-2-2:word-energy',
  '{"type":"fill_in","correctOptionId":"blank-l1-2-1:word-simple|blank-l1-2-2:word-energy","blanks":[{"blankId":"blank-l1-2-1","correctWordId":"word-simple"},{"blankId":"blank-l1-2-2","correctWordId":"word-energy"}]}'::jsonb, 'يبدأ الهضم بجزيئات معقدة وينتهي بجزيئات بسيطة تمد الجسم بالطاقة.', 'يحوّل الجهاز الهضمي جزيئات الطعام المعقدة إلى مواد بسيطة قابلة للامتصاص ليحصل الجسم على الطاقة اللازمة للنمو والنشاط.',
  '{"blank-l1-2-1:word-simple|blank-l1-2-2:word-energy":"تعمل عملية الهضم على تفكيك جزيئات الغذاء الكبيرة إلى مواد بسيطة يسهل امتصاصها ليحصل الجسم على الطاقة."}'::jsonb
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_answer_keys (
  content_version_id, activity_id, canonical_correct_answer, answer_key_payload_json,
  scientific_hint_ar, scientific_explanation_ar, option_feedback_json
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l2-1', 'zone-b',
  '{"type":"image_identification","correctOptionId":"zone-b","mode":"hotspot_select","correctZoneId":"zone-b","labelsToPlace":[]}'::jsonb, 'تتبّع الأنبوب العضلي الهابط من الصدر (أ)؛ العضو الكيسي الواسع المتصل بنهايته مباشرة في أعلى يسار البطن هو المطلوب.', 'الموضع (ب) هو المعدة، وهي كيس عضلي يقع في أعلى يسار البطن يستقبل الطعام القادم عبر المريء (أ) قبل دفعه إلى الأمعاء الدقيقة (ج).',
  '{"zone-a":"الموضع (أ) هو المريء الذي ينقل الطعام، بينما المطلوب هو الكيس العضلي الذي يستقبله.","zone-b":"تحديد دقيق! الموضع (ب) هو المعدة التي تستقبل الطعام من المريء وتمزجه بالعصارة المعدية.","zone-c":"الموضع (ج) هو الأمعاء الدقيقة التي تلي المعدة.","zone-d":"الموضع (د) هو الأمعاء الغليظة في نهاية القناة الهضمية."}'::jsonb
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_answer_keys (
  content_version_id, activity_id, canonical_correct_answer, answer_key_payload_json,
  scientific_hint_ar, scientific_explanation_ar, option_feedback_json
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l2-2', 'org-mouth>org-pharynx>org-esophagus>org-stomach>org-small-intestine>org-large-intestine',
  '{"type":"ordering","correctOptionId":"org-mouth>org-pharynx>org-esophagus>org-stomach>org-small-intestine>org-large-intestine","correctOrderIds":["org-mouth","org-pharynx","org-esophagus","org-stomach","org-small-intestine","org-large-intestine"]}'::jsonb, 'ابدأ بدخول الطعام في الفم، ثم عبوره الممر المشترك (البلعوم)، فالأنبوب العضلي (المريء)، فالكيس العضلي (المعدة)، ثم الأمعاء الدقيقة فالغليظة.', 'يمر الطعام بالترتيب عبر: الفم ← البلعوم ← المريء ← المعدة ← الأمعاء الدقيقة ← الأمعاء الغليظة.',
  '{"org-mouth>org-pharynx>org-esophagus>org-stomach>org-small-intestine>org-large-intestine":"ترتيب تشريحي صحيح تماماً لمسار الطعام داخل القناة الهضمية."}'::jsonb
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_answer_keys (
  content_version_id, activity_id, canonical_correct_answer, answer_key_payload_json,
  scientific_hint_ar, scientific_explanation_ar, option_feedback_json
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l2-3', 'mp-epiglottis:mt-epiglottis|mp-esophagus:mt-esophagus|mp-pharynx:mt-pharynx|mp-stomach:mt-stomach',
  '{"type":"matching","correctOptionId":"mp-epiglottis:mt-epiglottis|mp-esophagus:mt-esophagus|mp-pharynx:mt-pharynx|mp-stomach:mt-stomach","correctPairs":[{"promptId":"mp-pharynx","targetId":"mt-pharynx"},{"promptId":"mp-epiglottis","targetId":"mt-epiglottis"},{"promptId":"mp-esophagus","targetId":"mt-esophagus"},{"promptId":"mp-stomach","targetId":"mt-stomach"}]}'::jsonb, 'تذكّر الفرق بين الممر المشترك (البلعوم)، صمام الأمان (لسان المزمار)، والأنبوب العضلي الناقل (المريء).', 'البلعوم ممر مشترك للطعام والهواء، ولسان المزمار يغلق القصبة الهوائية عند البلع، والمريء ينقل الطعام للمعدة بالحركة الدودية، والمعدة كيس عضلي يخلط الطعام.',
  '{"mp-epiglottis:mt-epiglottis|mp-esophagus:mt-esophagus|mp-pharynx:mt-pharynx|mp-stomach:mt-stomach":"توصيل علمي متقن لجميع تراكيب مسار البلع والقناة الهضمية."}'::jsonb
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_answer_keys (
  content_version_id, activity_id, canonical_correct_answer, answer_key_payload_json,
  scientific_hint_ar, scientific_explanation_ar, option_feedback_json
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l2-4', 'blank-l2-4-1:word-peristalsis|blank-l2-4-2:word-accessories',
  '{"type":"fill_in","correctOptionId":"blank-l2-4-1:word-peristalsis|blank-l2-4-2:word-accessories","blanks":[{"blankId":"blank-l2-4-1","correctWordId":"word-peristalsis"},{"blankId":"blank-l2-4-2","correctWordId":"word-accessories"}]}'::jsonb, 'ينتقل الطعام في المريء بموجات عضلية تُعرف بالحركة الدودية، بينما يساعد الكبد والبنكرياس في الهضم دون أن يمر الطعام بداخلهما.', 'يندفع الطعام داخل المريء بفعل الحركة الدودية، بينما تُعد الغدد اللعابية والكبد والبنكرياس من ملحقات القناة الهضمية التي تفرز عصاراتها دون مرور الطعام بداخلها.',
  '{"blank-l2-4-1:word-peristalsis|blank-l2-4-2:word-accessories":"تندفع البلعة بالحركة الدودية، وتُصنّف الغدد اللعابية والكبد والبنكرياس ضمن ملحقات القناة الهضمية."}'::jsonb
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_answer_keys (
  content_version_id, activity_id, canonical_correct_answer, answer_key_payload_json,
  scientific_hint_ar, scientific_explanation_ar, option_feedback_json
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l2-5', 'zone-a:lbl-pharynx|zone-b:lbl-epiglottis|zone-c:lbl-esophagus|zone-d:lbl-stomach',
  '{"type":"image_identification","correctOptionId":"zone-a:lbl-pharynx|zone-b:lbl-epiglottis|zone-c:lbl-esophagus|zone-d:lbl-stomach","mode":"label_placement","correctZoneId":null,"labelsToPlace":[{"labelId":"lbl-pharynx","correctZoneId":"zone-a"},{"labelId":"lbl-epiglottis","correctZoneId":"zone-b"},{"labelId":"lbl-esophagus","correctZoneId":"zone-c"},{"labelId":"lbl-stomach","correctZoneId":"zone-d"}]}'::jsonb, '(أ) التجويف العلوي المشترك، (ب) الصمام الغضروفي أعلى القصبة الهوائية، (ج) الأنبوب العضلي الذي تتحرك فيه اللقمة، (د) الكيس العضلي السفلي.', '(أ) البلعوم، (ب) لسان المزمار الذي يؤمّن مجرى التنفس، (ج) المريء الذي يدفع اللقمة بالحركة الدودية، و(د) المعدة.',
  '{"zone-a:lbl-pharynx|zone-b:lbl-epiglottis|zone-c:lbl-esophagus|zone-d:lbl-stomach":"وضعت جميع المسميات التشريحية الأربعة في مواضعها الصحيحة على المخطط."}'::jsonb
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_answer_keys (
  content_version_id, activity_id, canonical_correct_answer, answer_key_payload_json,
  scientific_hint_ar, scientific_explanation_ar, option_feedback_json
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l3-1', 'zone-c',
  '{"type":"image_identification","correctOptionId":"zone-c","mode":"hotspot_select","correctZoneId":"zone-c","labelsToPlace":[]}'::jsonb, 'ابحث عن التراكيب الغدية الثلاثة المتصلة بتجويف الفم عبر قنوات إفرازية، وليست الأسنان أو اللسان.', 'الموضع (ج) يمثّل الغدد اللعابية (ثلاثة أزواج) التي تفرز اللعاب لترطيب الطعام وبدء هضم النشويات كيميائياً.',
  '{"zone-a":"الموضع (أ) يمثّل الأسنان المسؤولة عن التقطيع والطحن الميكانيكي.","zone-b":"الموضع (ب) يمثّل اللسان المسؤول عن تقليب الطعام والتذوق.","zone-c":"إجابة صحيحة! الموضع (ج) يمثّل الغدد اللعابية التي تفرز اللعاب في تجويف الفم.","zone-d":"الموضع (د) يمثّل البلعوم الذي يمر عبره الطعام بعد بلعه."}'::jsonb
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_answer_keys (
  content_version_id, activity_id, canonical_correct_answer, answer_key_payload_json,
  scientific_hint_ar, scientific_explanation_ar, option_feedback_json
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l3-2', 'opt-l3-2a',
  '{"type":"multiple_choice","correctOptionId":"opt-l3-2a"}'::jsonb, 'الخبز غني بالنشويات، ويحتوي اللعاب على إنزيم الأميليز المتخصص.', 'يحتوي اللعاب على إنزيم الأميليز الذي يفكك النشويات كيميائياً في الفم ويحولها إلى سكريات أبسط، إضافة إلى ترطيب الطعام لتسهيل بلعه.',
  '{"opt-l3-2a":"أحسنت! يبدأ اللعاب الهضم الكيميائي للنشويات في الفم ويحوّلها إلى سكريات أبسط.","opt-l3-2b":"تجزئة الدهون تتم في الاثني عشر بواسطة العصارة الصفراوية وليس اللعاب.","opt-l3-2c":"امتصاص الماء من بقايا الطعام يحدث في الأمعاء الغليظة."}'::jsonb
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_answer_keys (
  content_version_id, activity_id, canonical_correct_answer, answer_key_payload_json,
  scientific_hint_ar, scientific_explanation_ar, option_feedback_json
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l3-3', 'blank-l3-3-1:word-teeth|blank-l3-3-2:word-starch',
  '{"type":"fill_in","correctOptionId":"blank-l3-3-1:word-teeth|blank-l3-3-2:word-starch","blanks":[{"blankId":"blank-l3-3-1","correctWordId":"word-teeth"},{"blankId":"blank-l3-3-2","correctWordId":"word-starch"}]}'::jsonb, 'الأسنان تفتت الطعام واللسان يقلبه، بينما يحتوي اللعاب على إنزيم يحول النشويات إلى سكريات.', 'تقوم الأسنان بتقطيع الطعام وطحنه لزيادة مساحة سطحه، ويقلبه اللسان ويمزجه باللعاب الذي يحوّل النشويات إلى سكريات أبسط.',
  '{"blank-l3-3-1:word-teeth|blank-l3-3-2:word-starch":"الأسنان تطحن الطعام ميكانيكياً، واللعاب يحوّل النشويات كيميائياً إلى سكريات أبسط."}'::jsonb
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_answer_keys (
  content_version_id, activity_id, canonical_correct_answer, answer_key_payload_json,
  scientific_hint_ar, scientific_explanation_ar, option_feedback_json
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l3-4', 'opt-l3-4a',
  '{"type":"multiple_choice","correctOptionId":"opt-l3-4a"}'::jsonb, 'تذكّر العنصر الغذائي البنائي الموجود في اللحوم والبيض والبقوليات الذي يبدأ هضمه في المعدة.', 'تفرز المعدة حمض الهيدروكلوريك الذي يقتل البكتيريا الضارة وينشط إنزيم الببسين لهضم البروتينات جزئياً وتحويل الطعام إلى سائل كثيف يُسمى الكيموس.',
  '{"opt-l3-4a":"إجابة صحيحة؛ فالعصارة المعدية توفر وسطاً حمضياً يعمل فيه الببسين على هضم البروتينات جزئياً.","opt-l3-4b":"اللعاب يُفرز من الغدد اللعابية في الفم وليس في المعدة.","opt-l3-4c":"الامتصاص عبر الخملات يحدث في الأمعاء الدقيقة بعد اكتمال الهضم."}'::jsonb
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_answer_keys (
  content_version_id, activity_id, canonical_correct_answer, answer_key_payload_json,
  scientific_hint_ar, scientific_explanation_ar, option_feedback_json
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l3-5', 'juice-bile:fn-bile|juice-gastric:fn-gastric|juice-pancreatic:fn-pancreatic|juice-saliva:fn-saliva',
  '{"type":"matching","correctOptionId":"juice-bile:fn-bile|juice-gastric:fn-gastric|juice-pancreatic:fn-pancreatic|juice-saliva:fn-saliva","correctPairs":[{"promptId":"juice-saliva","targetId":"fn-saliva"},{"promptId":"juice-gastric","targetId":"fn-gastric"},{"promptId":"juice-bile","targetId":"fn-bile"},{"promptId":"juice-pancreatic","targetId":"fn-pancreatic"}]}'::jsonb, 'اربط كل عصارة بالمادة الغذائية التي تعمل عليها (النشويات في الفم، البروتينات في المعدة، الدهون بالعصارة الصفراوية، واستكمال الهضم في الأمعاء).', 'اللعاب يهضم النشويات، والعصارة المعدية تهضم البروتينات جزئياً، والعصارة الصفراوية تجزئ الدهون لمستحلب دهني، والعصارة البنكرياسية والمعوية تستكمل الهضم الكامل.',
  '{"juice-bile:fn-bile|juice-gastric:fn-gastric|juice-pancreatic:fn-pancreatic|juice-saliva:fn-saliva":"توصيل علمي متكامل لجميع العصارات الهاضمة ووظائفها."}'::jsonb
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_answer_keys (
  content_version_id, activity_id, canonical_correct_answer, answer_key_payload_json,
  scientific_hint_ar, scientific_explanation_ar, option_feedback_json
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l3-6', 'step-j1>step-j2>step-j3>step-j4',
  '{"type":"ordering","correctOptionId":"step-j1>step-j2>step-j3>step-j4","correctOrderIds":["step-j1","step-j2","step-j3","step-j4"]}'::jsonb, 'تذكّر الترتيب التشريحي: الفم (اللعاب) ثم المعدة (العصارة المعدية) ثم الاثنا عشر (الصفراوية والبنكرياسية) وأخيراً العصارة المعوية.', 'يبدأ الهضم الكيميائي باللعاب في الفم، ثم العصارة المعدية في المعدة، ثم تصب العصارة الصفراوية والبنكرياسية في الاثني عشر، وتختتم العصارة المعوية الهضم الكامل.',
  '{"step-j1>step-j2>step-j3>step-j4":"ترتيب علمي دقيق لتتابع عمل العصارات الهاضمة على الغذاء."}'::jsonb
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_answer_keys (
  content_version_id, activity_id, canonical_correct_answer, answer_key_payload_json,
  scientific_hint_ar, scientific_explanation_ar, option_feedback_json
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l3-7', 'zone-a:lbl-saliva|zone-b:lbl-gastric|zone-c:lbl-bile|zone-d:lbl-pancreatic',
  '{"type":"image_identification","correctOptionId":"zone-a:lbl-saliva|zone-b:lbl-gastric|zone-c:lbl-bile|zone-d:lbl-pancreatic","mode":"label_placement","correctZoneId":null,"labelsToPlace":[{"labelId":"lbl-saliva","correctZoneId":"zone-a"},{"labelId":"lbl-gastric","correctZoneId":"zone-b"},{"labelId":"lbl-bile","correctZoneId":"zone-c"},{"labelId":"lbl-pancreatic","correctZoneId":"zone-d"}]}'::jsonb, '(أ) غدد الفم، (ب) المعدة، (ج) الكبد والحويصلة الصفراوية، (د) البنكرياس والأمعاء الدقيقة.', '(أ) اللعاب من الغدد اللعابية، (ب) العصارة المعدية من المعدة، (ج) العصارة الصفراوية من الكبد، و(د) العصارة البنكرياسية والمعوية من البنكرياس والأمعاء الدقيقة.',
  '{"zone-a:lbl-saliva|zone-b:lbl-gastric|zone-c:lbl-bile|zone-d:lbl-pancreatic":"توزيع تشريحي صحيح لجميع العصارات الهاضمة على الأعضاء المفرزة لها."}'::jsonb
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_answer_keys (
  content_version_id, activity_id, canonical_correct_answer, answer_key_payload_json,
  scientific_hint_ar, scientific_explanation_ar, option_feedback_json
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l4-1', 'opt-l4-1a',
  '{"type":"multiple_choice","correctOptionId":"opt-l4-1a"}'::jsonb, 'بعد تحول الغذاء إلى جزيئات بسيطة ذائبة، يحتاج إلى الوصول إلى الدم ليتوزع على خلايا الجسم.', 'تحدث عملية الامتصاص في الأمعاء الدقيقة، حيث تنتقل الجزيئات الغذائية المهضومة عبر جدار الأمعاء الدقيقة إلى الدم واللمف.',
  '{"opt-l4-1a":"إجابة صحيحة؛ فالأمعاء الدقيقة هي الموقع الرئيسي لامتصاص الغذاء المهضوم ونقله إلى الدم.","opt-l4-1b":"الغذاء المهضوم يمتصه الجسم ليحصل على الطاقة، بينما البقايا غير المهضومة فقط هي التي تخرج.","opt-l4-1c":"لا يعود الغذاء المهضوم إلى المعدة بل يعبر جدار الأمعاء الدقيقة إلى الدم."}'::jsonb
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_answer_keys (
  content_version_id, activity_id, canonical_correct_answer, answer_key_payload_json,
  scientific_hint_ar, scientific_explanation_ar, option_feedback_json
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l4-2', 'zone-a',
  '{"type":"image_identification","correctOptionId":"zone-a","mode":"hotspot_select","correctZoneId":"zone-a","labelsToPlace":[]}'::jsonb, 'ابحث عن الغدة الكبيرة بنية اللون الواقعة أعلى يمين التجويف البطني فوق الحويصلة الصفراوية.', 'الموضع (أ) هو الكبد، وهو أكبر غدة في الجسم؛ يفرز العصارة الصفراوية التي تُخزن في الحويصلة الصفراوية (ب) وتصب في الاثني عشر (د).',
  '{"zone-a":"إجابة صحيحة! الموضع (أ) هو الكبد المسؤول عن إفراز العصارة الصفراوية وتنظيم الغذاء الممتص.","zone-b":"الموضع (ب) هو الحويصلة الصفراوية التي تخزّن العصارة الصفراوية ولا تنتجها.","zone-c":"الموضع (ج) هو البنكرياس الذي يفرز العصارة البنكرياسية.","zone-d":"الموضع (د) هو الاثنا عشر الذي تصب فيه العصارات."}'::jsonb
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_answer_keys (
  content_version_id, activity_id, canonical_correct_answer, answer_key_payload_json,
  scientific_hint_ar, scientific_explanation_ar, option_feedback_json
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l4-3', 'blank-l4-3-1:word-bile|blank-l4-3-2:word-toxins',
  '{"type":"fill_in","correctOptionId":"blank-l4-3-1:word-bile|blank-l4-3-2:word-toxins","blanks":[{"blankId":"blank-l4-3-1","correctWordId":"word-bile"},{"blankId":"blank-l4-3-2","correctWordId":"word-toxins"}]}'::jsonb, 'يساهم الكبد في تجزئة الدهون بالعصارة الصفراوية، كما ينقي الدم القادم من الأمعاء ويخزن السكر الزائد.', 'يفرز الكبد العصارة الصفراوية لتجزئة الدهون إلى مستحلب دهني، وبعد الامتصاص يستقبل الدم القادم من الأمعاء لتخليصه من السموم وتنظيم مستوى السكر.',
  '{"blank-l4-3-1:word-bile|blank-l4-3-2:word-toxins":"الكبد يفرز العصارة الصفراوية لتجزئة الدهون وينقّي الدم الممتص من السموم."}'::jsonb
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_answer_keys (
  content_version_id, activity_id, canonical_correct_answer, answer_key_payload_json,
  scientific_hint_ar, scientific_explanation_ar, option_feedback_json
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l4-4', 'p-duodenum:t-duodenum|p-gallbladder:t-gallbladder|p-ileum:t-ileum|p-liver:t-liver',
  '{"type":"matching","correctOptionId":"p-duodenum:t-duodenum|p-gallbladder:t-gallbladder|p-ileum:t-ileum|p-liver:t-liver","correctPairs":[{"promptId":"p-liver","targetId":"t-liver"},{"promptId":"p-gallbladder","targetId":"t-gallbladder"},{"promptId":"p-duodenum","targetId":"t-duodenum"},{"promptId":"p-ileum","targetId":"t-ileum"}]}'::jsonb, 'فرّق بين إنتاج العصارة الصفراوية (الكبد)، تخزينها (الحويصلة الصفراوية)، استقبالها (الاثنا عشر)، وامتصاص الغذاء (اللفائفي).', 'الكبد ينتج العصارة الصفراوية وينظم الغذاء الممتص، والحويصلة الصفراوية تخزن العصارة الصفراوية، والاثنا عشر يستقبل عصارات الكبد والبنكرياس، واللفائفي يتم فيه امتصاص الغذاء المهضوم.',
  '{"p-duodenum:t-duodenum|p-gallbladder:t-gallbladder|p-ileum:t-ileum|p-liver:t-liver":"توصيل علمي صحيح يوضح تكامل الكبد والأمعاء الدقيقة."}'::jsonb
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_answer_keys (
  content_version_id, activity_id, canonical_correct_answer, answer_key_payload_json,
  scientific_hint_ar, scientific_explanation_ar, option_feedback_json
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l5-1', 'crit-capillary-rich:villi_surface|crit-low-absorption:smooth_surface|crit-surface-area:villi_surface||conc:conc-villi-correct',
  '{"type":"villi_comparison","correctOptionId":"crit-capillary-rich:villi_surface|crit-low-absorption:smooth_surface|crit-surface-area:villi_surface||conc:conc-villi-correct","correctConclusionId":"conc-villi-correct","criteria":[{"criterionId":"crit-surface-area","correctSurfaceId":"villi_surface"},{"criterionId":"crit-low-absorption","correctSurfaceId":"smooth_surface"},{"criterionId":"crit-capillary-rich","correctSurfaceId":"villi_surface"}]}'::jsonb, 'انظر كيف تزيد الانثناءات الإصبعية (الخملات) من المساحة الملامسة للغذاء المهضوم مقارنة بالسطح المستوي الأملس.', 'السطح الغني بالخملات (النموذج ب) يوفر مساحة سطح تلامس أكبر بعدة أضعاف ومعدل امتصاص أسرع بكثير من السطح الأملس (النموذج أ) الذي تمر فيه جزيئات الغذاء دون امتصاص كافٍ.',
  '{"crit-capillary-rich:villi_surface|crit-low-absorption:smooth_surface|crit-surface-area:villi_surface||conc:conc-villi-correct":"مقارنة علمية مكتملة وصحيحة بين السطح الأملس والسطح المزوّد بالخملات."}'::jsonb
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_answer_keys (
  content_version_id, activity_id, canonical_correct_answer, answer_key_payload_json,
  scientific_hint_ar, scientific_explanation_ar, option_feedback_json
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l5-2', 'zone-a:lbl-epithelium|zone-b:lbl-capillaries|zone-c:lbl-lacteal|zone-d:lbl-base-vessels',
  '{"type":"image_identification","correctOptionId":"zone-a:lbl-epithelium|zone-b:lbl-capillaries|zone-c:lbl-lacteal|zone-d:lbl-base-vessels","mode":"label_placement","correctZoneId":null,"labelsToPlace":[{"labelId":"lbl-epithelium","correctZoneId":"zone-a"},{"labelId":"lbl-capillaries","correctZoneId":"zone-b"},{"labelId":"lbl-lacteal","correctZoneId":"zone-c"},{"labelId":"lbl-base-vessels","correctZoneId":"zone-d"}]}'::jsonb, '(أ) الجدار الخارجي الرقيق للخملة، (ب) الشبكة المتفرعة الحمراء والزرقاء، (ج) الوعاء الأوسط الأخضر، (د) قاعدة الجدار وأوعية النقل.', 'تتكون الخملة من (أ) طبقة طلائية رقيقة، وبداخلها (ب) شبكة شعيرات دموية لامتصاص السكريات والأحماض الأمينية، و(ج) وعاء لمفاوي لامتصاص الأحماض الدهنية، وتتصل بـ(د) أوعية قاعدة الجدار.',
  '{"zone-a:lbl-epithelium|zone-b:lbl-capillaries|zone-c:lbl-lacteal|zone-d:lbl-base-vessels":"تسمية تشريحية دقيقة لجميع أجزاء الخملة المعوية تحت المجهر."}'::jsonb
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_answer_keys (
  content_version_id, activity_id, canonical_correct_answer, answer_key_payload_json,
  scientific_hint_ar, scientific_explanation_ar, option_feedback_json
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l5-3', 'opt-l5-3a',
  '{"type":"multiple_choice","correctOptionId":"opt-l5-3a"}'::jsonb, 'فكّر في المسافة التي تقطعها جزيئات الغذاء المهضوم للعبور من تجويف الأمعاء إلى داخل الدم.', 'رقة جدار الخملة المعوية وغزارة الشعيرات الدموية بداخلها يسهّلان عبور الجزيئات الغذائية المهضومة بسرعة وكفاءة عالية إلى الدورة الدموية.',
  '{"opt-l5-3a":"إجابة صحيحة؛ فرقة الجدار تقصّر مسافة الانتشار، والشعيرات الدموية تنقل الغذاء فوراً.","opt-l5-3b":"وظيفة الخملات هي السماح بامتصاص الغذاء المهضوم وليس منعه.","opt-l5-3c":"حمض الهيدروكلوريك يُفرز في المعدة وليس في الخملات المعوية."}'::jsonb
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_answer_keys (
  content_version_id, activity_id, canonical_correct_answer, answer_key_payload_json,
  scientific_hint_ar, scientific_explanation_ar, option_feedback_json
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l5-4', 'abs-step-1>abs-step-2>abs-step-3>abs-step-4',
  '{"type":"ordering","correctOptionId":"abs-step-1>abs-step-2>abs-step-3>abs-step-4","correctOrderIds":["abs-step-1","abs-step-2","abs-step-3","abs-step-4"]}'::jsonb, 'ابدأ بعبور الجدار الرقيق للخملة، ثم دخول الشعيرات الدموية، ثم المرور بالكبد والقلب، وأخيراً الوصول لخلايا الجسم.', 'تعبر الجزيئات الغذائية المهضومة الجدار الطلائي الرقيق للخملة، ثم تدخل الشعيرات الدموية داخل الخملة، وتنتقل عبر الوريد البابي إلى الكبد ثم القلب الذي يضخ الدم المحمّل بالغذاء لكافة خلايا الجسم.',
  '{"abs-step-1>abs-step-2>abs-step-3>abs-step-4":"تسلسل علمي دقيق لمسار امتصاص الغذاء وتوزيعه."}'::jsonb
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_answer_keys (
  content_version_id, activity_id, canonical_correct_answer, answer_key_payload_json,
  scientific_hint_ar, scientific_explanation_ar, option_feedback_json
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l6-1', 'zone-c',
  '{"type":"image_identification","correctOptionId":"zone-c","mode":"hotspot_select","correctZoneId":"zone-c","labelsToPlace":[]}'::jsonb, 'تتبّع القولون (ب) حتى نهايته السفلية المستقيمة في أسفل المخطط التشريحي.', 'الموضع (ج) يمثّل المستقيم، وهو الجزء النهائي من الأمعاء الغليظة الذي تتجمع فيه الفضلات بعد امتصاص الماء والأملاح منها في القولون (ب).',
  '{"zone-a":"الموضع (أ) هو بداية دخول البقايا إلى الأمعاء الغليظة وليس نهايتها.","zone-b":"الموضع (ب) هو القولون حيث يتم امتصاص الماء والأملاح.","zone-c":"إجابة صحيحة! الموضع (ج) هو المستقيم الذي تتجمع فيه الفضلات قبل طردها خارج الجسم.","zone-d":"الموضع (د) يشير إلى عملية إعادة امتصاص الماء عبر جدار القولون."}'::jsonb
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_answer_keys (
  content_version_id, activity_id, canonical_correct_answer, answer_key_payload_json,
  scientific_hint_ar, scientific_explanation_ar, option_feedback_json
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l6-2', 'blank-l6-2-1:word-water|blank-l6-2-2:word-rectum',
  '{"type":"fill_in","correctOptionId":"blank-l6-2-1:word-water|blank-l6-2-2:word-rectum","blanks":[{"blankId":"blank-l6-2-1","correctWordId":"word-water"},{"blankId":"blank-l6-2-2","correctWordId":"word-rectum"}]}'::jsonb, 'تمتص الأمعاء الغليظة السوائل المهمة للجسم وتدفع البقايا المتماسكة نحو المستقيم.', 'تمتص الأمعاء الغليظة الماء والأملاح المعدنية من بقايا الطعام غير المهضوم لحماية الجسم من الجفاف، ثم تتجمع الفضلات في المستقيم لطردها خارج الجسم.',
  '{"blank-l6-2-1:word-water|blank-l6-2-2:word-rectum":"تستعيد الأمعاء الغليظة الماء والأملاح، وتتجمع الفضلات في المستقيم تمهيداً لإخراجها."}'::jsonb
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_answer_keys (
  content_version_id, activity_id, canonical_correct_answer, answer_key_payload_json,
  scientific_hint_ar, scientific_explanation_ar, option_feedback_json
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l6-3', 'ex-chew:ef-chew|ex-colon:ef-colon|ex-fiber:ef-fiber|ex-rectum:ef-rectum',
  '{"type":"matching","correctOptionId":"ex-chew:ef-chew|ex-colon:ef-colon|ex-fiber:ef-fiber|ex-rectum:ef-rectum","correctPairs":[{"promptId":"ex-colon","targetId":"ef-colon"},{"promptId":"ex-rectum","targetId":"ef-rectum"},{"promptId":"ex-fiber","targetId":"ef-fiber"},{"promptId":"ex-chew","targetId":"ef-chew"}]}'::jsonb, 'اربط بين وظيفة القولون والمستقيم وبين دور الألياف الغذائية والماء في تسهيل حركة الفضلات.', 'الأمعاء الغليظة تعيد امتصاص الماء، والمستقيم يجمع الفضلات قبل طردها، والألياف الغذائية في الخضروات والفواكه تنظم حركة الأمعاء وتمنع الإمساك، والمضغ الجيد يسهل عمل العصارات الهاضمة.',
  '{"ex-chew:ef-chew|ex-colon:ef-colon|ex-fiber:ef-fiber|ex-rectum:ef-rectum":"توصيل علمي وصحي متكامل لوظائف الإخراج وصحة الجهاز الهضمي."}'::jsonb
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_answer_keys (
  content_version_id, activity_id, canonical_correct_answer, answer_key_payload_json,
  scientific_hint_ar, scientific_explanation_ar, option_feedback_json
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l6-4', 'ex-step-1>ex-step-2>ex-step-3>ex-step-4',
  '{"type":"ordering","correctOptionId":"ex-step-1>ex-step-2>ex-step-3>ex-step-4","correctOrderIds":["ex-step-1","ex-step-2","ex-step-3","ex-step-4"]}'::jsonb, 'ابدأ بانتقال البقايا السائلة من الأمعاء الدقيقة إلى الغليظة، ثم امتصاص الماء والأملاح، ثم تجمع الفضلات في المستقيم، وأخيراً طردها عبر فتحة الشرج.', 'تنتقل بقايا الطعام غير المهضوم من الأمعاء الدقيقة إلى الأمعاء الغليظة، فتمتص الأمعاء الغليظة الماء والأملاح المعدنية، وتتحول البقايا إلى فضلات متماسكة تتجمع في المستقيم ثم تُطرد عبر فتحة الشرج.',
  '{"ex-step-1>ex-step-2>ex-step-3>ex-step-4":"ترتيب علمي دقيق لمراحل عمل الأمعاء الغليظة والتخلص من بقايا الطعام غير المهضوم."}'::jsonb
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;

-- 5. Insert 26 Activity-to-Topic Mappings for Review Recommendations
INSERT INTO public.activity_topic_mappings (
  content_version_id, activity_id, level_id, level_order, topic_id, topic_title_ar, approved_explanation_ar
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l1-1', 'lvl-station-1-mouth', 1,
  'topic-digestion-concept', 'المفهوم العلمي لعملية الهضم وتحويل الغذاء المعقد إلى بسيط', 'عملية الهضم هي تحويل جزيئات الطعام الكبيرة والمعقدة غير القابلة للذوبان إلى جزيئات أصغر وأبسط قابلة للذوبان والامتصاص ليستفيد منها الجسم.'
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_topic_mappings (
  content_version_id, activity_id, level_id, level_order, topic_id, topic_title_ar, approved_explanation_ar
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l1-2', 'lvl-station-1-mouth', 1,
  'topic-digestion-importance', 'أهمية عملية الهضم في إمداد خلايا الجسم بالطاقة والنمو', 'يحوّل الجهاز الهضمي جزيئات الطعام المعقدة إلى مواد بسيطة قابلة للامتصاص ليحصل الجسم على الطاقة اللازمة للنمو والنشاط.'
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_topic_mappings (
  content_version_id, activity_id, level_id, level_order, topic_id, topic_title_ar, approved_explanation_ar
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l2-1', 'lvl-station-2-esophagus', 2,
  'topic-esophagus-location', 'الموقع التشريحي للمريء وربطه بين البلعوم والمعدة', 'الموضع (ب) هو المعدة، وهي كيس عضلي يقع في أعلى يسار البطن يستقبل الطعام القادم عبر المريء (أ) قبل دفعه إلى الأمعاء الدقيقة (ج).'
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_topic_mappings (
  content_version_id, activity_id, level_id, level_order, topic_id, topic_title_ar, approved_explanation_ar
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l2-2', 'lvl-station-2-esophagus', 2,
  'topic-tract-vs-accessory', 'التمييز بين أعضاء القناة الهضمية وملحقات القناة الهضمية', 'يمر الطعام بالترتيب عبر: الفم ← البلعوم ← المريء ← المعدة ← الأمعاء الدقيقة ← الأمعاء الغليظة.'
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_topic_mappings (
  content_version_id, activity_id, level_id, level_order, topic_id, topic_title_ar, approved_explanation_ar
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l2-3', 'lvl-station-2-esophagus', 2,
  'topic-epiglottis-swallowing', 'دور البلعوم ولسان المزمار في حماية مجرى التنفس أثناء البلع', 'البلعوم ممر مشترك للطعام والهواء، ولسان المزمار يغلق القصبة الهوائية عند البلع، والمريء ينقل الطعام للمعدة بالحركة الدودية، والمعدة كيس عضلي يخلط الطعام.'
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_topic_mappings (
  content_version_id, activity_id, level_id, level_order, topic_id, topic_title_ar, approved_explanation_ar
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l2-4', 'lvl-station-2-esophagus', 2,
  'topic-alimentary-pathway', 'الترتيب التشريحي المتسلسل لأعضاء القناة الهضمية من الفم للمستقيم', 'يندفع الطعام داخل المريء بفعل الحركة الدودية، بينما تُعد الغدد اللعابية والكبد والبنكرياس من ملحقات القناة الهضمية التي تفرز عصاراتها دون مرور الطعام بداخلها.'
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_topic_mappings (
  content_version_id, activity_id, level_id, level_order, topic_id, topic_title_ar, approved_explanation_ar
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l2-5', 'lvl-station-2-esophagus', 2,
  'topic-digestive-organs-functions', 'مواضع ووظائف أعضاء الجهاز الهضمي وملحقاته على الرسم التشريحي', '(أ) البلعوم، (ب) لسان المزمار الذي يؤمّن مجرى التنفس، (ج) المريء الذي يدفع اللقمة بالحركة الدودية، و(د) المعدة.'
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_topic_mappings (
  content_version_id, activity_id, level_id, level_order, topic_id, topic_title_ar, approved_explanation_ar
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l3-1', 'lvl-station-3-stomach', 3,
  'topic-salivary-amylase', 'الغدد اللعابية وإنزيم الأميليز وتحويل النشويات إلى سكريات بسيطة', 'الموضع (ج) يمثّل الغدد اللعابية (ثلاثة أزواج) التي تفرز اللعاب لترطيب الطعام وبدء هضم النشويات كيميائياً.'
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_topic_mappings (
  content_version_id, activity_id, level_id, level_order, topic_id, topic_title_ar, approved_explanation_ar
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l3-2', 'lvl-station-3-stomach', 3,
  'topic-teeth-tongue-mechanical', 'الهضم الميكانيكي في الفم: وظائف الأسنان واللسان واللعاب', 'يحتوي اللعاب على إنزيم الأميليز الذي يفكك النشويات كيميائياً في الفم ويحولها إلى سكريات أبسط، إضافة إلى ترطيب الطعام لتسهيل بلعه.'
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_topic_mappings (
  content_version_id, activity_id, level_id, level_order, topic_id, topic_title_ar, approved_explanation_ar
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l3-3', 'lvl-station-3-stomach', 3,
  'topic-stomach-gastric-juice', 'العصارة المعدية وهضم البروتينات جزئياً داخل المعدة', 'تقوم الأسنان بتقطيع الطعام وطحنه لزيادة مساحة سطحه، ويقلبه اللسان ويمزجه باللعاب الذي يحوّل النشويات إلى سكريات أبسط.'
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_topic_mappings (
  content_version_id, activity_id, level_id, level_order, topic_id, topic_title_ar, approved_explanation_ar
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l3-4', 'lvl-station-3-stomach', 3,
  'topic-pancreas-duodenum-anatomy', 'تحديد موقع البنكرياس والاثني عشر وإفراز العصارة البنكرياسية', 'تفرز المعدة حمض الهيدروكلوريك الذي يقتل البكتيريا الضارة وينشط إنزيم الببسين لهضم البروتينات جزئياً وتحويل الطعام إلى سائل كثيف يُسمى الكيموس.'
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_topic_mappings (
  content_version_id, activity_id, level_id, level_order, topic_id, topic_title_ar, approved_explanation_ar
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l3-5', 'lvl-station-3-stomach', 3,
  'topic-five-digestive-juices', 'مقارنة العصارات الهاضمة الخمس ومصادر إفرازها ووظائفها', 'اللعاب يهضم النشويات، والعصارة المعدية تهضم البروتينات جزئياً، والعصارة الصفراوية تجزئ الدهون لمستحلب دهني، والعصارة البنكرياسية والمعوية تستكمل الهضم الكامل.'
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_topic_mappings (
  content_version_id, activity_id, level_id, level_order, topic_id, topic_title_ar, approved_explanation_ar
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l3-6', 'lvl-station-3-stomach', 3,
  'topic-complete-digestion-small-intestine', 'اكتمال الهضم الكيميائي في الأمعاء الدقيقة بفعل العصارة المعوية', 'يبدأ الهضم الكيميائي باللعاب في الفم، ثم العصارة المعدية في المعدة، ثم تصب العصارة الصفراوية والبنكرياسية في الاثني عشر، وتختتم العصارة المعوية الهضم الكامل.'
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_topic_mappings (
  content_version_id, activity_id, level_id, level_order, topic_id, topic_title_ar, approved_explanation_ar
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l3-7', 'lvl-station-3-stomach', 3,
  'topic-chemical-digestion-sequence', 'تتابع مراحل الهضم الكيميائي للنشويات والبروتينات والدهون', '(أ) اللعاب من الغدد اللعابية، (ب) العصارة المعدية من المعدة، (ج) العصارة الصفراوية من الكبد، و(د) العصارة البنكرياسية والمعوية من البنكرياس والأمعاء الدقيقة.'
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_topic_mappings (
  content_version_id, activity_id, level_id, level_order, topic_id, topic_title_ar, approved_explanation_ar
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l4-1', 'lvl-station-4-small-intestine', 4,
  'topic-liver-bile-emulsification', 'إفراز الكبد للعصارة الصفراوية وتجزئة الدهون إلى مستحلب دهني', 'تحدث عملية الامتصاص في الأمعاء الدقيقة، حيث تنتقل الجزيئات الغذائية المهضومة عبر جدار الأمعاء الدقيقة إلى الدم واللمف.'
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_topic_mappings (
  content_version_id, activity_id, level_id, level_order, topic_id, topic_title_ar, approved_explanation_ar
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l4-2', 'lvl-station-4-small-intestine', 4,
  'topic-hepatic-portal-anatomy', 'التشريح الوظيفي للكبد والحويصلة الصفراوية والوريد البابي الكبدي', 'الموضع (أ) هو الكبد، وهو أكبر غدة في الجسم؛ يفرز العصارة الصفراوية التي تُخزن في الحويصلة الصفراوية (ب) وتصب في الاثني عشر (د).'
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_topic_mappings (
  content_version_id, activity_id, level_id, level_order, topic_id, topic_title_ar, approved_explanation_ar
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l4-3', 'lvl-station-4-small-intestine', 4,
  'topic-nutrient-absorption-definition', 'مفهوم الامتصاص وانتقال الغذاء المهضوم من الأمعاء الدقيقة إلى الدم', 'يفرز الكبد العصارة الصفراوية لتجزئة الدهون إلى مستحلب دهني، وبعد الامتصاص يستقبل الدم القادم من الأمعاء لتخليصه من السموم وتنظيم مستوى السكر.'
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_topic_mappings (
  content_version_id, activity_id, level_id, level_order, topic_id, topic_title_ar, approved_explanation_ar
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l4-4', 'lvl-station-4-small-intestine', 4,
  'topic-liver-metabolic-detox', 'دور الكبد في تنظيم مستوى السكر وتنقية الدم من السموم', 'الكبد ينتج العصارة الصفراوية وينظم الغذاء الممتص، والحويصلة الصفراوية تخزن العصارة الصفراوية، والاثنا عشر يستقبل عصارات الكبد والبنكرياس، واللفائفي يتم فيه امتصاص الغذاء المهضوم.'
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_topic_mappings (
  content_version_id, activity_id, level_id, level_order, topic_id, topic_title_ar, approved_explanation_ar
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l5-1', 'lvl-station-5-absorption', 5,
  'topic-villi-surface-area', 'وظيفة الخملات في مضاعفة مساحة سطح الامتصاص بالأمعاء الدقيقة', 'السطح الغني بالخملات (النموذج ب) يوفر مساحة سطح تلامس أكبر بعدة أضعاف ومعدل امتصاص أسرع بكثير من السطح الأملس (النموذج أ) الذي تمر فيه جزيئات الغذاء دون امتصاص كافٍ.'
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_topic_mappings (
  content_version_id, activity_id, level_id, level_order, topic_id, topic_title_ar, approved_explanation_ar
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l5-2', 'lvl-station-5-absorption', 5,
  'topic-villi-microstructure', 'التركيب الدقيق للخملة: الطبقة الطلائية والشعيرات الدموية والوعاء اللمفاوي', 'تتكون الخملة من (أ) طبقة طلائية رقيقة، وبداخلها (ب) شبكة شعيرات دموية لامتصاص السكريات والأحماض الأمينية، و(ج) وعاء لمفاوي لامتصاص الأحماض الدهنية، وتتصل بـ(د) أوعية قاعدة الجدار.'
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_topic_mappings (
  content_version_id, activity_id, level_id, level_order, topic_id, topic_title_ar, approved_explanation_ar
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l5-3', 'lvl-station-5-absorption', 5,
  'topic-villi-vs-smooth-comparison', 'المقارنة العملية بين السطح الأملس والسطح الغني بالخملات في كفاءة الامتصاص', 'رقة جدار الخملة المعوية وغزارة الشعيرات الدموية بداخلها يسهّلان عبور الجزيئات الغذائية المهضومة بسرعة وكفاءة عالية إلى الدورة الدموية.'
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_topic_mappings (
  content_version_id, activity_id, level_id, level_order, topic_id, topic_title_ar, approved_explanation_ar
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l5-4', 'lvl-station-5-absorption', 5,
  'topic-villi-capillaries-transport', 'آلية عبور الجلوكوز والأحماض الأمينية والدهنية عبر جدران الخملات للدم واللمف', 'تعبر الجزيئات الغذائية المهضومة الجدار الطلائي الرقيق للخملة، ثم تدخل الشعيرات الدموية داخل الخملة، وتنتقل عبر الوريد البابي إلى الكبد ثم القلب الذي يضخ الدم المحمّل بالغذاء لكافة خلايا الجسم.'
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_topic_mappings (
  content_version_id, activity_id, level_id, level_order, topic_id, topic_title_ar, approved_explanation_ar
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l6-1', 'lvl-station-6-large-intestine', 6,
  'topic-large-intestine-water-absorption', 'وظيفة الأمعاء الغليظة في امتصاص الماء والأملاح المعدنية من الفضلات', 'الموضع (ج) يمثّل المستقيم، وهو الجزء النهائي من الأمعاء الغليظة الذي تتجمع فيه الفضلات بعد امتصاص الماء والأملاح منها في القولون (ب).'
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_topic_mappings (
  content_version_id, activity_id, level_id, level_order, topic_id, topic_title_ar, approved_explanation_ar
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l6-2', 'lvl-station-6-large-intestine', 6,
  'topic-colon-rectum-anatomy', 'التحديد التشريحي للقولون والمستقيم في نهاية القناة الهضمية', 'تمتص الأمعاء الغليظة الماء والأملاح المعدنية من بقايا الطعام غير المهضوم لحماية الجسم من الجفاف، ثم تتجمع الفضلات في المستقيم لطردها خارج الجسم.'
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_topic_mappings (
  content_version_id, activity_id, level_id, level_order, topic_id, topic_title_ar, approved_explanation_ar
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l6-3', 'lvl-station-6-large-intestine', 6,
  'topic-undigested-waste-pathway', 'مسار التخلص من بقايا الطعام غير المهضوم خارج الجسم', 'الأمعاء الغليظة تعيد امتصاص الماء، والمستقيم يجمع الفضلات قبل طردها، والألياف الغذائية في الخضروات والفواكه تنظم حركة الأمعاء وتمنع الإمساك، والمضغ الجيد يسهل عمل العصارات الهاضمة.'
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;
INSERT INTO public.activity_topic_mappings (
  content_version_id, activity_id, level_id, level_order, topic_id, topic_title_ar, approved_explanation_ar
) VALUES (
  'content-ar-g6-digestion-v1.4.0', 'act-l6-4', 'lvl-station-6-large-intestine', 6,
  'topic-digestive-health-fiber', 'أهمية الألياف الغذائية وشرب الماء لسلامة الأمعاء الغليظة والوقاية من الإمساك', 'تنتقل بقايا الطعام غير المهضوم من الأمعاء الدقيقة إلى الأمعاء الغليظة، فتمتص الأمعاء الغليظة الماء والأملاح المعدنية، وتتحول البقايا إلى فضلات متماسكة تتجمع في المستقيم ثم تُطرد عبر فتحة الشرج.'
) ON CONFLICT (content_version_id, activity_id) DO NOTHING;

-- 6. Lock Content Version as Published (Immutable)
UPDATE public.content_versions
SET status = 'published', published_at = COALESCE(published_at, now())
WHERE content_version_id = 'content-ar-g6-digestion-v1.4.0' AND status = 'draft';

COMMIT;
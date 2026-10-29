import type { ActivityId } from '../domain/ids';
import { asActivityId } from '../domain/ids';

export type AnatomicalAssetId =
  | 'asset-oral-cavity-salivary'
  | 'asset-digestive-tract-pathway'
  | 'asset-pharynx-epiglottis-esophagus'
  | 'asset-digestive-juices-glands'
  | 'asset-liver-bile-duodenum'
  | 'asset-villi-microstructure'
  | 'asset-large-intestine-excretion';

export interface AnatomicalHotspotCoordinate {
  readonly zoneId: string;
  readonly calloutLetterAr: 'أ' | 'ب' | 'ج' | 'د';
  /** Neutral position description used before answer confirmation so organ name is NEVER revealed prematurely */
  readonly preConfirmationPositionLabelAr: string;
  /** Authoritative anatomical organ/structure name revealed only AFTER confirmation */
  readonly postConfirmationOrganNameAr: string;
  /** Callout badge center in intrinsic image pixels (800x520) */
  readonly badgeX: number;
  readonly badgeY: number;
  /** Organ region center in intrinsic image pixels (800x520) */
  readonly organX: number;
  readonly organY: number;
  /** Normalized percentage coordinates (0-100) for responsive alignment at all viewport widths */
  readonly badgeXPercent: number;
  readonly badgeYPercent: number;
  readonly organXPercent: number;
  readonly organYPercent: number;
  readonly hitRadiusPercent: number;
}

export interface AnatomicalAssetDefinition {
  readonly assetId: AnatomicalAssetId;
  readonly src: string;
  readonly mimeType: 'image/webp';
  readonly intrinsicWidth: 800;
  readonly intrinsicHeight: 520;
  readonly transparentBackgroundVerified: true;
  /** Accessible description that describes the anatomical figure without spoiling identification answers */
  readonly altAr: string;
  readonly scientificCaptionAr: string;
  readonly hotspots: readonly AnatomicalHotspotCoordinate[];
}

export interface ActivityAssetMapping {
  readonly activityId: ActivityId;
  readonly assetId: AnatomicalAssetId;
  readonly interactionMode: 'hotspot_select' | 'label_placement' | 'comparative_lab';
  readonly activeZoneIds: readonly string[];
}

function makeHotspot(
  zoneId: string,
  calloutLetterAr: 'أ' | 'ب' | 'ج' | 'د',
  preConfirmationPositionLabelAr: string,
  postConfirmationOrganNameAr: string,
  badgeX: number,
  badgeY: number,
  organX: number,
  organY: number,
  hitRadiusPercent = 7.5
): AnatomicalHotspotCoordinate {
  return {
    zoneId,
    calloutLetterAr,
    preConfirmationPositionLabelAr,
    postConfirmationOrganNameAr,
    badgeX,
    badgeY,
    organX,
    organY,
    badgeXPercent: Number(((badgeX / 800) * 100).toFixed(2)),
    badgeYPercent: Number(((badgeY / 520) * 100).toFixed(2)),
    organXPercent: Number(((organX / 800) * 100).toFixed(2)),
    organYPercent: Number(((organY / 520) * 100).toFixed(2)),
    hitRadiusPercent,
  };
}

export const ANATOMICAL_ASSET_MANIFEST: Record<
  AnatomicalAssetId,
  AnatomicalAssetDefinition
> = {
  'asset-oral-cavity-salivary': {
    assetId: 'asset-oral-cavity-salivary',
    src: '/assets/anatomy/oral-cavity-salivary.webp',
    mimeType: 'image/webp',
    intrinsicWidth: 800,
    intrinsicHeight: 520,
    transparentBackgroundVerified: true,
    altAr:
      'مخطط تشريحي لتجويف الفم والغدد المرتبطة به يحتوي على أربعة مواضع مرقمة بالحروف أ، ب، ج، د',
    scientificCaptionAr:
      'المقطع التشريحي لتجويف الفم ومواضع الهضم الميكانيكي والكيميائي الأولي',
    hotspots: [
      makeHotspot(
        'zone-a',
        'أ',
        'الموضع (أ): التراكيب الصلبة في الفكين العلوي والسفلي عند مدخل الفم',
        'الأسنان (تقطيع وطحن الطعام ميكانيكياً)',
        185,
        125,
        260,
        185
      ),
      makeHotspot(
        'zone-b',
        'ب',
        'الموضع (ب): العضو العضلي المتحرك في قاع تجويف الفم',
        'اللسان (تقليب الطعام ومزجه باللعاب والتذوق)',
        365,
        255,
        355,
        295
      ),
      makeHotspot(
        'zone-c',
        'ج',
        'الموضع (ج): التراكيب الغدية الثلاثة المتصلة بتجويف الفم عبر قنوات إفرازية',
        'الغدد اللعابية (إفراز اللعاب المحتوي على إنزيم الأميليز)',
        625,
        210,
        550,
        240
      ),
      makeHotspot(
        'zone-d',
        'د',
        'الموضع (د): الممر الخلفي المشترك خلف تجويف الفم',
        'البلعوم (ممر مشترك يدفع اللقمة نحو المريء)',
        600,
        420,
        515,
        420
      ),
    ],
  },

  'asset-digestive-tract-pathway': {
    assetId: 'asset-digestive-tract-pathway',
    src: '/assets/anatomy/digestive-tract-pathway.webp',
    mimeType: 'image/webp',
    intrinsicWidth: 800,
    intrinsicHeight: 520,
    transparentBackgroundVerified: true,
    altAr:
      'مخطط تشريحي للقناة الهضمية للإنسان يوضح أربعة أعضاء رئيسية مرقمة بالحروف أ، ب، ج، د',
    scientificCaptionAr:
      'التسلسل التشريحي لأعضاء القناة الهضمية من الممر العضلي العلوي حتى الأمعاء',
    hotspots: [
      makeHotspot(
        'zone-a',
        'أ',
        'الموضع (أ): الأنبوب العضلي الممتد عمودياً من العنق عبر الصدر',
        'المريء',
        555,
        135,
        408,
        150
      ),
      makeHotspot(
        'zone-b',
        'ب',
        'الموضع (ب): الكيس العضلي الواسع على الجانب الأيسر أعلى البطن',
        'المعدة',
        575,
        255,
        450,
        270
      ),
      makeHotspot(
        'zone-c',
        'ج',
        'الموضع (ج): الأنبوب الملتف الطويل في وسط تجويف البطن',
        'الأمعاء الدقيقة',
        235,
        388,
        405,
        388
      ),
      makeHotspot(
        'zone-d',
        'د',
        'الموضع (د): الأنبوب العريض المحيط بالأنبوب الملتف والمنتهي بالمستقيم',
        'الأمعاء الغليظة',
        585,
        385,
        495,
        375
      ),
    ],
  },

  'asset-pharynx-epiglottis-esophagus': {
    assetId: 'asset-pharynx-epiglottis-esophagus',
    src: '/assets/anatomy/pharynx-epiglottis-esophagus.webp',
    mimeType: 'image/webp',
    intrinsicWidth: 800,
    intrinsicHeight: 520,
    transparentBackgroundVerified: true,
    altAr:
      'مخطط تشريحي لآلية البلع والحركة الدودية يحتوي على أربعة مواضع مرقمة بالحروف أ، ب، ج، د',
    scientificCaptionAr:
      'آلية إغلاق مجرى الهواء عند البلع وانتقال البلعة الغذائية بالحركة الدودية',
    hotspots: [
      makeHotspot(
        'zone-a',
        'أ',
        'الموضع (أ): التجويف العلوي المشترك خلف الفم والأنف',
        'البلعوم',
        545,
        78,
        395,
        88
      ),
      makeHotspot(
        'zone-b',
        'ب',
        'الموضع (ب): الصمام الغضروفي الموجود أعلى القصبة الهوائية الأمامية',
        'لسان المزمار',
        225,
        140,
        372,
        140
      ),
      makeHotspot(
        'zone-c',
        'ج',
        'الموضع (ج): الأنبوب العضلي الخلفي الذي يدفع البلعة الغذائية بانقباضاته',
        'المريء',
        575,
        248,
        436,
        248
      ),
      makeHotspot(
        'zone-d',
        'د',
        'الموضع (د): العضو الكيسي العضلي الذي يستقبل البلعة في نهاية الأنبوب',
        'المعدة',
        605,
        428,
        460,
        428
      ),
    ],
  },

  'asset-digestive-juices-glands': {
    assetId: 'asset-digestive-juices-glands',
    src: '/assets/anatomy/digestive-juices-glands.webp',
    mimeType: 'image/webp',
    intrinsicWidth: 800,
    intrinsicHeight: 520,
    transparentBackgroundVerified: true,
    altAr:
      'مخطط تشريحي للأعضاء والغدد المفرزة للعصارات الهاضمة مرقم بالحروف أ، ب، ج، د',
    scientificCaptionAr:
      'مواقع إفراز العصارات الهاضمة على طول القناة الهضمية والغدد الملحقة بها',
    hotspots: [
      makeHotspot(
        'zone-a',
        'أ',
        'الموضع (أ): الغدد المحيطة بتجويف الفم في الرأس',
        'اللعاب (يفرز من الغدد اللعابية لهضم النشويات)',
        555,
        85,
        405,
        98
      ),
      makeHotspot(
        'zone-b',
        'ب',
        'الموضع (ب): الكيس العضلي في أعلى يسار التجويف البطني',
        'العصارة المعدية (تفرزها المعدة لهضم البروتينات جزئياً)',
        605,
        255,
        455,
        285
      ),
      makeHotspot(
        'zone-c',
        'ج',
        'الموضع (ج): الغدة الكبيرة بنية اللون في أعلى يمين البطن والحويصلة أسفلها',
        'العصارة الصفراوية (يفرزها الكبد لتجزئة الدهون)',
        175,
        235,
        315,
        255
      ),
      makeHotspot(
        'zone-d',
        'د',
        'الموضع (د): الغدة الممتدة خلف المعدة والمتصلة ببداية الأمعاء الدقيقة',
        'العصارة البنكرياسية والمعوية (لاستكمال الهضم الكامل)',
        605,
        395,
        445,
        375
      ),
    ],
  },

  'asset-liver-bile-duodenum': {
    assetId: 'asset-liver-bile-duodenum',
    src: '/assets/anatomy/liver-bile-duodenum.webp',
    mimeType: 'image/webp',
    intrinsicWidth: 800,
    intrinsicHeight: 520,
    transparentBackgroundVerified: true,
    altAr:
      'مخطط تشريحي تفصيلي للكبد والحويصلة الصفراوية والبنكرياس والاثني عشر مرقم بالحروف أ، ب، ج، د',
    scientificCaptionAr:
      'العلاقة التشريحية بين الكبد والحويصلة الصفراوية والبنكرياس والاثني عشر والوريد البابي الكبدي',
    hotspots: [
      makeHotspot(
        'zone-a',
        'أ',
        'الموضع (أ): العضو الغدي الكبير أعلى يمين التجويف البطني',
        'الكبد',
        155,
        95,
        295,
        175
      ),
      makeHotspot(
        'zone-b',
        'ب',
        'الموضع (ب): الكيس الصغير الكمثري الشكل الواقع أسفل العضو (أ)',
        'الحويصلة الصفراوية',
        175,
        295,
        310,
        265
      ),
      makeHotspot(
        'zone-c',
        'ج',
        'الموضع (ج): الغدة الصفراء الممتدة أفقياً نحو تجويف المنحنى المعوي',
        'البنكرياس',
        645,
        295,
        495,
        350
      ),
      makeHotspot(
        'zone-d',
        'د',
        'الموضع (د): الجزء الأول المنحني على شكل حرف C من الأمعاء الدقيقة',
        'الاثنا عشر (بداية الأمعاء الدقيقة)',
        235,
        435,
        375,
        385
      ),
    ],
  },

  'asset-villi-microstructure': {
    assetId: 'asset-villi-microstructure',
    src: '/assets/anatomy/villi-microstructure.webp',
    mimeType: 'image/webp',
    intrinsicWidth: 800,
    intrinsicHeight: 520,
    transparentBackgroundVerified: true,
    altAr:
      'مقطع تشريحي مكبر للخملات المعوية الدقيقة يوضح أربعة تراكيب مرقمة بالحروف أ، ب، ج، د',
    scientificCaptionAr:
      'التركيب المجهري الدقيق للخملات المعوية في الجدار الداخلي للأمعاء الدقيقة',
    hotspots: [
      makeHotspot(
        'zone-a',
        'أ',
        'الموضع (أ): الجدار الخارجي الرقيق للبروز الإصبعي المعوي',
        'الطبقة الطلائية الرقيقة للخملة',
        185,
        105,
        325,
        175
      ),
      makeHotspot(
        'zone-b',
        'ب',
        'الموضع (ب): الشبكة المتفرعة ذات اللونين الأحمر والأزرق داخل البروز',
        'شبكة الشعيرات الدموية (لامتصاص السكريات والأحماض الأمينية)',
        615,
        135,
        435,
        235
      ),
      makeHotspot(
        'zone-c',
        'ج',
        'الموضع (ج): الوعاء الأنبوبي الأوسط الأخضر داخل البروز',
        'الوعاء اللمفاوي / اللبني (لامتصاص الأحماض الدهنية والجليسرين)',
        625,
        310,
        400,
        310
      ),
      makeHotspot(
        'zone-d',
        'د',
        'الموضع (د): الطبقة القاعدية الحاملة للأوعية الدموية واللمفاوية',
        'قاعدة جدار الأمعاء الدقيقة وأوعية نقل الغذاء الممتص',
        145,
        445,
        250,
        445
      ),
    ],
  },

  'asset-large-intestine-excretion': {
    assetId: 'asset-large-intestine-excretion',
    src: '/assets/anatomy/large-intestine-excretion.webp',
    mimeType: 'image/webp',
    intrinsicWidth: 800,
    intrinsicHeight: 520,
    transparentBackgroundVerified: true,
    altAr:
      'مخطط تشريحي للأمعاء الغليظة والمستقيم يوضح أربعة مواضع مرقمة بالحروف أ، ب، ج، د',
    scientificCaptionAr:
      'أجزاء الأمعاء الغليظة وآلية استعادة الماء والأملاح والتخلص من بقايا الطعام غير المهضوم',
    hotspots: [
      makeHotspot(
        'zone-a',
        'أ',
        'الموضع (أ): منطقة اتصال نهاية الأمعاء الدقيقة ببداية الأمعاء الغليظة',
        'منطقة اتصال الأمعاء الدقيقة بالأعور (بداية الأمعاء الغليظة)',
        175,
        375,
        325,
        355
      ),
      makeHotspot(
        'zone-b',
        'ب',
        'الموضع (ب): الأنبوب العضلي العريض ذو التخصرات المحيط بالتجويف البطني',
        'القولون (الأمعاء الغليظة)',
        235,
        75,
        415,
        115
      ),
      makeHotspot(
        'zone-c',
        'ج',
        'الموضع (ج): الجزء العضلي السفلي المستقيم في نهاية الأمعاء الغليظة',
        'المستقيم (تجميع الفضلات قبل طردها عبر فتحة الشرج)',
        255,
        465,
        425,
        445
      ),
      makeHotspot(
        'zone-d',
        'د',
        'الموضع (د): الأسهم الزرقاء الخارجة عبر جدار الأنبوب العريض نحو الجسم',
        'عملية إعادة امتصاص الماء والأملاح المعدنية من بقايا الطعام',
        685,
        185,
        605,
        275
      ),
    ],
  },
};

export const ACTIVITY_ASSET_MAPPINGS: readonly ActivityAssetMapping[] = [
  {
    activityId: asActivityId('act-l2-1'),
    assetId: 'asset-digestive-tract-pathway',
    interactionMode: 'hotspot_select',
    activeZoneIds: ['zone-a', 'zone-b', 'zone-c', 'zone-d'],
  },
  {
    activityId: asActivityId('act-l2-5'),
    assetId: 'asset-pharynx-epiglottis-esophagus',
    interactionMode: 'label_placement',
    activeZoneIds: ['zone-a', 'zone-b', 'zone-c', 'zone-d'],
  },
  {
    activityId: asActivityId('act-l3-1'),
    assetId: 'asset-oral-cavity-salivary',
    interactionMode: 'hotspot_select',
    activeZoneIds: ['zone-a', 'zone-b', 'zone-c', 'zone-d'],
  },
  {
    activityId: asActivityId('act-l3-7'),
    assetId: 'asset-digestive-juices-glands',
    interactionMode: 'label_placement',
    activeZoneIds: ['zone-a', 'zone-b', 'zone-c', 'zone-d'],
  },
  {
    activityId: asActivityId('act-l4-2'),
    assetId: 'asset-liver-bile-duodenum',
    interactionMode: 'hotspot_select',
    activeZoneIds: ['zone-a', 'zone-b', 'zone-c', 'zone-d'],
  },
  {
    activityId: asActivityId('act-l5-1'),
    assetId: 'asset-villi-microstructure',
    interactionMode: 'comparative_lab',
    activeZoneIds: ['zone-a', 'zone-b', 'zone-c'],
  },
  {
    activityId: asActivityId('act-l5-2'),
    assetId: 'asset-villi-microstructure',
    interactionMode: 'label_placement',
    activeZoneIds: ['zone-a', 'zone-b', 'zone-c', 'zone-d'],
  },
  {
    activityId: asActivityId('act-l6-1'),
    assetId: 'asset-large-intestine-excretion',
    interactionMode: 'hotspot_select',
    activeZoneIds: ['zone-a', 'zone-b', 'zone-c', 'zone-d'],
  },
];


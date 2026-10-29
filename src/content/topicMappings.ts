import type { ActivityId, LevelId } from '../domain/ids';
import { DIGESTION_CURRICULUM_MANIFEST } from './digestionManifest';
import type { CurriculumManifest, LearningActivityDefinition } from './schema';

export interface ActivityTopicMapping {
  readonly activityId: ActivityId;
  readonly levelId: LevelId;
  readonly levelOrder: number;
  readonly levelTitleAr: string;
  readonly activityTitleAr: string;
  readonly topicId: string;
  readonly topicTitleAr: string;
  readonly approvedExplanationAr: string;
}

const SPECIFIC_TOPIC_LABELS_BY_ACTIVITY_ID: Readonly<
  Record<string, { readonly topicId: string; readonly topicTitleAr: string }>
> = {
  'act-l1-1': {
    topicId: 'topic-digestion-concept',
    topicTitleAr: 'المفهوم العلمي لعملية الهضم وتحويل الغذاء المعقد إلى بسيط',
  },
  'act-l1-2': {
    topicId: 'topic-digestion-importance',
    topicTitleAr: 'أهمية عملية الهضم في إمداد خلايا الجسم بالطاقة والنمو',
  },
  'act-l2-1': {
    topicId: 'topic-esophagus-location',
    topicTitleAr: 'الموقع التشريحي للمريء وربطه بين البلعوم والمعدة',
  },
  'act-l2-2': {
    topicId: 'topic-tract-vs-accessory',
    topicTitleAr: 'التمييز بين أعضاء القناة الهضمية وملحقات القناة الهضمية',
  },
  'act-l2-3': {
    topicId: 'topic-epiglottis-swallowing',
    topicTitleAr: 'دور البلعوم ولسان المزمار في حماية مجرى التنفس أثناء البلع',
  },
  'act-l2-4': {
    topicId: 'topic-alimentary-pathway',
    topicTitleAr: 'الترتيب التشريحي المتسلسل لأعضاء القناة الهضمية من الفم للمستقيم',
  },
  'act-l2-5': {
    topicId: 'topic-digestive-organs-functions',
    topicTitleAr: 'مواضع ووظائف أعضاء الجهاز الهضمي وملحقاته على الرسم التشريحي',
  },
  'act-l3-1': {
    topicId: 'topic-salivary-amylase',
    topicTitleAr: 'الغدد اللعابية وإنزيم الأميليز وتحويل النشويات إلى سكريات بسيطة',
  },
  'act-l3-2': {
    topicId: 'topic-teeth-tongue-mechanical',
    topicTitleAr: 'الهضم الميكانيكي في الفم: وظائف الأسنان واللسان واللعاب',
  },
  'act-l3-3': {
    topicId: 'topic-stomach-gastric-juice',
    topicTitleAr: 'العصارة المعدية وهضم البروتينات جزئياً داخل المعدة',
  },
  'act-l3-4': {
    topicId: 'topic-pancreas-duodenum-anatomy',
    topicTitleAr: 'تحديد موقع البنكرياس والاثني عشر وإفراز العصارة البنكرياسية',
  },
  'act-l3-5': {
    topicId: 'topic-five-digestive-juices',
    topicTitleAr: 'مقارنة العصارات الهاضمة الخمس ومصادر إفرازها ووظائفها',
  },
  'act-l3-6': {
    topicId: 'topic-complete-digestion-small-intestine',
    topicTitleAr: 'اكتمال الهضم الكيميائي في الأمعاء الدقيقة بفعل العصارة المعوية',
  },
  'act-l3-7': {
    topicId: 'topic-chemical-digestion-sequence',
    topicTitleAr: 'تتابع مراحل الهضم الكيميائي للنشويات والبروتينات والدهون',
  },
  'act-l4-1': {
    topicId: 'topic-liver-bile-emulsification',
    topicTitleAr: 'إفراز الكبد للعصارة الصفراوية وتجزئة الدهون إلى مستحلب دهني',
  },
  'act-l4-2': {
    topicId: 'topic-hepatic-portal-anatomy',
    topicTitleAr: 'التشريح الوظيفي للكبد والحويصلة الصفراوية والوريد البابي الكبدي',
  },
  'act-l4-3': {
    topicId: 'topic-nutrient-absorption-definition',
    topicTitleAr: 'مفهوم الامتصاص وانتقال الغذاء المهضوم من الأمعاء الدقيقة إلى الدم',
  },
  'act-l4-4': {
    topicId: 'topic-liver-metabolic-detox',
    topicTitleAr: 'دور الكبد في تنظيم مستوى السكر وتنقية الدم من السموم',
  },
  'act-l5-1': {
    topicId: 'topic-villi-surface-area',
    topicTitleAr: 'وظيفة الخملات في مضاعفة مساحة سطح الامتصاص بالأمعاء الدقيقة',
  },
  'act-l5-2': {
    topicId: 'topic-villi-microstructure',
    topicTitleAr: 'التركيب الدقيق للخملة: الطبقة الطلائية والشعيرات الدموية والوعاء اللمفاوي',
  },
  'act-l5-3': {
    topicId: 'topic-villi-vs-smooth-comparison',
    topicTitleAr: 'المقارنة العملية بين السطح الأملس والسطح الغني بالخملات في كفاءة الامتصاص',
  },
  'act-l5-4': {
    topicId: 'topic-villi-capillaries-transport',
    topicTitleAr: 'آلية عبور الجلوكوز والأحماض الأمينية والدهنية عبر جدران الخملات للدم واللمف',
  },
  'act-l6-1': {
    topicId: 'topic-large-intestine-water-absorption',
    topicTitleAr: 'وظيفة الأمعاء الغليظة في امتصاص الماء والأملاح المعدنية من الفضلات',
  },
  'act-l6-2': {
    topicId: 'topic-colon-rectum-anatomy',
    topicTitleAr: 'التحديد التشريحي للقولون والمستقيم في نهاية القناة الهضمية',
  },
  'act-l6-3': {
    topicId: 'topic-undigested-waste-pathway',
    topicTitleAr: 'مسار التخلص من بقايا الطعام غير المهضوم خارج الجسم',
  },
  'act-l6-4': {
    topicId: 'topic-digestive-health-fiber',
    topicTitleAr: 'أهمية الألياف الغذائية وشرب الماء لسلامة الأمعاء الغليظة والوقاية من الإمساك',
  },
};

export function getActivityTopicMapping(
  manifest: CurriculumManifest,
  activityId: ActivityId
): ActivityTopicMapping | null {
  for (const level of manifest.levels) {
    const act: LearningActivityDefinition | undefined = level.activities.find(
      (a) => a.activityId === activityId
    );
    if (act) {
      const custom = SPECIFIC_TOPIC_LABELS_BY_ACTIVITY_ID[act.activityId];
      let approvedExp = act.scientificExplanationAr;
      if (!approvedExp) {
        for (const authLvl of DIGESTION_CURRICULUM_MANIFEST.levels) {
          const authAct = authLvl.activities.find(
            (a) => a.activityId === activityId
          );
          if (authAct?.scientificExplanationAr) {
            approvedExp = authAct.scientificExplanationAr;
            break;
          }
        }
      }
      return {
        activityId: act.activityId,
        levelId: level.levelId,
        levelOrder: level.order,
        levelTitleAr: level.stationNameAr,
        activityTitleAr: act.titleAr,
        topicId: custom?.topicId ?? `topic-${act.activityId}`,
        topicTitleAr: custom?.topicTitleAr ?? `${level.organNameAr} — ${act.titleAr}`,
        approvedExplanationAr: approvedExp,
      };
    }
  }
  return null;
}

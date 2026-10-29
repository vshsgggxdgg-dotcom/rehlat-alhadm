import React from 'react';
import type { StationIllustrationKey } from '../../content/schema';
import { normalizeAvatarId, type AvatarId } from '../../domain/types';

/**
 * Genuine Transparent-Background 3D-Shaded Characters (3 Girls & 3 Boys),
 * Educational Station Illustrations, and Reward Badges.
 * Rule: 100% transparent SVG canvas — no baked-in backdrop or checkerboard.
 */

export const AVATAR_OPTIONS: readonly {
  readonly id: AvatarId;
  readonly nameAr: string;
  readonly roleAr: string;
  readonly genderGroup: 'girl' | 'boy';
}[] = [
  {
    id: 'girl-noor',
    nameAr: 'نور',
    roleAr: 'المستكشفة الذكية (افتراضي)',
    genderGroup: 'girl',
  },
  {
    id: 'girl-salma',
    nameAr: 'سلمى',
    roleAr: 'باحثة المختبر',
    genderGroup: 'girl',
  },
  {
    id: 'girl-farida',
    nameAr: 'فريدة',
    roleAr: 'رائدة العلوم',
    genderGroup: 'girl',
  },
  {
    id: 'boy-omar',
    nameAr: 'عمر',
    roleAr: 'المغامر العلمي',
    genderGroup: 'boy',
  },
  {
    id: 'boy-ziad',
    nameAr: 'زياد',
    roleAr: 'مكتشف الأعضاء',
    genderGroup: 'boy',
  },
  {
    id: 'boy-karim',
    nameAr: 'كريم',
    roleAr: 'بطل المعرفة',
    genderGroup: 'boy',
  },
];

export const StudentAvatarIllustration: React.FC<{readonly avatarId?: AvatarId | string;readonly size?: number}> = ({avatarId,size=64}) => {
 const id=normalizeAvatarId(avatarId as string|undefined);const meta=AVATAR_OPTIONS.find(a=>a.id===id)??AVATAR_OPTIONS[0];
 return <img className="student-avatar-3d" src={`/assets/3d/${meta.id}.webp`} alt={`شخصية ${meta.nameAr}`} width={size} height={size} style={{objectFit:'contain',background:'transparent',flexShrink:0}}/>;
};

export const LevelBadgeIllustration: React.FC<{readonly order:number;readonly earned:boolean;readonly size?:number}> = ({order,earned,size=72}) => <span className={`achievement-medal ${earned?'':'achievement-medal--locked'}`} role="img" aria-label={`شارة المستوى ${order} ${earned?'مكتسبة':'لم تكتسب بعد'}`} style={{width:size,height:size}}><img src="/assets/3d/achievement.webp" alt="" loading="lazy"/><b>{order.toLocaleString('ar-EG')}</b></span>;

export const StationIllustration: React.FC<{readonly illustrationKey: StationIllustrationKey}> = ({illustrationKey}) => {
 const files:Record<string,string>={'station-1-mouth':'oral-cavity-salivary','station-2-esophagus':'digestive-tract-pathway','station-3-stomach':'digestive-juices-glands','station-4-small-intestine':'liver-bile-duodenum','station-5-villi-absorption':'villi-microstructure','station-6-large-intestine':'large-intestine-excretion'};
 return <img className="station-svg-illustration station-image-3d" src={`/assets/anatomy/${files[illustrationKey]??'digestive-tract-pathway'}.webp`} alt="نموذج توضيحي لأعضاء المستوى" loading="lazy"/>;
};

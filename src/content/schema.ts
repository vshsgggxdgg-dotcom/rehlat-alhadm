import type {
  ActivityId,
  ContentVersionId,
  DependencyId,
  LevelId,
} from "../domain/ids";
import type { AssetApprovalStatus } from "../domain/types";
import type {
  AnatomicalAssetId,
  AnatomicalHotspotCoordinate,
} from "./assetManifest";

export type ActivityType =
  | "multiple_choice"
  | "fill_in"
  | "ordering"
  | "matching"
  | "image_identification"
  | "villi_comparison";

export type ContentProvenanceStatus =
  | "supplied_approved"
  | "curriculum_aligned_default"
  | "pending_external_supply";

export type StationIllustrationKey =
  | "station-1-mouth"
  | "station-2-esophagus"
  | "station-3-stomach"
  | "station-4-small-intestine"
  | "station-5-villi-absorption"
  | "station-6-large-intestine";

export type InstructionIconKey =
  | "sparkles-points"
  | "two-attempts-help"
  | "score-calculator"
  | "badge-medal"
  | "unlock-next";

export interface InstructionCardDefinition {
  readonly cardNumber: 1 | 2 | 3 | 4 | 5;
  readonly id: string;
  readonly iconKey: InstructionIconKey;
  readonly titleAr: string;
  readonly bodyAr: string;
}

export interface ActivityOptionItem {
  readonly optionId: string;
  readonly labelAr: string;
  readonly feedbackAr: string;
}

export interface FillInBlankSlot {
  readonly blankId: string;
  readonly beforeTextAr: string;
  readonly afterTextAr: string;
  readonly correctWordId: string;
}

export interface FillInWordCard {
  readonly wordId: string;
  readonly labelAr: string;
}

export interface FillInActivityConfig {
  readonly blanks: readonly FillInBlankSlot[];
  readonly wordCards: readonly FillInWordCard[];
}

export interface OrderingCardItem {
  readonly itemId: string;
  readonly labelAr: string;
}

export interface OrderingActivityConfig {
  readonly items: readonly OrderingCardItem[];
  readonly initialOrderIds: readonly string[];
  readonly correctOrderIds: readonly string[];
}

export interface MatchingPromptItem {
  readonly promptId: string;
  readonly labelAr: string;
}

export interface MatchingTargetItem {
  readonly targetId: string;
  readonly labelAr: string;
}

export interface MatchingPairSolution {
  readonly promptId: string;
  readonly targetId: string;
}

export interface MatchingActivityConfig {
  readonly rightColumnTitleAr: string;
  readonly leftColumnTitleAr: string;
  readonly prompts: readonly MatchingPromptItem[];
  readonly targets: readonly MatchingTargetItem[];
  readonly correctPairs: readonly MatchingPairSolution[];
}

export interface ImageLabelAssignmentItem {
  readonly labelId: string;
  readonly labelAr: string;
  readonly correctZoneId: string;
}

export interface ImageIdentificationActivityConfig {
  readonly hotspots?: readonly AnatomicalHotspotCoordinate[];
  readonly imageWidth?: number;
  readonly imageHeight?: number;
  readonly assetId: AnatomicalAssetId;
  readonly mode: "hotspot_select" | "label_placement";
  /** Used when mode === 'hotspot_select' */
  readonly correctZoneId?: string;
  /** Used when mode === 'label_placement' */
  readonly labelsToPlace?: readonly ImageLabelAssignmentItem[];
}

export interface VilliComparisonCriterion {
  readonly criterionId: string;
  readonly statementAr: string;
  readonly correctSurfaceId: "smooth_surface" | "villi_surface";
}

export interface VilliComparisonActivityConfig {
  readonly assetId: AnatomicalAssetId;
  readonly criteria: readonly VilliComparisonCriterion[];
  readonly conclusionPromptAr: string;
  readonly conclusionOptions: readonly ActivityOptionItem[];
  readonly correctConclusionId: string;
}

export interface LearningActivityDefinition {
  readonly visualAssetUrl?: string;
  readonly activityId: ActivityId;
  readonly levelId: LevelId;
  readonly type: ActivityType;
  readonly titleAr: string;
  readonly promptAr: string;
  readonly scientificHintAr: string;
  readonly scientificExplanationAr: string;
  readonly options: readonly ActivityOptionItem[];
  readonly correctOptionId: string;
  readonly maxScore: number;
  readonly contentApprovalStatus: AssetApprovalStatus;
  readonly contentProvenance: ContentProvenanceStatus;
  readonly unresolvedDependencyId?: DependencyId;
  readonly fillInConfig?: FillInActivityConfig;
  readonly orderingConfig?: OrderingActivityConfig;
  readonly matchingConfig?: MatchingActivityConfig;
  readonly imageIdentificationConfig?: ImageIdentificationActivityConfig;
  readonly villiComparisonConfig?: VilliComparisonActivityConfig;
}

export interface BadgeAwardDefinition {
  readonly badgeId: string;
  readonly titleAr: string;
  readonly descriptionAr: string;
  readonly scientificTakeawayAr: string;
}

export interface LearningLevelDefinition {
  readonly levelId: LevelId;
  readonly order: 1 | 2 | 3 | 4 | 5 | 6;
  readonly stationNameAr: string;
  readonly organNameAr: string;
  readonly subtitleAr: string;
  readonly illustrationKey: StationIllustrationKey;
  readonly badge: BadgeAwardDefinition;
  readonly learningObjectivesAr: readonly string[];
  readonly coreScientificFactsAr: readonly string[];
  readonly keyConcepts: readonly {
    readonly termAr: string;
    readonly summaryAr: string;
  }[];
  readonly masteryThresholdPercent: number;
  readonly visualAssetStatus: AssetApprovalStatus;
  readonly requiredAssetDependencyId?: DependencyId;
  readonly activities: readonly LearningActivityDefinition[];
}

export interface CurriculumManifest {
  readonly contentVersionId: ContentVersionId;
  readonly titleAr: string;
  readonly gradeAr: string;
  readonly subjectAr: string;
  readonly descriptionAr: string;
  readonly aboutTextAr: string;
  readonly instructionsTitleAr: string;
  readonly instructionsSubtitleAr: string;
  readonly instructionCards: readonly InstructionCardDefinition[];
  readonly instructionsReminderAr: string;
  readonly instructionsPrimaryActionAr: string;
  readonly lastUpdatedIso: string;
  readonly levels: readonly LearningLevelDefinition[];
}

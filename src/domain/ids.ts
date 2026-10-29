/**
 * Stable Branded Identifiers for «رحلة الهضم»
 * Enforces compile-time separation between Student, ContentVersion, Level, Activity, and Attempt IDs.
 */

export type StudentId = string & { readonly __brand: 'StudentId' };
export type ContentVersionId = string & { readonly __brand: 'ContentVersionId' };
export type LevelId = string & { readonly __brand: 'LevelId' };
export type ActivityId = string & { readonly __brand: 'ActivityId' };
export type AttemptId = string & { readonly __brand: 'AttemptId' };
export type DependencyId = string & { readonly __brand: 'DependencyId' };
export const asAttemptId = (value: string): AttemptId => value as AttemptId;

export function asStudentId(raw: string): StudentId {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('StudentId cannot be empty.');
  }
  return trimmed as StudentId;
}

export function asContentVersionId(raw: string): ContentVersionId {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('ContentVersionId cannot be empty.');
  }
  return trimmed as ContentVersionId;
}

export function asLevelId(raw: string): LevelId {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('LevelId cannot be empty.');
  }
  return trimmed as LevelId;
}

export function asActivityId(raw: string): ActivityId {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('ActivityId cannot be empty.');
  }
  return trimmed as ActivityId;
}

export function asDependencyId(raw: string): DependencyId {
  return raw.trim() as DependencyId;
}

export function createStudentId(): StudentId {
  const randomPart =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 12)
      : Math.random().toString(36).slice(2, 10);
  return `stu_${randomPart}` as StudentId;
}

export function createAttemptId(): AttemptId {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `att_${timestamp}_${randomPart}` as AttemptId;
}

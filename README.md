# مستكشف إفريقيا

Arabic, RTL cloud learning platform for the first preparatory year. Built with browser-native JavaScript, HTML, CSS, PostgreSQL and Node.js Vercel Functions. No React, framework, CDN JavaScript or runtime npm dependencies.

## Features

- Email/password student and invited-teacher accounts; password recovery; session refresh.
- Cloud curriculum, immutable published versions, editable private drafts and original source texts.
- Four stations, exploration cards, illustrated route map, historical sequence, practice, 20 station questions and 8 final questions.
- Server-side grading, two attempts, partial second-attempt credit, serialized/idempotent completion, final unlock, saved progress and printable certificate.
- Database-driven content generator, editable 56-question cloud bank, visual editor, publish review, teacher invitations, aggregate learner reports and CSV export.
- Optional browser speech, short sound cues, keyboard controls, responsive layout and reduced-motion support.

## Hosting

Vercel project: `africa-explorer`. Existing project `rehlat-alhadm` is unchanged. Source is on the separate `africa-explorer` branch in the connected repository. No merge into its main branch is required.

Required environment keys: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`. Generation runs entirely in Supabase using approved cloud content. It needs no AI API, Vercel AI Gateway, model key, paid inference or service role key.

`npm install`, `npm test`, `npm run build`. Build writes only public Supabase configuration to `public/config.js`. `node scripts/preview.mjs` serves the static UI locally, including the cloud-backed generator when signed in as a teacher.

## Database and authorization

The `ae_` tables/functions and `ae_private` schema are independent from the existing application. `database/schema.sql` records initial schema; follow-up migrations are recorded in Supabase and in this repository where applicable. Content is served through authenticated RPCs that strip answer keys from student responses. Students can read only their own profiles/answers and have no direct write grants. Teacher role is never derived from editable user metadata. One-use invitations are stored hashed with seven-day expiry.

SECURITY DEFINER RPCs deliberately mediate private content and grading; each validates the authenticated UID, teacher-only actions check the stored role, and function search paths are fixed. Anonymous execution is revoked. New anonymous Supabase accounts are rejected by `ae_me`; real email/password registration is required. Existing application's authentication configuration is preserved.

Published courses cannot be edited; changes create a new course/version ID. Progress and scoring refer to that ID. Teacher reports cover their own publications and the shared base curriculum. Practice is ungraded; permanent assessment permits two attempts and retains the result. Review remains available after completion.

## Generation

The teacher selects a published source course, names the new version and optionally emphasizes a station in the final challenge. `ae_generate_from_bank` runs inside PostgreSQL, selects five random active questions per station and eight additional questions with no prompt repeats, shuffles options while maintaining the correct answer, copies approved explanation cards, validates the result and saves an unpublished cloud draft. No external text-generation service is involved.

The base bank contains 56 reviewed questions: 12 per station and 8 additional final questions. Teachers can add, edit, pause and reactivate questions through authenticated RPCs. Changes to the bank never mutate existing publications or student scores. New sources without expanded banks initialize from their own approved 28 questions. This is generation by composition from stored material, not novel free-form AI writing.

## Content

The initial course is based on the supplied lesson. The complete supplied reference is stored with the cloud base course. The map is a schematic illustration, not a navigation or historical boundaries map. Simplified lesson explanations avoid repeating disputed details as externally verified facts. New generated material needs teacher review.

## Verification

`tests/content.test.mjs` checks curriculum/bank coverage and invalid output. `database/verification.sql` checks real database authorization, sanitization, scoring, locking and version behavior in a rolled-back transaction. `tests/live.mjs` verifies real authentication, teacher-only bank access, generated drafts, shuffled correct answers, no repeated prompts, version variety and a complete persisted 100/100 journey. Its disposable account configuration is kept outside this repository.

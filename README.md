# مستكشف إفريقيا

Arabic, RTL cloud learning platform for the first preparatory year. Built with browser-native JavaScript, HTML, CSS, PostgreSQL and Node.js Vercel Functions. No React, framework, CDN JavaScript or runtime npm dependencies.

## Features

- Student entry by name only, remembered on the same browser; teacher entry by username and password, with private one-time setup invitations.
- Cloud-saved character selection: safari driver or explorer for students, a shirt-and-book teacher character for teachers. An animated companion stays with the user across screens.
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

SECURITY DEFINER RPCs deliberately mediate private content and grading; each validates the authenticated UID, teacher-only actions check the stored role, and function search paths are fixed. Unauthenticated Data API execution is revoked. Name-only students receive distinct Supabase anonymous identities with the authenticated database role; they cannot access teacher operations or redeem teacher invitations. Display names never identify a student across devices. Browser-held sessions restore a learner on the same browser; clearing browser data removes this access, while the cloud record remains.

Teacher authentication runs through `supabase/functions/ae-teacher-access`. It verifies username/password with Supabase Auth, preserves existing teacher passwords, and resolves legacy teacher display names through a private username map. The public edge login function authenticates the password itself, rate-limits attempts, and never sends the service-role key to browsers. New teacher accounts need an invitation during initial setup only. Daily teacher login has just username and password. The automatic internal Auth email alias is not a user-facing input and requires no email confirmation.

Published courses cannot be edited; changes create a new course/version ID. Progress and scoring refer to that ID. Teacher reports cover their own publications and the shared base curriculum. Practice is ungraded; permanent assessment permits two attempts and retains the result. Review remains available after completion.

## Generation

The teacher selects a published source course, names the new version and optionally emphasizes a station in the final challenge. `ae_generate_from_bank` runs inside PostgreSQL, selects five random active questions per station and eight additional questions with no prompt repeats, shuffles options while maintaining the correct answer, copies approved explanation cards, validates the result and saves an unpublished cloud draft. No external text-generation service is involved.

The base bank contains 56 reviewed questions: 12 per station and 8 additional final questions. Teachers can add, edit, pause and reactivate questions through authenticated RPCs. Changes to the bank never mutate existing publications or student scores. New sources without expanded banks initialize from their own approved 28 questions. This is generation by composition from stored material, not novel free-form AI writing.

## Content

The initial course is based on the supplied lesson. The complete supplied reference is stored with the cloud base course. The map is a schematic illustration, not a navigation or historical boundaries map. Simplified lesson explanations avoid repeating disputed details as externally verified facts. New generated material needs teacher review.

## Verification

`tests/content.test.mjs` checks curriculum/bank coverage and invalid output. `database/verification.sql` checks real database authorization, sanitization, scoring, locking and version behavior in a rolled-back transaction. `tests/live.mjs` verifies real authentication, teacher-only bank access, generated drafts, shuffled correct answers, no repeated prompts, version variety and a complete persisted 100/100 journey. Its disposable account configuration is kept outside this repository.


## Complete experience, format 2

The complete curriculum is defined in database/complete-course.mjs and stored in ae_courses, not bundled with the student frontend. It includes 24 pages, 17 ungraded practice activities, 4 evidence reviews, 20 station assessments and 8 final assessments. public/learning.js and public/complete-runtime.js render typed activities and teacher editing without React. Geographic coastlines are attributed in public/assets/maps/SOURCES.md.

V2 data is isolated in ae_v2_runs, ae_v2_events, ae_v2_answers and ae_v2_attempts; legacy ae_answers records are preserved. The server gates stamps on page, practice and quiz completion, gates the final on all evidence, and awards half marks on the second attempt (1.5 / 2.5). Every replay retains the previous round. Requests have UUID idempotency keys. Recursive document sanitization removes keys from nested practices and assessments.

Additional migrations, after the existing account and cloud-generator migrations, are complete-experience.sql, complete-validation.sql, complete-bank.sql, complete-bank-types.sql and complete-report-empty.sql. They are ordered migrations, not repeatable install scripts. The legacy validator and generator remain available internally for old courses. New question bank slots preserve activity types and coverage.

Run npm test for content, typed validation and escaped rendering. tests/complete-backend.sql exercises a temporary student and generated draft inside a transaction that always rolls back; its course UUID refers to this configured project. Never run it against an unrelated project without adjusting the fixture. No production student results are modified by that test.

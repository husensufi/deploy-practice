# Yoga, Exercise, and Games Migration Report

Date: 2026-11-01

## Status summary

| Feature | Status | Notes |
|---|---|---|
| Yoga pose catalog and detail instructions | Fully implemented and tested | Migrated the six original pose/breathing entries with details, difficulty, 30-second guided step, and legacy YouTube search links. No local image/video media was present in the legacy repository. |
| Timed guided movement session | Fully implemented and tested | Preserves the original ordered six-step session, 30 seconds per step, stop action, and completion state. |
| Breathing guide | Fully implemented and tested | Preserves the legacy 4-second inhale / 6-second exhale breathing circle. |
| Separate exercise-routine tutorials | Partially implemented | The legacy app has no exercise routine catalog or separate exercise tutorial. The React movement page links to the existing daily tracker to record exercise minutes; no routines were fabricated. |
| Zen Bubbles | Fully implemented and tested | Click-to-pop bubbles with a current-session score; no timer. Uses CSS/DOM instead of relying on the legacy page's external Three.js CDN. |
| Aura Runner | Fully implemented and tested | Three lanes, keyboard and button lane controls, collectible hearts, obstacle collision, score, game-over and restart. |
| Mind Match | Fully implemented and tested | Sixteen cards/eight pairs, two-card matching, move count, mismatch delay, and completion state. |
| Guess My Craving | Fully implemented and tested | Preserves the original branching question tree, results, and restart behavior. |
| Game invitations | Fully implemented and tested | Uses existing accepted-connection APIs and persists the invitation through the existing chat message model. |
| Saved game scores/rewards | Not implemented | Neither legacy source nor SQLite schema has persistent score, reward, or achievement tracking. Scores are limited to the active play session. |
| Yoga images and embedded videos | Partially implemented | The legacy image directory contains only its README; no image files or local videos exist. Original YouTube search links are retained. |
| Legacy language switching in React wellness screens | Partially implemented | English, Hindi, and Kannada locale JSON files remain available to the legacy application; the new React wellness pages currently use English and do not yet wire those translations. |

## Legacy implementation inspected

- `backend/legacy/main.py`: authenticated `/yoga`, `/games`, four game routes,
  and game-invitation form handler.
- `backend/legacy/models_social.py` and `backend/legacy/models_tracker.py`:
  existing chat/connection persistence and daily `exercise_minutes` field.
- `backend/app/api/v1/routes/connections.py` and
  `backend/app/schemas/social.py`: modern accepted-connection invitation API
  and allowed game names.
- `frontend/legacy_templates/yoga.html`: six pose cards, animated breathing
  circle, 30-second-per-pose session and external video-search URLs.
- `frontend/legacy_templates/games.html`: four original game descriptions and
  connected-friend invitations.
- `frontend/legacy_templates/game_bubbles.html`: unhurried bubble popping.
- `frontend/legacy_templates/game_runner.html`: three-lane runner, heart
  collection, obstacle avoidance, keyboard movement, score and restart.
- `frontend/legacy_templates/game_match.html`: eight self-care pairs and move
  tracking.
- `frontend/legacy_templates/game_craving.html`: original branching craving
  questionnaire and results.
- `frontend/public/static/locales/en.json`, `hi.json`, `kn.json`: legacy
  localized labels and descriptions.
- `frontend/public/static/img/yoga/README.txt`: optional image filenames;
  directory contains no tutorial images.
- Existing React routes, patient dashboard, layout, styles, API wrapper and
  query-state components.
- Active SQLite schema, inspected read-only: `users`, `pcos_profiles`,
  `daily_logs`, `doctor_profiles`, `connections`, and `chat_messages`. No
  wellness tutorial, game score, reward, or progress tables exist.

## Migrated implementation

### Backend

- Added patient-only `GET /api/v1/wellness/tutorials` and
  `GET /api/v1/wellness/tutorials/{tutorial_id}`.
- Added patient-only `GET /api/v1/wellness/games`.
- Added typed Pydantic response schemas and a catalog service sourced from the
  legacy tutorial/game content.
- Reused `POST /api/v1/connections/{friend_id}/games/invite` for invitations.
- No migration or database/schema change was made.
- Doctor and unauthenticated access to the catalog are covered by regression
  tests.

### Frontend

- Added the React Yoga & movement list, tutorial detail page, breathing guide,
  and stoppable guided session.
- Added the games hub with loading/error states, all four playable games,
  invitation form, empty support-circle state, and current-session scores.
  Tests cover bubble scores, runner controls and collectible score, matching,
  mismatch recovery, and the craving tree/restart.
- Added patient-only routes and patient dashboard/navigation links.
- Retained the original legacy HTML templates and static files; no legacy
  implementation was deleted.

## Validation

- Backend: `python -m pytest -q -c pytest.ini` — 21 passed.
- Frontend targeted wellness tests: 11 passed.
- Frontend full suite and production build: pending final validation run.
- Live browser-based E2E and screenshots: not run.
- Live Azure inference: not required for these features and not run.
- Existing SQLite file was inspected read-only. Tests use an isolated in-memory
  database. No wellness feature writes to the production database.

## Remaining work

1. Add an exercise tutorial catalog only if the intended exercise routines,
   steps, and safety text can be sourced from the project owner or original
   materials; the existing legacy application contains only daily exercise
   minute logging.
2. Wire existing Hindi/Kannada locale content into the React wellness pages if
   language switching must remain available in the modular frontend.
3. Add durable progress/achievement storage only if that behavior is desired;
   it is not present in the legacy implementation and would require a reviewed
   database migration.
4. Run manual/browser E2E with a signed-in patient and test the games on
   representative desktop and mobile browsers.

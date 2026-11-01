# Feature Preservation Checklist

Phase 1 baseline: items below are **present** only where described as implemented in the existing application. Migration status remains unchecked until the new frontend/backend behavior is implemented and tested against the existing workflow.

| Area | Existing behavior to preserve | Migration verified |
|---|---|---|
| Patient registration | Signup with patient role, required account fields, password confirmation | [ ] |
| Doctor registration | Signup with doctor role; profile remains a separate step | [ ] |
| Login/logout | Password verification, JWT cookie, redirect behavior | [ ] |
| Password security | Hashed passwords; never return hashes to frontend | [ ] |
| Role handling | Doctor-only clinic-profile routes and navigation behavior | [ ] |
| PCOS assessment form | Age, measurements, cycle, cycle length, seven symptom flags | [ ] |
| BMI | Existing height/weight calculation and rounding in `detection.py` | [ ] |
| Screening score | Existing weights, max score, and Low/Moderate/High thresholds unchanged | [ ] |
| Screening disclaimer | Clearly state screening is not a diagnosis | [ ] |
| Assessment history | **Not present**; a single profile is updated in place. Do not imply history exists. | N/A |
| Daily tracker | Period, cramps, water, exercise, sleep, mood, junk food, notes | [ ] |
| Tracker persistence | Create/update today's log; recent list shows up to 14 entries | [ ] |
| Tracker deletion | **No delete route/UI found**; preserve current behavior unless separately scoped | N/A |
| Reports/charts | Cramp trend, sleep/exercise, mood distribution, water intake | [ ] |
| PDF | Backend-generated report from current profile and up to 30 recent logs | [ ] |
| Doctor profile/directory | Doctor clinic details and patient-facing directory | [ ] |
| Appointment/payment/prescription | **Not present**; do not add without a separate product request | N/A |
| Connections | Send and accept pending requests; relationship type | [x] |
| Real-time chat | Authenticated WebSocket, configured-origin and accepted-connection checks, persistent messages | [x] |
| Care alert | Persisted alert based on today's health log, broadcast to chat | [x] |
| Games | Bubble, runner, match, craving games and their current interactions | [ ] |
| Game invites | Persist invitation in connected user's chat | [x] |
| Yoga/exercise | Breathing guide, six poses, timed session, tutorial search links | [ ] |
| Translations | English, Hindi, Kannada; preserve all 167 keys per locale | [ ] |
| Chatbot | Conversation history sent to backend; explicit unavailable/error state | [x] |
| Azure OpenAI | Server-side configured client; missing credentials/provider failures tested with mocked responses | [x] |
| Doctor access to patient records | **Not present**; never expose without approved consent/authorization model | N/A |

## Regression test sequence

1. Compare request/response and redirects for registration/login/logout.
2. Verify role-specific profile authorization and current user scoping.
3. Use fixed profile inputs to assert exact BMI, score, and risk category from the existing implementation.
4. Save/read today's tracker entry and inspect recent history.
5. Verify report empty states, chart data mapping, and PDF response bytes.
6. Exercise doctor profile, connection request/accept, WebSocket persistence, care alerts, and game invites.
7. Interact with all four games and yoga session controls in a browser.
8. Compare locale key sets and test language switching in React.
9. Mock Azure responses and unavailable/timeout conditions; never use canned fake success messages.

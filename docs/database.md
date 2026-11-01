# Existing SQLite Database

## Source of truth

The existing database is `pcos_gynocare.db` at the project root. The current engine URL is the relative path `sqlite:///./pcos_gynocare.db` in `database.py`. Because it is relative to the process working directory, launching from a different directory can point to or create a different file. The refactor must resolve a configurable path to this existing file without creating competing copies.

Phase 1 inspected the database in read-only mode. At inspection time, it contained six application tables; `users` had one row, and the other five tables had zero rows. No user values were read into documentation. The database file was approximately 69 KB. No schema migration was performed or indicated by this inspection.

## Tables and fields

### `users`

Declared in `models.py`.

| Column | Type | Constraints/default |
|---|---|---|
| `id` | Integer | Primary key |
| `full_name` | String | Not null |
| `email` | String | Not null; model declares indexed and unique |
| `mobile` | String | Nullable; model declares indexed and unique |
| `hashed_password` | String | Not null |
| `role` | String | Default `patient` |
| `preferred_language` | String | Default `en` |
| `created_at` | DateTime | Default UTC now |

### `pcos_profiles`

Declared in `models_tracker.py`; one profile per user (`user_id` is unique).

| Column group | Fields |
|---|---|
| Identity | `id` primary key, `user_id` foreign key to `users.id` |
| Measurements | `age`, `height_cm`, `weight_kg` |
| Cycle | `cycle_regularity` (default `regular`), nullable `avg_cycle_length_days` |
| Symptom flags | `excessive_hair_growth`, `acne`, `hair_thinning`, `skin_darkening`, `weight_gain_difficulty`, `family_history_pcos`, `mood_swings` |
| Timestamp | `updated_at` |

### `daily_logs`

Declared in `models_tracker.py`; many logs per user. The current application uses one entry per user/date but the schema does not declare a unique constraint on that pair.

| Column group | Fields |
|---|---|
| Identity | `id` primary key, `user_id` foreign key to `users.id` |
| Date and period | `log_date`, `on_period` |
| Daily measures | `cramp_pain_level`, `water_intake_liters`, `exercise_minutes`, `sleep_hours`, `mood`, `junk_food`, nullable `notes` |
| Timestamp | `created_at` |

### `doctor_profiles`

Declared in `models_doctor.py`; `user_id` is unique and references `users.id`.

Fields: `id`, `user_id`, required `clinic_name`, `specialization`, required `city`, required `address`, required `phone`, `consultation_hours`, nullable `about`, nullable `photo_url`, and `updated_at`.

### `connections`

Declared in `models_social.py`; requester and receiver both reference `users.id`.

Fields: `id`, `requester_id`, `receiver_id`, `relationship_type` (default `friend`), `status` (default `pending`), and `created_at`.

### `chat_messages`

Declared in `models_social.py`; sender and receiver both reference `users.id`.

Fields: `id`, `sender_id`, `receiver_id`, required `content`, `message_type` (default `text`; care alerts use `care_alert`), and `created_at`.

## Relationships and constraints

Foreign-key constraints connect profile/log/doctor rows to users and connect both ends of relationships/messages to users. The profile tables `pcos_profiles` and `doctor_profiles` have unique `user_id` constraints. The SQLAlchemy classes express foreign keys but do not declare ORM `relationship()` properties.

The inspected existing database has unique indexes on doctor/profile `user_id`, and indexed user email/mobile columns. The schema must not be rebuilt or “cleaned up” merely to match a new architecture. Before any future schema change, make a verified backup and document the migration; a schema change is not currently required.

## Current database ownership

Only the FastAPI backend/SQLAlchemy should access SQLite. The React frontend must communicate through backend APIs and must never connect to the database directly.

# PCOS GynoCare Project Workflow

This diagram summarizes the current React/FastAPI migration, its main user journeys, and the original app retained as a fallback.

```mermaid
flowchart TD
    Browser["Browser: React/Vite frontend"]
    App["Modular FastAPI API<br/>backend/app"]
    Startup["Backend startup<br/>preserve existing SQLite schema"]
    Routes["Versioned JSON routes<br/>/api/v1"]
    LegacyBrowser["Legacy browser UI"]
    Legacy["Original FastAPI/Jinja2 app<br/>fallback"]
    Auth["Read access_token cookie<br/>decode JWT and find user"]
    Login["Sign up / Log in"]
    Password["Hash or verify password"]
    Cookie["Set httpOnly access_token cookie"]
    LoginPage["Login page"]
    Home["Home dashboard"]

    Browser --> App
    App --> Startup
    Browser -->|"HTTP API request"| Routes
    LegacyBrowser -->|"HTML / form requests"| Legacy
    Routes -->|"Public: login, signup"| Login
    Login --> Password
    Password -->|"Valid / account created"| Cookie
    Cookie --> Home
    Routes -->|"Protected page or action"| Auth
    Auth -->|"No valid user"| LoginPage
    Auth -->|"Authenticated"| Home
    LoginPage --> Login

    subgraph Patient["React patient features"]
        Assessment["Assessment form"]
        Profile["Save / update PCOSProfile"]
        Screen["detection.py<br/>BMI + screening result"]
        Tracker["Daily tracker form"]
        DailyLog["Save / update today's DailyLog"]
        Reports["Reports page"]
        Charts["charts.py<br/>charts from daily logs"]
        PDF["pdf_report.py<br/>download PDF"]
        Doctors["Browse doctor directory"]
        Connections["Connections page + API<br/>send / accept request"]
        Care["Care alert<br/>uses today's log"]
        Chat["Chat page + authenticated WebSocket"]
        Games["Games + invitations"]
        Yoga["Yoga and exercise page"]
        Bot["GynoBuddy widget + chat API"]
    end

    Home --> Assessment
    Assessment --> Profile
    Profile --> Screen
    Screen --> Home
    Home --> Tracker
    Tracker --> DailyLog
    DailyLog --> Tracker
    Home --> Reports
    Profile --> Reports
    DailyLog --> Reports
    Reports --> Charts
    Reports --> PDF
    Home --> Doctors
    Home --> Connections
    Connections -->|"Accepted connection"| Chat
    Connections --> Care
    Care -->|"Persist message and broadcast"| Chat
    Chat -->|"Persist message and broadcast"| Chat
    Home --> Games
    Games -->|"Invite accepted connection"| Chat
    Home --> Yoga
    Home --> Bot
    Bot -->|"Server-side Azure OpenAI request"| AIService["Configured AI service"]

    subgraph Storage["Persistence: SQLite via SQLAlchemy"]
        DB[("pcos_gynocare.db")]
        Users["User"]
        Clinical["PCOSProfile"]
        Logs["DailyLog"]
        DoctorProfile["DoctorProfile"]
        Social["Connection + ChatMessage"]
    end

    App -->|"SQLAlchemy session; no create_all()"| DB
    Legacy -->|"Legacy fallback uses existing schema"| DB
    DB --- Users
    DB --- Clinical
    DB --- Logs
    DB --- DoctorProfile
    DB --- Social
    Login -.-> Users
    Profile -.-> Clinical
    DailyLog -.-> Logs
    Doctors -.-> DoctorProfile
    Connections -.-> Social
    Chat -.-> Social
    Care -.-> Logs
    Care -.-> Social
    Charts -.-> Logs
    PDF -.-> Clinical
    PDF -.-> Logs
    PDF -.-> Users

    Translation["Legacy translation API<br/>/api/translations/{en|hi|kn}"]
    Legacy --> Translation

    classDef app fill:#e8f0fe,stroke:#4285f4,color:#172554
    classDef feature fill:#eaf7ef,stroke:#38a169,color:#123524
    classDef data fill:#fff4df,stroke:#d69e2e,color:#422006
    class App,Routes,Auth,Startup,Legacy app
    class Assessment,Profile,Screen,Tracker,DailyLog,Reports,Charts,PDF,Doctors,Connections,Care,Chat,Games,Yoga,Bot feature
    class DB,Users,Clinical,Logs,DoctorProfile,Social data
```

## Main data flow

- **Authentication:** signup hashes the password and creates a user; login verifies the hash. Both issue an `httpOnly` JWT cookie. React sends the cookie to protected API routes.
- **PCOS assessment:** profile form → save `PCOSProfile` → run the screening function → show the result.
- **Daily tracking:** tracker form → save or update the user's log for today. Reports use the saved profile and recent logs for charts and PDF output.
- **Doctor and community features:** doctor accounts can save a `DoctorProfile`; users can browse doctors and create accepted connections. The API checks the connection and frontend origin before establishing WebSocket chat; messages, care alerts, and game invitations are persisted.
- **Other features:** authenticated users can open the chatbot, games, and yoga pages. The language API returns English, Hindi, or Kannada translation data.

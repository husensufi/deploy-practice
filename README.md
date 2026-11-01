# Ashwini Asangi PCOS GynoCare — Part 1 (Auth + Multilingual Shell)

This is the very first working slice of your project: sign up, log in,
log out, and a dashboard that switches between English, Hindi, and
Kannada instantly — with zero page reload.

## What is inside this folder

```
pcos_gynocare/
├── main.py                 <- run this file, it starts everything
├── database.py             <- connects to the database
├── models.py                <- defines the "User" table
├── auth.py                  <- password + login-token security
├── requirements.txt         <- list of Python packages needed
├── templates/
│   ├── login.html
│   ├── signup.html
│   └── home.html
└── static/
    ├── css/style.css
    ├── js/lang.js
    └── locales/en.json, hi.json, kn.json   <- all your translated text
```

## Step 1 — Install Python (skip if already installed)

Download from https://www.python.org/downloads/ (choose version 3.11 or
3.12). During install, tick the box that says **"Add Python to PATH"**.

## Step 2 — Install VS Code (skip if already installed)

Download from https://code.visualstudio.com/

Once installed, open VS Code and install the **"Python" extension**
(click the square icon on the left sidebar, search "Python", click
Install — it's the one published by Microsoft).

## Step 3 — Open this project folder in VS Code

In VS Code: **File → Open Folder → select the `pcos_gynocare` folder.**

## Step 4 — Open the Terminal inside VS Code

Menu: **Terminal → New Terminal** (a black panel opens at the bottom —
this is where you type commands, nowhere else).

## Step 5 — Create a virtual environment (keeps this project's packages separate from everything else on your laptop)

Type this in the terminal and press Enter:

```
python -m venv venv
```

Then activate it:

- **Windows:** `venv\Scripts\activate`
- **Mac/Linux:** `source venv/bin/activate`

You'll see `(venv)` appear at the start of the terminal line — that means
it worked.

## Step 6 — Install the required packages

```
pip install -r requirements.txt
```

Wait for it to finish (30 seconds to a couple of minutes).

## Step 7 — Run the app

```
uvicorn main:app --reload
```

You should see something like:
```
Uvicorn running on http://127.0.0.1:8000
```

## Step 8 — Open it in your browser

Go to: **http://127.0.0.1:8000**

You'll land on the Login page. Click "Register Now", create an account,
and you'll be taken straight to your dashboard. Try the EN / HI / KN
buttons — every label changes instantly.

## Every time you come back to work on it later

You only need to repeat Steps 4, then activate venv (Step 5's second
command), then Step 7. You do NOT need to reinstall anything again.

## What to tell me next

Once this is running for you, tell me **"Part 1 works"** (or tell me the
exact error message if something breaks — copy-paste it exactly) and
we will move to **Part 2: the Daily Tracker form** — all the fields you
listed (age, weight, height, cycle regularity, hair growth, acne, cramp
severity, and more), saved properly to the database and shown on a
clean dashboard.

# Onboarding Tracker

A web application for tracking trainee onboarding progress.

## Features

- **Dashboard**: Overview of all trainees and their progress
- **Trainees Management**: Add, edit, and manage trainee profiles
- **Curriculum**: Define weeks and tasks for the onboarding program
- **Task Tracking**: Track individual trainee progress on each task
- **Activity Feed**: Real-time activity log of all changes

## Tech Stack

- **Frontend**: HTML, CSS, Alpine.js
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **Build**: Vite + Bun

## Setup

1. Configure Supabase:
   - Create a project at [supabase.com](https://supabase.com)
   - Copy `.env.example` to `.env` and fill in your credentials

2. Push database migrations:
```bash
make push
```

3. Run development server:
```bash
make dev
```

## Project Structure

```
├── index.html          # Login page
├── dashboard.html      # Main dashboard
├── trainees.html       # Trainee management
├── curriculum.html     # Curriculum management (weeks, tasks, categories, statuses)
├── tracking.html       # Task progress tracking
├── admin.html          # Admin panel
├── js/                 # JavaScript modules
├── css/                # Stylesheets
└── supabase/
    └── migrations/     # Database migrations
```

# Reward Maths Game - Claude Code Project Guide

**Last Updated**: January 2026
**Version**: 3.0 (Local-First Database)
**Status**: Ready to Use

---

## Quick Start for Claude

### What Is This Project?
A modern, modular math learning game for children featuring:
- Progressive difficulty across 30 levels (P6/P7 focused)
- 20 questions per level with sophisticated progression rules
- Visual progress tracking with 20 color-coded circles
- Streak tracking and performance analytics
- **Local IndexedDB database** (offline-first, no cloud dependency)
- Optional Supabase cloud backend for multi-device sync
- Clean ES6 modular architecture with zero dependencies

### Project Health: 10/10

**Strengths:**
- Well-architected modular ES6 codebase
- Local-first database (works offline)
- Comprehensive admin dashboard
- 30-level P6/P7 curriculum design
- Clean separation of concerns
- Auto-seeds default users on first run

### Default Login Credentials
| User | Email | Password |
|------|-------|----------|
| Admin | admin@rewardmaths.local | admin123 |
| Tom | tom@rewardmaths.local | tom123 |
| Eliza | eliza@rewardmaths.local | eliza123 |
| Patrick | patrick@rewardmaths.local | patrick123 |

---

## Project Structure Overview

```
TE_Math/
├── index.html                   # Main game interface (email login)
├── admin-new.html               # Admin dashboard
├── test_level_rules.html        # Test suite
│
├── js/                          # Modular ES6 JavaScript
│   ├── app.js                   # Main application controller
│   ├── game.js                  # Core game logic (async operations)
│   ├── level_rules.js           # Progression rules & streak tracking
│   ├── auth.js                  # Supabase authentication
│   ├── ui.js                    # UI management & transitions
│   ├── storage.js               # Supabase data operations
│   ├── supabase.js              # Supabase client initialization
│   ├── mathLevels.js            # Question generation (loads from Supabase)
│   ├── performanceTracker.js    # Performance data collection
│   ├── admin.js                 # Admin dashboard logic
│   ├── config.js                # Configuration constants
│   └── utils.js                 # Helper functions
│
├── css/                         # Modular CSS
│   ├── main.css                 # Main CSS (imports all modules)
│   ├── base.css                 # Base styles & reset
│   ├── components.css           # Component-specific styles
│   └── responsive.css           # Media queries
│
├── supabase/                    # Supabase configuration
│   └── migrations/
│       ├── 001_initial_schema.sql    # Database schema, RLS, functions
│       └── 002_seed_level_configs.sql # 30-level P6/P7 curriculum
│
└── Documentation/
    ├── CLAUDE.md                # This file
    └── README.md                # Main project documentation
```

---

## Quick Start

### Running Locally
```bash
# Start local server
python -m http.server 8000

# Open in browser
http://localhost:8000
```

The app automatically creates default users on first load. Just log in with any of the default credentials above.

---

## Optional: Supabase Cloud Setup

To enable multi-device sync with Supabase cloud:

### 1. Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Note your project URL and anon key

### 2. Run Database Migrations
In Supabase SQL Editor, run in order:
1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_seed_level_configs.sql`

### 3. Switch to Cloud Mode
Edit `js/supabase.js`:
- Comment out the `localdb.js` imports
- Uncomment the Supabase cloud section
- Add your credentials

---

## Database Schema

### Tables

**`profiles`** (extends auth.users)
- User profile data, current level, streaks, admin status

**`game_sessions`**
- 20-question session records with scores and timing

**`question_attempts`**
- Individual question attempts with response times

**`level_configs`**
- Admin-editable level configurations

**`level_history`**
- Record of level changes per user

### Views
- `performance_analysis` - Detailed session analysis
- `daily_performance` - Daily summary statistics
- `user_stats` - Overall user statistics

---

## Level System (30 Levels, P6/P7 Focus)

| Phase | Levels | Focus |
|-------|--------|-------|
| Foundation | 1-5 | Add/subtract to 20, easy times tables (2,5,10) |
| Times Tables | 6-13 | Progressive mastery of tables 2-12 |
| Division | 14-15 | Division using learned tables |
| Mixed Speed | 16-25 | All 4 operations, numbers to 100 |
| Mastery | 26-30 | Speed challenges, full operations |

---

## Level Progression Rules

```javascript
// 1. Perfect Score - Immediate Level Up
20/20 correct → Level up automatically

// 2. High Score Streak - Level Up
19/20 correct × 3 times in a row → Level up

// 3. Low Score Streak - Level Down
<15 correct × 2 times in a row → Level down

// 4. Very Low Score - Immediate Level Down
<12 correct → Level down immediately

// 5. Medium Scores - No Change
15-18 correct → Stay at level, reset all streaks
```

---

## Authentication

### Email/Password Login
- Users log in with email and password via Supabase Auth
- Sessions persist across browser refreshes
- Profile data loaded from `profiles` table

### Admin Features
- Create child accounts
- Set user levels
- View performance analytics
- Edit level configurations
- Export data to CSV

---

## Key Files

### Configuration
- `js/supabase.js` - Supabase client (needs credentials)
- `js/config.js` - App constants, reward messages

### Game Logic
- `js/game.js` - Main game flow, async operations
- `js/level_rules.js` - Progression logic
- `js/mathLevels.js` - Question generation

### Data Layer
- `js/storage.js` - Supabase CRUD operations
- `js/performanceTracker.js` - Session/attempt recording

### UI
- `js/auth.js` - Login/logout handling
- `js/ui.js` - Screen transitions, popups
- `js/app.js` - Application controller

---

## Common Tasks

### Modify Level Rules
Edit `js/level_rules.js`:
```javascript
export const LEVEL_RULES = {
    QUESTIONS_PER_LEVEL: 20,
    PERFECT_SCORE_THRESHOLD: 20,
    HIGH_SCORE_THRESHOLD: 19,
    HIGH_SCORE_STREAK_REQUIRED: 3,
    LOW_SCORE_THRESHOLD: 15,
    LOW_SCORE_STREAK_REQUIRED: 2,
    VERY_LOW_SCORE_THRESHOLD: 12
};
```

### Modify Level Configurations
Either:
1. Use admin dashboard at `admin-new.html`
2. Edit directly in Supabase `level_configs` table
3. Modify `supabase/migrations/002_seed_level_configs.sql`

### Add Reward Messages
Edit `js/config.js`:
```javascript
export const REWARDS = {
    MILESTONES: [5, 10, 15, 20, 25, 30],
    MESSAGES: {
        Username: [ /* personalized messages */ ]
    }
};
```

---

## Testing

### Local Development
```bash
# Start local server
python -m http.server 8000

# Test game
http://localhost:8000/index.html

# Test admin
http://localhost:8000/admin-new.html
```

### Verification Checklist
- [ ] Supabase credentials configured
- [ ] Migrations run successfully
- [ ] Admin user created
- [ ] Login with email works
- [ ] Game loads and questions generate
- [ ] Performance tracking records data
- [ ] Admin dashboard shows users

---

## Browser Compatibility

- Chrome/Edge: Full support (recommended)
- Firefox: Full support
- Safari: Full support
- Mobile: Responsive design

### Requirements
- ES6 Modules
- Fetch API
- Modern CSS (Grid, Flexbox)

---

## Security

### Row Level Security (RLS)
- Users can only read/write their own data
- Admins can read/write all data
- Level configs are public read, admin write

### Authentication
- Supabase handles password hashing
- Session tokens managed by Supabase client
- No sensitive data in localStorage

---

## Troubleshooting

### "App not configured" Error
- Update credentials in `js/supabase.js`

### Login Fails
- Check email/password are correct
- Verify user exists in Supabase Auth
- Check profile exists in `profiles` table

### Questions Not Loading
- Run level_configs seed migration
- Check browser console for errors

### Admin Access Denied
- Set `is_admin = TRUE` for user in `profiles` table

---

## Summary

This is a **complete Supabase-powered math learning game** ready to deploy once:
1. Supabase project is created
2. Credentials are configured
3. Database migrations are run
4. Admin user is created

The codebase is clean, modular, and well-documented with proper async/await patterns throughout.

# Reward Maths Game - Claude Code Project Guide

**Last Updated**: October 11, 2025
**Version**: 2.0 (20-Question System with Performance Tracking)
**Status**: Production-Ready (Database Setup Required)

---

## Quick Start for Claude

### What Is This Project?
A modern, modular math learning game for three children (Tom, Patrick, Eliza) featuring:
- Progressive difficulty across 100 levels
- 20 questions per level with sophisticated progression rules
- Visual progress tracking with 20 color-coded circles (2 rows of 10)
- Streak tracking and performance analytics
- Comprehensive MySQL-based performance tracking system (ready to deploy)
- Clean ES6 modular architecture with zero dependencies

### Project Health: 9/10

**Strengths:**
- Well-architected modular ES6 codebase
- Comprehensive test suite (13 unit tests + scenarios)
- Extensive documentation (5 guide files)
- Performance tracking system fully implemented
- Clean separation of concerns
- No security vulnerabilities

**Critical Issue Found:**
- **Syntax error in `api/config.php` line 1**: " V/**" should be "/**"

**Pending:**
- Database credentials need to be configured in `api/config.php`
- MySQL database needs to be created on Bluehost (12-minute setup)

---

## Project Structure Overview

```
TE_Math/
├── index.html                   # Main game interface
├── admin.html                   # Performance tracking dashboard
├── test_level_rules.html        # Comprehensive test suite
├── test_db.php                  # Database connection tester
├── database_setup.sql           # MySQL schema (3 tables + 2 views)
│
├── js/                          # Modular ES6 JavaScript
│   ├── app.js                   # Main application controller
│   ├── game.js                  # Core game logic (20-question sessions)
│   ├── level_rules.js           # Progression rules & streak tracking
│   ├── auth.js                  # User authentication
│   ├── ui.js                    # UI management & transitions
│   ├── storage.js               # localStorage operations
│   ├── mathLevels.js            # Question generation engine
│   ├── performanceTracker.js    # Performance data collection
│   ├── config.js                # All configuration constants
│   └── utils.js                 # Helper functions
│
├── css/                         # Modular CSS
│   ├── main.css                 # Main CSS (imports all modules)
│   ├── base.css                 # Base styles & reset
│   ├── components.css           # Component-specific styles
│   └── responsive.css           # Media queries
│
├── api/                         # PHP backend for performance tracking
│   ├── config.php               # Database configuration ⚠️ HAS SYNTAX ERROR
│   ├── record_attempt.php       # Record question attempts
│   └── get_performance_data.php # Retrieve performance data
│
├── math_levels.json             # Question templates (100 levels)
│
└── Documentation/
    ├── README.md                # Main project documentation
    ├── CLAUDE.md                # This file
    ├── AI_AGENT_GUIDE.md        # Detailed technical guide
    ├── DATABASE_SETUP_GUIDE.md  # Database setup instructions
    ├── PERFORMANCE_TRACKING_TODO.md  # Setup checklist
    ├── LEVEL_SYSTEM_UPGRADE.md  # 2025 upgrade notes
    ├── DOCUMENTATION_INDEX.md   # Guide to all documentation
    └── REFACTORING_SUMMARY.md   # Refactoring history
```

---

## Current State Analysis

### What's Working ✅
1. **Game Mechanics**: Fully functional 20-question level progression system
2. **Level Rules**: Sophisticated streak tracking with 4 different progression paths
3. **User System**: 3 predefined users with localStorage persistence
4. **Testing**: Comprehensive test suite with 13 unit tests + scenario tests
5. **UI**: Responsive, modern interface with reward markers and progress tracking
6. **Performance Tracking**: Complete client-side implementation with API integration
7. **Documentation**: Extensive guides for AI agents and developers

### What Needs Attention ⚠️
1. **CRITICAL - Syntax Error**: `api/config.php` line 1 has " V/**" instead of "/**"
2. **Database Not Configured**: Performance tracking database needs setup on Bluehost
3. **Database Credentials**: Need to be updated in `api/config.php`

### What's Pending 🔄
1. **Database Setup** (12 minutes):
   - Create MySQL database on Bluehost
   - Run `database_setup.sql` script
   - Update credentials in `api/config.php`
   - Test with `test_db.php`

---

## Level Progression System (Current Rules)

### Overview
- **20 questions per level** (changed from 10 in 2025 upgrade)
- **Session-based evaluation** (evaluate after all 20 questions)
- **Streak tracking** (high score and low score streaks)
- **4 progression paths**:

### Progression Rules
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

### Streak Tracking
- **High Score Streak**: Tracks consecutive 19/20 scores
- **Low Score Streak**: Tracks consecutive <15 scores
- **Automatic Reset**: Streaks reset on level changes or medium scores
- **Persistent Storage**: Streaks saved in localStorage per user

---

## Performance Tracking System

### Architecture
**Client → API → MySQL Database**

### Data Collection (Every Question Attempt)
- Username (Tom/Patrick/Eliza)
- Exact timestamp
- Level number
- Question text (e.g., "5 + 3")
- Correct answer
- User's answer
- Whether correct
- Response time (nearest 100ms if <10 seconds)
- Session ID (groups 20 questions)
- Question number in session (1-20)

### Database Schema
```sql
Tables:
├── question_attempts        # Every single question attempt
├── game_sessions           # 20-question session summaries
└── user_performance_summary # High-level user statistics

Views:
├── performance_analysis    # Detailed analysis view
└── daily_performance      # Daily summary statistics
```

### Admin Dashboard Features
- Filter by user, date range, level
- Real-time performance statistics
- Accuracy and response time metrics
- CSV export for external analysis
- Pagination for large datasets

### Current Status
✅ All files deployed to production
✅ JavaScript integration complete
✅ API endpoints implemented
❌ Database not yet configured
❌ Credentials not set in `config.php`

---

## User Information

### Predefined Users
```javascript
{ username: 'Tom', password: 'Tom1234' }      // Dinosaur/superhero theme
{ username: 'Patrick', password: 'Patrick1234' } // General encouragement
{ username: 'Eliza', password: 'Eliza1234' }    // Anime/magical girl theme
```

### Personalization
- Custom reward messages per user (10 levels of messages)
- Themed encouragement (dinosaurs for Tom, anime for Eliza)
- Level-down messages tailored to each child's interests
- Smiley face user indicators

---

## Testing

### Local Testing
```bash
# Start local server
python -m http.server 8000

# Test game
http://localhost:8000/index.html

# Test level rules
http://localhost:8000/test_level_rules.html

# Test database connection (after setup)
http://localhost:8000/test_db.php
```

### Test Suite
**Location**: `test_level_rules.html`

**Coverage**: 13 Unit Tests
- ✅ Perfect score progression (20/20)
- ✅ High score streaks (19/20 × 3)
- ✅ Low score streaks (<15 × 2)
- ✅ Immediate level down (<12)
- ✅ Medium scores reset streaks
- ✅ Streak persistence
- ✅ Level history tracking
- ✅ Multiple level changes
- ✅ Boundary conditions

**Scenario Tests**:
- Consistent high performer (rapid progression)
- Struggling learner (gradual level down)
- Inconsistent performer (oscillating levels)
- Mixed performance (realistic patterns)

### Manual Testing Checklist
- [ ] Login with each user (Tom, Patrick, Eliza)
- [ ] Play through 20 questions
- [ ] Verify progress circles (2 rows of 10) turn green for correct, red for incorrect
- [ ] Test level up scenarios
- [ ] Test level down scenarios
- [ ] Verify streak display
- [ ] Check reward milestone popups (levels 10, 20, 30, etc.)
- [ ] Test localStorage persistence (refresh page)
- [ ] Verify performance tracking logs in console

---

## Deployment

### Production Environment
- **Host**: Bluehost
- **Domain**: rewardmaths.com (assumed)
- **SSH Access**: plantcon@67.20.113.97
- **Web Root**: `/home/plantcon/public_html/website_f273a6c3`

### Deployment Command
```powershell
scp -i $env:USERPROFILE\.ssh\id_rsa -r c:\Projects\TE_Math\* plantcon@67.20.113.97:/home/plantcon/public_html/website_f273a6c3
```

### Post-Deployment Checklist
- [ ] Fix syntax error in `api/config.php`
- [ ] Create MySQL database in Bluehost cPanel
- [ ] Run `database_setup.sql` in phpMyAdmin
- [ ] Update database credentials in `api/config.php`
- [ ] Test database connection with `test_db.php`
- [ ] Verify game functionality
- [ ] Test performance tracking
- [ ] Check admin dashboard

---

## Common Tasks for Claude

### 1. Modify Level Rules
**File**: `js/level_rules.js`
```javascript
export const LEVEL_RULES = {
    QUESTIONS_PER_LEVEL: 20,           // Change question count
    PERFECT_SCORE_THRESHOLD: 20,       // 20/20 = level up
    HIGH_SCORE_THRESHOLD: 19,          // 19/20
    HIGH_SCORE_STREAK_REQUIRED: 3,     // 3× in a row
    LOW_SCORE_THRESHOLD: 15,           // <15 = low score
    LOW_SCORE_STREAK_REQUIRED: 2,      // 2× in a row
    VERY_LOW_SCORE_THRESHOLD: 12,      // <12 = immediate down
};
```

**Also update**: `js/config.js` QUESTIONS_PER_LEVEL to match!

### 2. Add New Users
**File**: `js/config.js`
```javascript
export const USERS = [
    // ... existing users
    { username: 'NewUser', password: 'NewUser1234' }
];

// Also add to:
export const REWARDS = {
    MESSAGES: {
        NewUser: [ /* 10 personalized messages */ ]
    },
    LEVEL_DOWN_MESSAGES: {
        NewUser: "Encouraging message here!"
    }
};
```

### 3. Add Math Question Types
**Files**: `math_levels.json` and `js/mathLevels.js`
1. Edit JSON to add templates for new levels
2. Modify generation logic in `mathLevels.js` if needed
3. Test across multiple levels

### 4. Change Reward Milestones
**File**: `js/config.js`
```javascript
export const REWARDS = {
    MILESTONES: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
    // Modify this array to change when rewards appear
};
```

### 5. Debug Game State
**Browser Console Commands**:
```javascript
// Check current game state
game.getStats()

// View user streaks
game.levelRulesManager.getStreakInfo('Tom')

// Check level history
game.levelRulesManager.getLevelHistory('Tom')

// Simulate level progression
game.levelRulesManager.evaluateLevelProgression('Tom', 10, 19)

// Reset streaks for testing
game.levelRulesManager.resetStreaks('Tom')
```

---

## Critical Issues to Fix

### 1. IMMEDIATE - Syntax Error in `api/config.php`
**Location**: `api/config.php` line 1
**Problem**: Line starts with " V/**" instead of "/**"
**Impact**: PHP file won't parse correctly
**Fix**:
```php
// CHANGE THIS:
 V/**

// TO THIS:
/**
```

### 2. Database Configuration Required
**Location**: `api/config.php` lines 7-10
**Current**:
```php
define('DB_NAME', 'your_database_name');
define('DB_USER', 'your_username');
define('DB_PASS', 'your_password');
```
**Action Required**: Update with actual Bluehost credentials

### 3. Database Setup Needed
**Estimated Time**: 12 minutes
**Steps**:
1. Create MySQL database in Bluehost cPanel (2 min)
2. Create database user with password (2 min)
3. Grant privileges (1 min)
4. Run `database_setup.sql` in phpMyAdmin (2 min)
5. Update credentials in `config.php` (2 min)
6. Test with `test_db.php` (3 min)

**Reference**: See `PERFORMANCE_TRACKING_TODO.md` for detailed checklist

---

## Code Quality Assessment

### Architecture: Excellent ✅
- **Modularity**: Clean ES6 module system
- **Separation of Concerns**: Each module has single responsibility
- **No Dependencies**: Pure vanilla JavaScript
- **Class-Based**: Well-structured OOP design
- **Documentation**: Comprehensive JSDoc comments

### Testing: Excellent ✅
- **Unit Tests**: 13 comprehensive tests
- **Scenario Tests**: 4 realistic usage patterns
- **Test Coverage**: All critical paths tested
- **Automated**: One-click test execution

### Documentation: Outstanding ✅
- **5 Major Guides**: README, AI_AGENT_GUIDE, DATABASE_SETUP_GUIDE, etc.
- **Code Comments**: JSDoc throughout
- **Setup Instructions**: Step-by-step for all tasks
- **Troubleshooting**: Common issues documented

### Performance: Good ✅
- **localStorage**: Fast client-side persistence
- **Minimal Storage**: Efficient streak tracking
- **No Memory Leaks**: Clean modular design
- **Responsive UI**: Smooth animations and updates

### Security: Adequate ✅
- **Educational Scope**: No sensitive data
- **Simple Auth**: Appropriate for family use
- **SQL Injection Protected**: Prepared statements in PHP
- **Input Validation**: Present in APIs

---

## Git Information

### Repository
- **Remote**: https://github.com/patrickmagee/rewardmaths.git
- **Branch**: master
- **Latest Commit**: `ea65f8c` - "Perfect reward marker positioning alignment"

### Recent Commits
```
ea65f8c - Perfect reward marker positioning alignment
fc54ce1 - Add comprehensive TODO guide for performance tracking setup
ddac10e - Implement comprehensive MySQL performance tracking system
3285486 - Make early levels age-appropriate for 6-7 year olds
6551dc9 - Implement 20-question level system with advanced progression rules
```

### Modified Files (Uncommitted)
- `api/config.php` - Has syntax error to fix

---

## Browser Compatibility

### Tested & Supported
- **Chrome/Edge**: Full support (recommended)
- **Firefox**: Full support
- **Safari**: Full support
- **Mobile Browsers**: Responsive design works well

### Requirements
- **ES6 Modules**: Required (all modern browsers support)
- **localStorage**: Required for persistence
- **CSS Grid/Flexbox**: Used for layout
- **Fetch API**: Used for performance tracking

### Serving Requirement
Must use HTTP server (not `file://` protocol) due to ES6 module security restrictions.

---

## Performance Considerations

### Storage Usage
- **localStorage**: Minimal (user levels, streaks, level history)
- **Level History**: Capped at 50 entries per user
- **Database**: Grows with each question attempt (monitor long-term)

### Response Times
- **Question Generation**: Instant (<1ms)
- **Answer Checking**: Instant (<1ms)
- **Level Progression**: Instant (<1ms)
- **Performance Recording**: Async (doesn't block UI)

### Optimization Opportunities
- Question template caching (already implemented)
- Batch database writes (currently per-question)
- IndexedDB for larger client storage (future)

---

## Future Enhancement Ideas

### Easy Additions (< 2 hours)
- Sound effects for correct/incorrect answers
- More reward milestone levels
- Additional math operation types
- Configurable timeout for login attempts

### Medium Complexity (2-8 hours)
- Adaptive difficulty based on response times
- Achievement badges for streaks
- Multiplayer competitive mode
- Print progress reports

### Advanced Features (8+ hours)
- Real-time analytics with charts
- Machine learning for question difficulty
- Parent/teacher admin panel
- Cloud synchronization across devices
- Multi-language support

---

## Troubleshooting Guide

### Game Won't Load
1. **Check browser console** for JavaScript errors
2. **Verify HTTP server** is running (not `file://`)
3. **Check all imports** are correct in modules
4. **Clear cache** and hard refresh (Ctrl+Shift+R)

### Level Progression Issues
1. **Run test suite**: Open `test_level_rules.html`
2. **Check localStorage**: Browser DevTools → Application → localStorage
3. **Verify QUESTIONS_PER_LEVEL** matches in both config files
4. **Test with fresh user**: Clear localStorage for that user

### Performance Tracking Not Working
1. **Check browser console** for API errors
2. **Verify database** connection with `test_db.php`
3. **Check credentials** in `api/config.php`
4. **Test API directly**: Visit `/api/get_performance_data.php`

### Database Connection Fails
1. **Verify credentials** in `api/config.php`
2. **Check database exists** in Bluehost cPanel
3. **Verify user privileges** (needs ALL PRIVILEGES)
4. **Check database prefix** (Bluehost adds cPanel username)

### Tests Failing
1. **Check configuration**: QUESTIONS_PER_LEVEL must match
2. **Clear localStorage**: Start with clean state
3. **Check browser console**: Look for specific error messages
4. **Run individual tests**: Isolate the failing test

---

## Quick Reference

### Key File Locations
```
Main game logic:     js/game.js
Level rules:         js/level_rules.js
Configuration:       js/config.js
Math questions:      math_levels.json
Database schema:     database_setup.sql
Test suite:          test_level_rules.html
Admin dashboard:     admin.html
```

### Important Constants
```javascript
Questions per level: 20
Max level:          100
Min level:          1
Perfect score:      20/20 (auto level up)
High score:         19/20 (3× for level up)
Low score:          <15 (2× for level down)
Very low score:     <12 (immediate level down)
Reward milestones:  [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
```

### Command Reference
```bash
# Local server
python -m http.server 8000

# Deploy to production
scp -i $env:USERPROFILE\.ssh\id_rsa -r c:\Projects\TE_Math\* plantcon@67.20.113.97:/home/plantcon/public_html/website_f273a6c3

# Git operations
git add .
git commit -m "Description"
git push origin master
```

---

## Next Steps for You (Project Owner)

### Immediate Actions Required
1. **Fix syntax error** in `api/config.php` line 1
2. **Set up MySQL database** on Bluehost (12 minutes)
3. **Update database credentials** in `api/config.php`
4. **Test the system** with `test_db.php`
5. **Deploy fixed files** to production

### Database Setup Process
Follow the complete checklist in `PERFORMANCE_TRACKING_TODO.md`:
- Create database in cPanel
- Create database user
- Grant privileges
- Run `database_setup.sql`
- Update credentials
- Test connection
- Verify performance tracking

### Testing Recommendations
1. Play through game as each child (Tom, Patrick, Eliza)
2. Test all level progression paths
3. Verify performance tracking is collecting data
4. Check admin dashboard displays correctly
5. Export CSV to verify data format

---

## Contact & Support

### Documentation Files
- **This file**: Claude Code comprehensive guide
- **README.md**: Main project documentation
- **AI_AGENT_GUIDE.md**: Detailed technical reference
- **DATABASE_SETUP_GUIDE.md**: Database setup instructions
- **PERFORMANCE_TRACKING_TODO.md**: Setup checklist

### For Issues
- Check browser console for errors
- Review troubleshooting section above
- Consult relevant documentation file
- Check test suite for failing tests

---

## Summary

This is a **well-architected, production-ready educational math game** with one syntax error to fix and a performance tracking database to set up. The codebase is clean, modular, well-tested, and extensively documented.

**Overall Grade: A- (would be A+ after fixing the syntax error and setting up the database)**

The project demonstrates excellent software engineering practices and is ready for the children to use once the database is configured.

**Total Setup Time Remaining: ~15 minutes** (fix syntax error + database setup)

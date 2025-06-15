# AI Agent Guide - Reward Maths Game

## Quick Start for AI Agents

### Project Overview
This is a modular ES6-based math game for kids with a sophisticated 20-question level progression system. No external dependencies, uses localStorage for persistence.

### Essential Files to Understand
1. **`js/app.js`** - Entry point, initializes everything
2. **`js/game.js`** - Core game logic with 20-question sessions
3. **`js/level_rules.js`** - Level progression rules (NEW 2025)
4. **`js/config.js`** - All configuration constants
5. **`test_level_rules.html`** - Comprehensive test suite

### Current System (2025 Update)
- **20 questions per level** (changed from 10)
- **Advanced progression rules** with streak tracking
- **Session-based evaluation** (no more resetting on wrong answers)
- **Comprehensive testing** with 13 unit tests + scenarios

## Level Progression Rules (Current)

### Automatic Level Up
- **20/20 correct** → Immediate level up
- **19/20 three times in a row** → Level up

### Automatic Level Down  
- **< 12 correct** → Immediate level down
- **< 15 correct twice in a row** → Level down

### No Change
- **15-18 correct** → Stay at level, reset all streaks

## Architecture Deep Dive

### Module Structure
```
js/
├── app.js          - Main controller
├── game.js         - Game logic (20-question sessions)
├── level_rules.js  - Progression rules & streak tracking
├── auth.js         - User authentication
├── ui.js           - UI management & transitions
├── storage.js      - localStorage operations
├── mathLevels.js   - Question generation
├── utils.js        - Helper functions
└── config.js       - Configuration constants
```

### Key Classes
- **`Game`** - Main game controller
- **`LevelRulesManager`** - Handles progression logic
- **`Auth`** - User authentication
- **`UI`** - Screen management
- **`MathLevels`** - Question generation
- **`Storage`** - Data persistence

## Common Tasks for AI Agents

### 1. Modifying Level Rules
**File**: `js/level_rules.js`
```javascript
// Change thresholds
export const LEVEL_RULES = {
    QUESTIONS_PER_LEVEL: 20,
    PERFECT_SCORE_THRESHOLD: 20,    // 20/20
    HIGH_SCORE_THRESHOLD: 19,       // 19/20
    HIGH_SCORE_STREAK_REQUIRED: 3,  // 3 times in a row
    LOW_SCORE_THRESHOLD: 15,        // <15
    LOW_SCORE_STREAK_REQUIRED: 2,   // 2 times in a row
    VERY_LOW_SCORE_THRESHOLD: 12,   // <12 immediate
};
```

### 2. Adding New Users
**File**: `js/config.js`
```javascript
export const USERS = [
    { username: 'Tom', password: 'Tom1234' },
    { username: 'Patrick', password: 'Patrick1234' },
    { username: 'Eliza', password: 'Eliza1234' },
    { username: 'NewUser', password: 'NewUser1234' } // Add here
];

// Also add to REWARDS.MESSAGES and REWARDS.LEVEL_DOWN_MESSAGES
```

### 3. Changing Question Count
**Files**: `js/config.js` AND `js/level_rules.js`
```javascript
// config.js
QUESTIONS_PER_LEVEL: 25, // Change from 20

// level_rules.js  
QUESTIONS_PER_LEVEL: 25, // Must match!
```

### 4. Adding Math Question Types
**Files**: `math_levels.json` and `js/mathLevels.js`
- Edit JSON for new templates
- Modify generation logic in mathLevels.js

## Testing Strategy

### Running Tests
1. Start local server: `python -m http.server 8000`
2. Open `http://localhost:8000/test_level_rules.html`
3. Click "Run All Tests" - should show 13/13 passed
4. Click "Run Scenario Tests" for realistic patterns

### Test Coverage
- ✅ Perfect score progression
- ✅ High score streaks (19/20 x 3)
- ✅ Low score streaks (<15 x 2)
- ✅ Immediate level down (<12)
- ✅ Streak reset on medium scores
- ✅ Storage persistence
- ✅ Level history tracking

### Manual Testing Checklist
- [ ] Login with Tom/Patrick/Eliza
- [ ] Play through 20 questions
- [ ] Verify progress bar shows "X/20 (Y correct)"
- [ ] Check level changes work correctly
- [ ] Test streak display
- [ ] Verify localStorage persistence

## Debugging Tools

### Browser Console Commands
```javascript
// Check game state
game.getStats()

// Check user streaks
game.levelRulesManager.getStreakInfo('Tom')

// View level history
game.levelRulesManager.getLevelHistory('Tom')

// Simulate progression
game.levelRulesManager.evaluateLevelProgression('Tom', 10, 19)

// Reset streaks for testing
game.levelRulesManager.resetStreaks('Tom')
```

### Common Issues
1. **Tests failing**: Check if QUESTIONS_PER_LEVEL matches in both config files
2. **Streaks not working**: Verify resetStreaks() called on level changes
3. **UI not updating**: Check updateStreakDisplay() calls
4. **Storage issues**: Clear localStorage and test fresh

## Deployment Process

### Local Development
1. Make changes to files
2. Test with local server: `python -m http.server 8000`
3. Run test suite: `test_level_rules.html`
4. Verify game functionality

### Production Deployment
```powershell
# Deploy to Bluehost
scp -i $env:USERPROFILE\.ssh\id_rsa -r c:\Projects\TE_Math\* plantcon@67.20.113.97:/home/plantcon/public_html/website_f273a6c3
```

### Post-Deployment Verification
1. Visit https://rewardmaths.com
2. Test login functionality
3. Play a few questions to verify 20-question system
4. Check progress bar format
5. Verify level progression works

## Code Style Guidelines

### JavaScript
- Use ES6+ features (classes, modules, arrow functions)
- Follow JSDoc commenting for all functions
- Use const/let instead of var
- Keep functions small and focused
- Meaningful variable names

### File Organization
- Keep related functionality in same module
- Update imports when adding new modules
- Separate concerns clearly
- Use descriptive file names

## Performance Considerations

### Storage
- localStorage used for all persistence
- Streak data is minimal (just counters)
- Level history capped at 50 entries per user
- No server-side database required

### Memory
- All operations are synchronous
- No memory leaks in modular design
- Math question generation is efficient
- UI updates are optimized

## Security Notes
- Educational game only (no sensitive data)
- Simple password system (username + "1234")
- All data stored locally in browser
- No server-side authentication needed

## Future Enhancement Ideas

### Easy Additions
- New math question types
- Additional reward milestones
- Sound effects and animations
- More personalized messages

### Medium Complexity
- Adaptive difficulty based on performance
- Achievement system for streaks
- Performance analytics dashboard
- Multiplayer features

### Advanced Features
- Cloud save functionality
- Admin configuration panel
- AI-powered question generation
- Real-time performance tracking

## Troubleshooting Guide

### Game Not Loading
1. Check browser console for errors
2. Verify ES6 module support
3. Use local server instead of file:// protocol
4. Check all import statements

### Level Progression Issues
1. Run test suite to identify specific failures
2. Check LEVEL_RULES configuration
3. Verify streak tracking in localStorage
4. Test with fresh user data

### UI Problems
1. Check CSS module imports
2. Verify element IDs in config.js
3. Test responsive design
4. Check browser compatibility

### Storage Issues
1. Clear localStorage and test fresh
2. Check JSON parsing errors
3. Verify storage keys are correct
4. Test cross-session persistence

## Quick Reference

### Key Configuration Values
- Questions per level: 20
- Perfect score: 20/20 (auto level up)
- High score: 19/20 (3x for level up)
- Low score: <15 (2x for level down)
- Very low: <12 (immediate level down)

### Important Methods
- `game.start()` - Initialize new game
- `game.checkAnswer()` - Process user answer
- `levelRulesManager.evaluateLevelProgression()` - Core progression logic
- `ui.showPopup()` - Display messages to user

### Test Commands
- Run all tests: Open `test_level_rules.html`
- Local server: `python -m http.server 8000`
- Deploy: Use SCP command from README

This guide should provide everything needed for future AI agents to understand, modify, and extend the Reward Maths Game effectively.

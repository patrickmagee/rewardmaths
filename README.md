# Reward Maths Game

A modern, maintainable math game for kids with login, progressive difficulty, and per-user level tracking. The codebase has been refactored for improved maintainability and organization.

## Features
- **Predefined Users**: Tom, Patrick, Eliza (password: username + 1234)
- **Progressive Login Timeout**: Progressive lockout for failed logins
- **Blank Login**: Allows play without a username
- **Math Game**: Answer 20 questions per level with advanced progression rules
- **Levels**: 1-100, per-user, saved in browser localStorage
- **Level Progression Rules**:
  - 20/20 correct = auto level up
  - 19/20 three times in a row = level up
  - Less than 15 correct twice in a row = level down
  - Less than 12 correct = immediate level down
- **Progress Bars**:
  - Horizontal bar for 20-question progress
  - Vertical bar for level (1-100)
- **Responsive UI**: Clean, modern, mobile-friendly
- **Animated Feedback**: Green animation for correct answers
- **Logout**: Small, grey button
- **User Info**: Username and smiley at top

## Refactored File Structure

### Core Files
- `index.html` — Main HTML structure
- `favicon.svg` — Site icon
- `README.md` — This file

### JavaScript Modules (js/)
- `js/app.js` — Main application controller and initialization
- `js/config.js` — Configuration constants and settings
- `js/auth.js` — Authentication and login management
- `js/game.js` — Game logic and math question handling
- `js/storage.js` — localStorage operations for user data
- `js/ui.js` — UI management and screen transitions
- `js/utils.js` — Utility functions and helpers

### CSS Modules (css/)
- `css/main.css` — Main CSS file that imports all modules
- `css/base.css` — Base styles, reset, typography, and fundamentals
- `css/components.css` — Component-specific styles
- `css/responsive.css` — Media queries and responsive design

### Legacy Files (Backup)
- `script.js.backup` — Original monolithic JavaScript file
- `styles.css.backup` — Original monolithic CSS file

## Architecture Improvements

### JavaScript Refactoring
- **Modular Design**: Split monolithic code into focused modules
- **Class-Based Architecture**: Used ES6 classes for better organization
- **Separation of Concerns**: Each module has a single responsibility
- **Error Handling**: Improved error handling throughout
- **Documentation**: Comprehensive JSDoc comments
- **ES6 Modules**: Modern import/export syntax

### CSS Refactoring
- **Modular CSS**: Split styles into logical modules
- **Eliminated Duplicates**: Removed redundant CSS rules
- **Better Organization**: Grouped related styles together
- **Improved Maintainability**: Easier to find and modify specific styles
- **Responsive Design**: Dedicated responsive styles module

### Benefits of Refactoring
1. **Maintainability**: Easier to update and modify code
2. **Readability**: Clear separation of concerns and documentation
3. **Scalability**: Easy to add new features without affecting existing code
4. **Debugging**: Easier to locate and fix issues
5. **Testing**: Modular structure enables better testing
6. **Collaboration**: Multiple developers can work on different modules

## How to Run Locally
1. Open `index.html` in your browser.
2. Log in as Tom, Patrick, or Eliza (password: e.g. Tom1234), or leave blank to play as guest.
3. Play the game! Progress and level are saved per user in your browser.

**Note**: The refactored version uses ES6 modules, so you may need to serve the files through a local server (like Live Server in VS Code) rather than opening the HTML file directly, depending on your browser's security settings.

## How to Deploy to Website
1. Ensure you have SCP and SSH access to your web host.
2. Upload all files to your web root (e.g. `/home/plantcon/public_html/website_f273a6c3`):
   ```powershell
   scp -i $env:USERPROFILE\.ssh\id_rsa -r c:\Projects\TE_Math\* plantcon@67.20.113.97:/home/plantcon/public_html/website_f273a6c3
   ```
3. Visit your site (e.g. https://rewardmaths.com) and verify the game works.

## How to Push to GitHub
1. Make sure your repo is set up:
   ```powershell
   git remote add origin https://github.com/patrickmagee/rewardmaths.git
   ```
2. Commit and push:
   ```powershell
   git add .
   git commit -m "Refactor: Modular architecture for improved maintainability"
   git push -u origin master
   ```

## Development Guidelines

### Adding New Features
1. **JavaScript**: Create new modules in the `js/` directory or extend existing classes
2. **CSS**: Add styles to the appropriate CSS module or create new ones
3. **Configuration**: Update `js/config.js` for new constants or settings

### Code Style
- Use ES6+ features (classes, modules, arrow functions, etc.)
- Follow JSDoc commenting standards
- Use meaningful variable and function names
- Keep functions small and focused
- Separate concerns between modules

### File Organization
- Keep related functionality together in modules
- Use clear, descriptive file names
- Maintain the separation between JS and CSS modules
- Update imports when adding new modules

## For AI Code Assistants

### Architecture Overview
- **Type**: Modular ES6 class-based structure with no external dependencies
- **Entry Point**: `js/app.js` initializes the application
- **State Management**: Handled through class instances and localStorage
- **UI Updates**: Managed through the UI class with clear separation
- **Configuration**: Centralized in `js/config.js`

### Key Files and Their Purposes
1. **`js/app.js`** - Main application controller, initializes all modules
2. **`js/game.js`** - Core game logic, handles 20-question sessions and level progression
3. **`js/level_rules.js`** - Level progression rules and streak tracking (NEW in 2025)
4. **`js/auth.js`** - User authentication and login management
5. **`js/ui.js`** - UI management, screen transitions, and user feedback
6. **`js/storage.js`** - localStorage operations for user data persistence
7. **`js/mathLevels.js`** - Math question generation based on difficulty levels
8. **`js/utils.js`** - Utility functions and helpers
9. **`js/config.js`** - All configuration constants and settings

### Level System (Updated 2025)
The game now uses a sophisticated 20-question level progression system:

#### Current Rules:
- **20/20 correct** → Automatic level up
- **19/20 three times in a row** → Level up
- **Less than 15 correct twice in a row** → Level down  
- **Less than 12 correct** → Immediate level down
- **15-18 correct** → Stay at current level, reset streaks

#### Implementation:
- Level rules are in `js/level_rules.js` (LevelRulesManager class)
- Game logic handles 20-question sessions in `js/game.js`
- Streak tracking and level history are automatically maintained
- Progress bar shows "X/20 (Y correct)" format

### Testing
- **Test Suite**: `test_level_rules.html` - Comprehensive testing for level progression
- **Unit Tests**: 13 tests covering all progression rules
- **Scenario Tests**: Realistic usage patterns with different performance types
- **Local Testing**: Use `python -m http.server 8000` to run locally

### Common Modifications

#### Adding New Level Rules:
1. Modify `LEVEL_RULES` constants in `js/level_rules.js`
2. Update `evaluateLevelProgression()` method if needed
3. Run test suite to verify changes

#### Changing Question Count:
1. Update `QUESTIONS_PER_LEVEL` in `js/config.js`
2. Update `LEVEL_RULES.QUESTIONS_PER_LEVEL` in `js/level_rules.js`
3. Test thoroughly with `test_level_rules.html`

#### Adding New Users:
1. Add to `USERS` array in `js/config.js`
2. Add personalized messages to `REWARDS.MESSAGES` and `REWARDS.LEVEL_DOWN_MESSAGES`

#### Modifying Math Questions:
1. Edit `math_levels.json` for question templates
2. Modify `js/mathLevels.js` for generation logic
3. Test across different levels

### Deployment Process
1. **Local Testing**: Use local server to test changes
2. **Test Suite**: Run `test_level_rules.html` to verify functionality
3. **Deploy**: Use SCP command from README to upload to Bluehost
4. **Verify**: Test live site functionality

### Code Style Guidelines
- Use ES6+ features (classes, modules, arrow functions, const/let)
- Follow JSDoc commenting standards for all functions
- Keep functions small and focused (single responsibility)
- Use meaningful variable and function names
- Separate concerns between modules
- Update imports when adding new modules

### Debugging Tips
- Check browser console for errors
- Use `game.getStats()` to inspect current game state
- Use `levelRulesManager.getStreakInfo(username)` to check streaks
- Use `levelRulesManager.getLevelHistory(username)` to see level changes
- Test individual components with the test suite

### Performance Considerations
- localStorage is used for persistence (no server database)
- Streak tracking is optimized for minimal storage
- Level history is limited to last 50 entries per user
- Math question generation is cached per level

### Security Notes
- No sensitive data stored (educational game only)
- User passwords are simple (username + "1234")
- No server-side authentication required
- All data stored in browser localStorage

### Future Enhancement Areas
- Add more sophisticated math question types
- Implement additional reward milestones
- Add sound effects and animations
- Create admin panel for configuration
- Add multiplayer features
- Implement cloud save functionality

## Contact
For support, contact admin@rewardmaths.com

# Reward Maths Game

A modern, maintainable math game for kids with login, progressive difficulty, and per-user level tracking. The codebase has been refactored for improved maintainability and organization.

## Features
- **Predefined Users**: Tom, Patrick, Eliza (password: username + 1234)
- **Progressive Login Timeout**: Progressive lockout for failed logins
- **Blank Login**: Allows play without a username
- **Math Game**: Answer 10 questions in a row to level up
- **Levels**: 1-100, per-user, saved in browser localStorage
- **Level Up/Down**: 10 correct = level up, 1 wrong = level down
- **Progress Bars**:
  - Horizontal bar for 10-question streak
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
- **Architecture**: Modular ES6 class-based structure
- **Entry Point**: `js/app.js` initializes the application
- **State Management**: Handled through class instances and localStorage
- **UI Updates**: Managed through the UI class with clear separation
- **No Frameworks**: Pure JavaScript and CSS, no external dependencies
- **Easy Extension**: Add new modules or extend existing classes
- **Configuration**: Centralized in `js/config.js`

## Contact
For support, contact admin@rewardmaths.com

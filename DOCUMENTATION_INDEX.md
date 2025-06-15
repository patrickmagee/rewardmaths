# Documentation Index - Reward Maths Game

## Overview
This document provides an index of all documentation available for future AI agents working on the Reward Maths Game project.

## Documentation Files

### 1. **README.md** - Main Project Documentation
- **Purpose**: Primary project documentation and setup guide
- **Audience**: Developers, AI agents, project maintainers
- **Key Sections**:
  - Project features and architecture overview
  - File structure and module organization
  - Development guidelines and code style
  - Deployment instructions
  - Comprehensive AI agent guidance section

### 2. **AI_AGENT_GUIDE.md** - Quick Reference for AI Agents
- **Purpose**: Focused guide specifically for AI agents
- **Audience**: AI assistants working on the codebase
- **Key Sections**:
  - Quick start information
  - Common modification tasks
  - Testing strategy and debugging tools
  - Deployment process
  - Troubleshooting guide
  - Code examples and patterns

### 3. **LEVEL_SYSTEM_UPGRADE.md** - 2025 System Update Details
- **Purpose**: Detailed documentation of the 20-question level system implementation
- **Audience**: AI agents, developers working on level progression
- **Key Sections**:
  - Complete change log from 10 to 20 question system
  - Technical implementation details
  - Test results and verification
  - Code architecture explanations
  - Future modification guidance

### 4. **REFACTORING_SUMMARY.md** - Historical Refactoring Information
- **Purpose**: Documents the original modular refactoring of the codebase
- **Audience**: Developers understanding the evolution of the codebase
- **Key Sections**:
  - Original monolithic to modular transformation
  - Benefits of the refactored architecture
  - File organization improvements

## Quick Navigation Guide

### For New AI Agents
**Start Here**: `AI_AGENT_GUIDE.md`
- Provides immediate context and common tasks
- Includes debugging tools and testing procedures
- Contains quick reference information

### For Understanding Current System
**Read**: `LEVEL_SYSTEM_UPGRADE.md`
- Explains the sophisticated 20-question progression system
- Details all current rules and thresholds
- Provides modification patterns and examples

### For Complete Project Understanding
**Read**: `README.md`
- Comprehensive project overview
- Complete architecture documentation
- Development and deployment procedures

### For Historical Context
**Reference**: `REFACTORING_SUMMARY.md`
- Understanding of how the codebase evolved
- Rationale behind current architecture decisions

## Key Information Summary

### Current System (2025)
- **Questions per level**: 20 (changed from 10)
- **Level progression**: Sophisticated rules with streak tracking
- **Architecture**: Modular ES6 classes with no external dependencies
- **Testing**: Comprehensive test suite with 13 unit tests + scenarios
- **Deployment**: Live on Bluehost via SCP

### Level Progression Rules
- **20/20 correct** → Automatic level up
- **19/20 three times in a row** → Level up
- **< 12 correct** → Immediate level down
- **< 15 correct twice in a row** → Level down
- **15-18 correct** → Stay at level, reset streaks

### Essential Files for AI Agents
1. `js/app.js` - Entry point
2. `js/game.js` - Core game logic
3. `js/level_rules.js` - Progression rules (NEW 2025)
4. `js/config.js` - Configuration
5. `test_level_rules.html` - Test suite

### Testing and Verification
- **Test Suite**: `test_level_rules.html`
- **Local Server**: `python -m http.server 8000`
- **All Tests**: Should show 13/13 passed
- **Live Site**: https://rewardmaths.com

### Deployment Commands
```powershell
# Full deployment
scp -i $env:USERPROFILE\.ssh\id_rsa -r c:\Projects\TE_Math\* plantcon@67.20.113.97:/home/plantcon/public_html/website_f273a6c3

# Documentation only
scp -i $env:USERPROFILE\.ssh\id_rsa README.md LEVEL_SYSTEM_UPGRADE.md AI_AGENT_GUIDE.md plantcon@67.20.113.97:/home/plantcon/public_html/website_f273a6c3
```

## Documentation Maintenance

### When to Update Documentation
- **Code changes**: Update relevant guides when modifying functionality
- **New features**: Add to AI_AGENT_GUIDE.md and README.md
- **Bug fixes**: Update troubleshooting sections
- **Architecture changes**: Update all relevant documentation

### Documentation Standards
- **Clear headings**: Use descriptive section titles
- **Code examples**: Include practical examples for modifications
- **Step-by-step**: Provide clear procedures for common tasks
- **Cross-references**: Link between related documentation sections

## Future AI Agent Workflow

### Recommended Approach
1. **Start with**: `AI_AGENT_GUIDE.md` for quick orientation
2. **Understand system**: Read level progression rules
3. **Test first**: Run test suite to verify current state
4. **Make changes**: Follow patterns in documentation
5. **Test again**: Verify changes with test suite
6. **Deploy**: Use documented deployment process
7. **Update docs**: Modify documentation if needed

### Best Practices
- Always run tests before and after changes
- Use local server for development and testing
- Follow established code style guidelines
- Update documentation when making significant changes
- Verify deployment on live site

This documentation index ensures future AI agents have clear guidance on where to find information and how to effectively work with the Reward Maths Game codebase.

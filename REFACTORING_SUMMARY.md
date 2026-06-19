# Refactoring Summary

This historical document has been retired. It described an old monolithic-to-modular
refactor and referenced files and behavior that no longer exist (a `script.js` /
`styles.css` origin, `.backup` files, a 10/20-question level system, and localStorage
persistence).

The shipped app is a zero-dependency ES6 browser game with a clean modular layout under
`js/` (`app`, `auth`, `game`, `ui`, `mathLevels`, `storage`, `localdb`, `config`,
`utils`) and `css/`. It is a category-based practice game (Addition, Subtraction, times
tables), 10 questions per game, with per-category top-10 leaderboards stored in
IndexedDB (`js/localdb.js`).

For current, accurate documentation see **README.md** and **CLAUDE.md**.

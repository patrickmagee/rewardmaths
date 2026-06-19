// Vitest setup: provide a fresh fake IndexedDB for the jsdom environment.
// `fake-indexeddb/auto` installs indexedDB + IDBKeyRange onto globalThis,
// which is what js/localdb.js expects in a browser.
import 'fake-indexeddb/auto';

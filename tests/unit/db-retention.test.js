// Regression test for the CRITICAL score-wipe bug:
// bumping DB_VERSION must NOT destroy saved scores.
// Tests the real exported upgradeDatabase() across simulated version bumps.
import { describe, it, expect, beforeEach } from 'vitest';
import { upgradeDatabase } from '../../js/localdb.js';

const DB = 'RetentionTestDB';

function openAt(version) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, version);
    req.onupgradeneeded = (e) => upgradeDatabase(e.target.result);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function addScore(db, score) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('scores', 'readwrite');
    tx.objectStore('scores').add(score);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function getAllScores(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('scores', 'readonly');
    const req = tx.objectStore('scores').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function deleteDb() {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(DB);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}

describe('IndexedDB upgrade / score retention', () => {
  beforeEach(deleteDb);

  it('creates the expected object stores on first open', async () => {
    const db = await openAt(4);
    const stores = Array.from(db.objectStoreNames);
    expect(stores).toContain('profiles');
    expect(stores).toContain('scores');
    expect(stores).toContain('auth_sessions');
    db.close();
  });

  it('does NOT recreate/delete the dead legacy stores', async () => {
    const db = await openAt(4);
    const stores = Array.from(db.objectStoreNames);
    expect(stores).not.toContain('game_sessions');
    expect(stores).not.toContain('question_attempts');
    expect(stores).not.toContain('level_configs');
    expect(stores).not.toContain('level_history');
    db.close();
  });

  it('RETAINS scores across a DB version bump (the critical regression)', async () => {
    let db = await openAt(4);
    await addScore(db, { user_id: 'u1', category: 'add_easy', score: 9, time_ms: 12000, played_at: '2026-01-01T00:00:00.000Z' });
    await addScore(db, { user_id: 'u1', category: 'add_easy', score: 7, time_ms: 15000, played_at: '2026-01-02T00:00:00.000Z' });
    db.close();

    // Simulate a future schema change that bumps the version.
    db = await openAt(5);
    const scores = await getAllScores(db);
    expect(scores).toHaveLength(2);
    expect(scores.map((s) => s.score).sort()).toEqual([7, 9]);
    db.close();
  });
});

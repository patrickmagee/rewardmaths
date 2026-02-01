/**
 * LocalDB - IndexedDB-based local database
 * Provides a Supabase-like API for offline-first operation
 */

const DB_NAME = 'RewardMathsDB';
const DB_VERSION = 3; // Bumped to reset scores

class LocalDatabase {
    constructor() {
        this.db = null;
        this.isReady = false;
        this.readyPromise = this.init();
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);

            request.onsuccess = () => {
                this.db = request.result;
                this.isReady = true;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Delete old stores if they exist
                const oldStores = ['game_sessions', 'question_attempts', 'level_configs', 'level_history', 'scores'];
                oldStores.forEach(store => {
                    if (db.objectStoreNames.contains(store)) {
                        db.deleteObjectStore(store);
                    }
                });

                // Profiles table
                if (!db.objectStoreNames.contains('profiles')) {
                    const profiles = db.createObjectStore('profiles', { keyPath: 'id' });
                    profiles.createIndex('username', 'username', { unique: true });
                    profiles.createIndex('email', 'email', { unique: true });
                }

                // Scores table - stores every game result
                if (!db.objectStoreNames.contains('scores')) {
                    const scores = db.createObjectStore('scores', { keyPath: 'id', autoIncrement: true });
                    scores.createIndex('user_id', 'user_id');
                    scores.createIndex('category', 'category');
                    scores.createIndex('user_category', ['user_id', 'category']);
                }

                // Auth sessions (for local auth)
                if (!db.objectStoreNames.contains('auth_sessions')) {
                    db.createObjectStore('auth_sessions', { keyPath: 'id' });
                }
            };
        });
    }

    async ensureReady() {
        if (!this.isReady) {
            await this.readyPromise;
        }
    }

    // Generic CRUD operations
    async getAll(storeName) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async get(storeName, key) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getByIndex(storeName, indexName, value) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(value);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async put(storeName, data) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.put(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async add(storeName, data) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.add(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async delete(storeName, key) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async clear(storeName) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

// Singleton instance
const localDB = new LocalDatabase();

/**
 * Local Auth - Simple username-based authentication
 */
class LocalAuth {
    constructor(db) {
        this.db = db;
        this.currentSession = null;
        this.listeners = [];
    }

    async getSession() {
        const sessions = await this.db.getAll('auth_sessions');
        if (sessions.length > 0) {
            this.currentSession = sessions[0];
            return { data: { session: this.currentSession }, error: null };
        }
        return { data: { session: null }, error: null };
    }

    async getUser() {
        const { data } = await this.getSession();
        if (data.session) {
            return { data: { user: data.session.user }, error: null };
        }
        return { data: { user: null }, error: null };
    }

    async signInByName(username) {
        try {
            // Find user by username (case-insensitive)
            const profiles = await this.db.getByIndex('profiles', 'username', username.toLowerCase());

            if (profiles.length === 0) {
                return { data: { user: null }, error: { message: 'User not found' } };
            }

            const profile = profiles[0];

            // Create session
            const user = {
                id: profile.id,
                email: profile.email,
                user_metadata: {
                    username: profile.username,
                    display_name: profile.display_name
                }
            };

            this.currentSession = {
                id: 'local-session',
                user,
                access_token: 'local-token-' + Date.now()
            };

            await this.db.put('auth_sessions', this.currentSession);
            this.notifyListeners('SIGNED_IN', this.currentSession);

            return { data: { user, session: this.currentSession }, error: null };
        } catch (error) {
            return { data: { user: null }, error: { message: error.message } };
        }
    }

    async signOut() {
        try {
            await this.db.clear('auth_sessions');
            this.currentSession = null;
            this.notifyListeners('SIGNED_OUT', null);
            return { error: null };
        } catch (error) {
            return { error: { message: error.message } };
        }
    }

    onAuthStateChange(callback) {
        this.listeners.push(callback);
        return {
            data: {
                subscription: {
                    unsubscribe: () => {
                        this.listeners = this.listeners.filter(l => l !== callback);
                    }
                }
            }
        };
    }

    notifyListeners(event, session) {
        this.listeners.forEach(callback => callback(event, session));
    }

    hashPassword(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return 'local-hash-' + Math.abs(hash).toString(36);
    }
}

/**
 * Query Builder - Mimics Supabase query syntax
 */
class QueryBuilder {
    constructor(db, tableName) {
        this.db = db;
        this.tableName = tableName;
        this.filters = [];
        this.orderByField = null;
        this.orderAsc = true;
        this.limitCount = null;
        this.selectFields = '*';
    }

    select(fields = '*') {
        this.selectFields = fields;
        return this;
    }

    eq(field, value) {
        this.filters.push({ type: 'eq', field, value });
        return this;
    }

    gte(field, value) {
        this.filters.push({ type: 'gte', field, value });
        return this;
    }

    lte(field, value) {
        this.filters.push({ type: 'lte', field, value });
        return this;
    }

    order(field, { ascending = true } = {}) {
        this.orderByField = field;
        this.orderAsc = ascending;
        return this;
    }

    limit(count) {
        this.limitCount = count;
        return this;
    }

    single() {
        this._single = true;
        return this;
    }

    async execute() {
        try {
            let data = await this.db.getAll(this.tableName);

            // Apply filters
            for (const filter of this.filters) {
                data = data.filter(item => {
                    switch (filter.type) {
                        case 'eq': return item[filter.field] === filter.value;
                        case 'gte': return item[filter.field] >= filter.value;
                        case 'lte': return item[filter.field] <= filter.value;
                        default: return true;
                    }
                });
            }

            // Apply ordering
            if (this.orderByField) {
                data.sort((a, b) => {
                    const aVal = a[this.orderByField];
                    const bVal = b[this.orderByField];
                    if (aVal < bVal) return this.orderAsc ? -1 : 1;
                    if (aVal > bVal) return this.orderAsc ? 1 : -1;
                    return 0;
                });
            }

            // Apply limit
            if (this.limitCount) {
                data = data.slice(0, this.limitCount);
            }

            // Single result
            if (this._single) {
                data = data[0] || null;
            }

            return { data, error: null };
        } catch (error) {
            return { data: null, error: { message: error.message } };
        }
    }

    then(resolve, reject) {
        return this.execute().then(resolve, reject);
    }
}

/**
 * Table interface - Mimics Supabase table operations
 */
class TableInterface {
    constructor(db, tableName) {
        this.db = db;
        this.tableName = tableName;
    }

    select(fields = '*') {
        return new QueryBuilder(this.db, this.tableName).select(fields);
    }

    async insert(data) {
        try {
            const items = Array.isArray(data) ? data : [data];
            for (const item of items) {
                await this.db.put(this.tableName, item);
            }
            return { data: items, error: null };
        } catch (error) {
            return { data: null, error: { message: error.message } };
        }
    }

    update(data) {
        return new UpdateBuilder(this.db, this.tableName, data);
    }

    async delete() {
        return new DeleteBuilder(this.db, this.tableName);
    }
}

class UpdateBuilder {
    constructor(db, tableName, data) {
        this.db = db;
        this.tableName = tableName;
        this.data = data;
        this.filters = [];
    }

    eq(field, value) {
        this.filters.push({ field, value });
        return this;
    }

    async execute() {
        try {
            let items = await this.db.getAll(this.tableName);

            for (const filter of this.filters) {
                items = items.filter(item => item[filter.field] === filter.value);
            }

            for (const item of items) {
                const updated = { ...item, ...this.data, updated_at: new Date().toISOString() };
                await this.db.put(this.tableName, updated);
            }

            return { data: items, error: null };
        } catch (error) {
            return { data: null, error: { message: error.message } };
        }
    }

    then(resolve, reject) {
        return this.execute().then(resolve, reject);
    }
}

class DeleteBuilder {
    constructor(db, tableName) {
        this.db = db;
        this.tableName = tableName;
        this.filters = [];
    }

    eq(field, value) {
        this.filters.push({ field, value });
        return this;
    }

    async execute() {
        try {
            let items = await this.db.getAll(this.tableName);

            for (const filter of this.filters) {
                items = items.filter(item => item[filter.field] === filter.value);
            }

            for (const item of items) {
                await this.db.delete(this.tableName, item.id);
            }

            return { error: null };
        } catch (error) {
            return { error: { message: error.message } };
        }
    }

    then(resolve, reject) {
        return this.execute().then(resolve, reject);
    }
}

/**
 * Main Supabase-compatible client
 */
const localAuth = new LocalAuth(localDB);

export const supabase = {
    auth: localAuth,

    from(tableName) {
        return new TableInterface(localDB, tableName);
    }
};

/**
 * Helper functions
 */
export function isSupabaseConfigured() {
    return true;
}

export async function getCurrentUser() {
    const { data } = await supabase.auth.getUser();
    return data?.user || null;
}

export async function getCurrentProfile() {
    const user = await getCurrentUser();
    if (!user) return null;

    const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    return data;
}

export function onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
}

export async function signOut() {
    return supabase.auth.signOut();
}

/**
 * Initialize default data
 */
export async function initializeDefaultData() {
    await localDB.ensureReady();

    // Check if users exist
    const profiles = await localDB.getAll('profiles');
    if (profiles.length === 0) {
        console.log('Creating default users...');
        await createDefaultUsers();
    }

}

async function createDefaultUsers() {
    // Create default users (simple names, no passwords needed)
    const users = [
        { username: 'tom', display_name: 'Tom', emoji: '🦖', is_admin: false },
        { username: 'patrick', display_name: 'Patrick', emoji: '🙂', is_admin: true },
        { username: 'eliza', display_name: 'Eliza', emoji: '🌸', is_admin: false }
    ];

    for (const user of users) {
        const id = `user-${user.username}-${Date.now()}`;
        await localDB.put('profiles', {
            id,
            email: `${user.username}@local`,
            username: user.username,
            display_name: user.display_name,
            is_admin: user.is_admin || false,
            avatar_emoji: user.emoji,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
    }

    console.log('Default users created: Tom, Patrick, Eliza');
}

// Auto-initialize on load
initializeDefaultData().catch(console.error);

export const SUPABASE_CONFIG = {
    url: 'local',
    isConfigured: true,
    isLocal: true
};

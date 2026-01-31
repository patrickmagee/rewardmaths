/**
 * LocalDB - IndexedDB-based local database
 * Provides a Supabase-like API for offline-first operation
 */

const DB_NAME = 'RewardMathsDB';
const DB_VERSION = 1;

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

                // Profiles table
                if (!db.objectStoreNames.contains('profiles')) {
                    const profiles = db.createObjectStore('profiles', { keyPath: 'id' });
                    profiles.createIndex('username', 'username', { unique: true });
                    profiles.createIndex('email', 'email', { unique: true });
                }

                // Game sessions table
                if (!db.objectStoreNames.contains('game_sessions')) {
                    const sessions = db.createObjectStore('game_sessions', { keyPath: 'session_id' });
                    sessions.createIndex('user_id', 'user_id');
                    sessions.createIndex('started_at', 'started_at');
                }

                // Question attempts table
                if (!db.objectStoreNames.contains('question_attempts')) {
                    const attempts = db.createObjectStore('question_attempts', { keyPath: 'id', autoIncrement: true });
                    attempts.createIndex('session_id', 'session_id');
                    attempts.createIndex('user_id', 'user_id');
                }

                // Level configs table
                if (!db.objectStoreNames.contains('level_configs')) {
                    db.createObjectStore('level_configs', { keyPath: 'level' });
                }

                // Level history table
                if (!db.objectStoreNames.contains('level_history')) {
                    const history = db.createObjectStore('level_history', { keyPath: 'id', autoIncrement: true });
                    history.createIndex('user_id', 'user_id');
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
 * Local Auth - Simple email/password authentication
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

    async signInWithPassword({ email, password }) {
        try {
            // Find user by email
            const profiles = await this.db.getByIndex('profiles', 'email', email.toLowerCase());

            if (profiles.length === 0) {
                return { data: { user: null }, error: { message: 'Invalid email or password' } };
            }

            const profile = profiles[0];

            // Check password (simple hash comparison)
            if (profile.password_hash !== this.hashPassword(password)) {
                return { data: { user: null }, error: { message: 'Invalid email or password' } };
            }

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

    async signInByName(username) {
        try {
            // Find user by username (case-insensitive)
            const profiles = await this.db.getByIndex('profiles', 'username', username.toLowerCase());

            if (profiles.length === 0) {
                return { data: { user: null }, error: { message: 'User not found' } };
            }

            const profile = profiles[0];

            // Create session (no password check)
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

    async signUp({ email, password, options }) {
        try {
            const id = 'user-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

            const profile = {
                id,
                email: email.toLowerCase(),
                username: options?.data?.username || email.split('@')[0],
                display_name: options?.data?.display_name || email.split('@')[0],
                password_hash: this.hashPassword(password),
                current_level: 1,
                is_admin: false,
                high_score_streak: 0,
                low_score_streak: 0,
                avatar_emoji: '🙂',
                reward_theme: 'default',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            await this.db.put('profiles', profile);

            const user = {
                id: profile.id,
                email: profile.email,
                user_metadata: {
                    username: profile.username,
                    display_name: profile.display_name
                }
            };

            return { data: { user }, error: null };
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
        // Simple hash for local use - NOT secure for production
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

    // Make it thenable
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
                if (!item.id && this.tableName === 'question_attempts') {
                    item.id = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                }
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
                await this.db.delete(this.tableName, item.id || item.level || item.session_id);
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
 * RPC Function handler
 */
async function handleRpc(functionName, params) {
    switch (functionName) {
        case 'update_user_progress':
            const profile = await localDB.get('profiles', params.p_user_id);
            if (profile) {
                profile.current_level = params.p_new_level;
                profile.high_score_streak = params.p_high_streak;
                profile.low_score_streak = params.p_low_streak;
                profile.updated_at = new Date().toISOString();
                await localDB.put('profiles', profile);
            }
            return { data: null, error: null };

        case 'complete_game_session':
            const session = await localDB.get('game_sessions', params.p_session_id);
            if (session) {
                session.completed_at = new Date().toISOString();
                session.correct_answers = params.p_correct_answers;
                session.total_questions = params.p_total_questions;
                session.average_response_time_ms = params.p_avg_response_time;
                session.level_changed = params.p_level_changed;
                session.new_level = params.p_new_level;
                session.change_reason = params.p_change_reason;
                await localDB.put('game_sessions', session);
            }
            return { data: null, error: null };

        default:
            return { data: null, error: { message: `Unknown function: ${functionName}` } };
    }
}

/**
 * Computed Views - Emulate SQL views by joining/aggregating data
 */
class ComputedViews {
    constructor(db) {
        this.db = db;
    }

    /**
     * performance_analysis view - joins sessions with profiles
     */
    async getPerformanceAnalysis(filters = {}) {
        const sessions = await this.db.getAll('game_sessions');
        const profiles = await this.db.getAll('profiles');

        // Create profile lookup map
        const profileMap = {};
        profiles.forEach(p => { profileMap[p.id] = p; });

        // Join sessions with profiles
        let data = sessions
            .filter(s => s.completed_at) // Only completed sessions
            .map(session => {
                const profile = profileMap[session.user_id] || {};
                const totalQuestions = session.total_questions || 0;
                const correctAnswers = session.correct_answers || 0;
                const accuracy = totalQuestions > 0
                    ? Math.round((correctAnswers / totalQuestions) * 100)
                    : 0;

                return {
                    session_id: session.session_id,
                    user_id: session.user_id,
                    username: profile.username || 'Unknown',
                    display_name: profile.display_name || profile.username || 'Unknown',
                    level_number: session.level_number,
                    started_at: session.started_at,
                    completed_at: session.completed_at,
                    total_questions: totalQuestions,
                    correct_answers: correctAnswers,
                    accuracy_percentage: accuracy,
                    average_response_time_ms: session.average_response_time_ms,
                    level_changed: session.level_changed || false,
                    new_level: session.new_level,
                    change_reason: session.change_reason
                };
            });

        // Apply filters
        if (filters.user_id) {
            data = data.filter(d => d.user_id === filters.user_id);
        }
        if (filters.startDate) {
            data = data.filter(d => d.started_at >= filters.startDate);
        }
        if (filters.endDate) {
            data = data.filter(d => d.started_at <= filters.endDate);
        }

        // Sort by started_at descending
        data.sort((a, b) => new Date(b.started_at) - new Date(a.started_at));

        return data;
    }

    /**
     * user_stats view - aggregates user performance data
     */
    async getUserStats() {
        const profiles = await this.db.getAll('profiles');
        const sessions = await this.db.getAll('game_sessions');
        const attempts = await this.db.getAll('question_attempts');

        // Aggregate per user
        return profiles.map(profile => {
            const userSessions = sessions.filter(s => s.user_id === profile.id && s.completed_at);
            const userAttempts = attempts.filter(a => a.user_id === profile.id);

            const totalQuestions = userAttempts.length;
            const correctAnswers = userAttempts.filter(a => a.is_correct).length;
            const accuracy = totalQuestions > 0
                ? Math.round((correctAnswers / totalQuestions) * 100)
                : 0;

            return {
                id: profile.id,
                username: profile.username,
                display_name: profile.display_name,
                current_level: profile.current_level,
                total_sessions: userSessions.length,
                total_questions_answered: totalQuestions,
                total_correct: correctAnswers,
                overall_accuracy: accuracy,
                is_admin: profile.is_admin,
                avatar_emoji: profile.avatar_emoji
            };
        })
        .filter(u => !u.is_admin) // Exclude admin from stats
        .sort((a, b) => (a.username || '').localeCompare(b.username || '')); // Sort by username
    }

    /**
     * daily_performance view - daily summaries per user
     */
    async getDailyPerformance(userId = null) {
        const sessions = await this.db.getAll('game_sessions');
        const profiles = await this.db.getAll('profiles');

        // Create profile lookup
        const profileMap = {};
        profiles.forEach(p => { profileMap[p.id] = p; });

        // Group by user and date
        const dailyMap = {};

        sessions
            .filter(s => s.completed_at && (!userId || s.user_id === userId))
            .forEach(session => {
                const date = session.started_at.split('T')[0]; // Get YYYY-MM-DD
                const key = `${session.user_id}_${date}`;

                if (!dailyMap[key]) {
                    const profile = profileMap[session.user_id] || {};
                    dailyMap[key] = {
                        user_id: session.user_id,
                        username: profile.username || 'Unknown',
                        display_name: profile.display_name || profile.username || 'Unknown',
                        play_date: date,
                        sessions_count: 0,
                        total_questions: 0,
                        total_correct: 0,
                        total_response_time: 0,
                        response_count: 0
                    };
                }

                dailyMap[key].sessions_count++;
                dailyMap[key].total_questions += session.total_questions || 0;
                dailyMap[key].total_correct += session.correct_answers || 0;
                if (session.average_response_time_ms) {
                    dailyMap[key].total_response_time += session.average_response_time_ms;
                    dailyMap[key].response_count++;
                }
            });

        // Calculate averages and return
        return Object.values(dailyMap)
            .map(d => ({
                user_id: d.user_id,
                username: d.username,
                display_name: d.display_name,
                play_date: d.play_date,
                sessions_count: d.sessions_count,
                total_questions: d.total_questions,
                total_correct: d.total_correct,
                accuracy_percentage: d.total_questions > 0
                    ? Math.round((d.total_correct / d.total_questions) * 100)
                    : 0,
                average_response_time_ms: d.response_count > 0
                    ? Math.round(d.total_response_time / d.response_count)
                    : null
            }))
            .sort((a, b) => b.play_date.localeCompare(a.play_date));
    }
}

const computedViews = new ComputedViews(localDB);

/**
 * View Query Builder - For computed views
 */
class ViewQueryBuilder {
    constructor(viewName, computedViews) {
        this.viewName = viewName;
        this.computedViews = computedViews;
        this.filters = {};
        this.orderByField = null;
        this.orderAsc = true;
        this.limitCount = null;
    }

    select(fields = '*') {
        return this;
    }

    eq(field, value) {
        this.filters[field] = value;
        return this;
    }

    gte(field, value) {
        this.filters[field + '_gte'] = value;
        return this;
    }

    lte(field, value) {
        this.filters[field + '_lte'] = value;
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

    async execute() {
        try {
            let data;

            switch (this.viewName) {
                case 'performance_analysis':
                    data = await this.computedViews.getPerformanceAnalysis({
                        user_id: this.filters.user_id,
                        startDate: this.filters.started_at_gte,
                        endDate: this.filters.started_at_lte
                    });
                    break;

                case 'user_stats':
                    data = await this.computedViews.getUserStats();
                    break;

                case 'daily_performance':
                    data = await this.computedViews.getDailyPerformance(this.filters.user_id);
                    break;

                default:
                    return { data: [], error: { message: `Unknown view: ${this.viewName}` } };
            }

            // Apply limit
            if (this.limitCount) {
                data = data.slice(0, this.limitCount);
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
 * Main Supabase-compatible client
 */
const localAuth = new LocalAuth(localDB);

export const supabase = {
    auth: localAuth,

    from(tableName) {
        // Check if this is a computed view
        const views = ['performance_analysis', 'user_stats', 'daily_performance'];
        if (views.includes(tableName)) {
            return new ViewQueryBuilder(tableName, computedViews);
        }
        return new TableInterface(localDB, tableName);
    },

    async rpc(functionName, params) {
        return handleRpc(functionName, params);
    }
};

/**
 * Helper functions matching the original supabase.js exports
 */
export function isSupabaseConfigured() {
    return true; // Local DB is always "configured"
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

    // Check if level configs exist
    const configs = await localDB.getAll('level_configs');
    if (configs.length === 0) {
        console.log('Seeding level configurations...');
        await seedLevelConfigs();
    }

    // Check if admin user exists
    const profiles = await localDB.getAll('profiles');
    if (profiles.length === 0) {
        console.log('Creating default admin user...');
        await createDefaultUsers();
    }
}

async function seedLevelConfigs() {
    const levels = [
        // Foundation (1-5)
        { level: 1, operations: ['+'], max_operand: 10, multiplication_tables: [], description: 'Addition with numbers up to 10', is_active: true },
        { level: 2, operations: ['+', '-'], max_operand: 10, multiplication_tables: [], description: 'Addition and subtraction up to 10', is_active: true },
        { level: 3, operations: ['+', '-'], max_operand: 20, multiplication_tables: [], description: 'Addition and subtraction up to 20', is_active: true },
        { level: 4, operations: ['+', '-'], max_operand: 20, multiplication_tables: [2, 5, 10], description: 'Add/subtract to 20, easy times tables', is_active: true },
        { level: 5, operations: ['+', '-', '*'], max_operand: 20, multiplication_tables: [2, 5, 10], description: 'Mixed operations with easy tables', is_active: true },

        // Times Tables (6-13)
        { level: 6, operations: ['*'], max_operand: 12, multiplication_tables: [2, 3], description: 'Times tables: 2 and 3', is_active: true },
        { level: 7, operations: ['*'], max_operand: 12, multiplication_tables: [2, 3, 4], description: 'Times tables: 2, 3, and 4', is_active: true },
        { level: 8, operations: ['*'], max_operand: 12, multiplication_tables: [2, 3, 4, 5], description: 'Times tables: 2-5', is_active: true },
        { level: 9, operations: ['*'], max_operand: 12, multiplication_tables: [2, 3, 4, 5, 6], description: 'Times tables: 2-6', is_active: true },
        { level: 10, operations: ['*'], max_operand: 12, multiplication_tables: [2, 3, 4, 5, 6, 7], description: 'Times tables: 2-7', is_active: true },
        { level: 11, operations: ['*'], max_operand: 12, multiplication_tables: [2, 3, 4, 5, 6, 7, 8], description: 'Times tables: 2-8', is_active: true },
        { level: 12, operations: ['*'], max_operand: 12, multiplication_tables: [2, 3, 4, 5, 6, 7, 8, 9], description: 'Times tables: 2-9', is_active: true },
        { level: 13, operations: ['*'], max_operand: 12, multiplication_tables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], description: 'All times tables', is_active: true },

        // Division (14-15)
        { level: 14, operations: ['/'], max_operand: 12, multiplication_tables: [2, 3, 4, 5], description: 'Division using tables 2-5', is_active: true },
        { level: 15, operations: ['/', '*'], max_operand: 12, multiplication_tables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], description: 'Division and multiplication', is_active: true },

        // Mixed Speed (16-25)
        { level: 16, operations: ['+', '-'], max_operand: 50, multiplication_tables: [], description: 'Add/subtract up to 50', is_active: true },
        { level: 17, operations: ['+', '-'], max_operand: 100, multiplication_tables: [], description: 'Add/subtract up to 100', is_active: true },
        { level: 18, operations: ['+', '-', '*'], max_operand: 50, multiplication_tables: [2, 3, 4, 5, 6], description: 'Mixed operations to 50', is_active: true },
        { level: 19, operations: ['+', '-', '*', '/'], max_operand: 50, multiplication_tables: [2, 3, 4, 5, 6], description: 'All operations to 50', is_active: true },
        { level: 20, operations: ['+', '-', '*', '/'], max_operand: 75, multiplication_tables: [2, 3, 4, 5, 6, 7, 8], description: 'All operations to 75', is_active: true },
        { level: 21, operations: ['+', '-', '*', '/'], max_operand: 100, multiplication_tables: [2, 3, 4, 5, 6, 7, 8, 9], description: 'All operations to 100', is_active: true },
        { level: 22, operations: ['+', '-', '*', '/'], max_operand: 100, multiplication_tables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], description: 'Full range challenge', is_active: true },
        { level: 23, operations: ['+', '-'], max_operand: 100, multiplication_tables: [], description: 'Speed: Add/subtract to 100', is_active: true },
        { level: 24, operations: ['*', '/'], max_operand: 12, multiplication_tables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], description: 'Speed: Multiply and divide', is_active: true },
        { level: 25, operations: ['+', '-', '*', '/'], max_operand: 100, multiplication_tables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], description: 'Advanced mixed', is_active: true },

        // Mastery (26-30)
        { level: 26, operations: ['+', '-'], max_operand: 100, multiplication_tables: [], description: 'Mastery: Mental arithmetic', is_active: true },
        { level: 27, operations: ['*'], max_operand: 12, multiplication_tables: [6, 7, 8, 9, 11, 12], description: 'Mastery: Hard times tables', is_active: true },
        { level: 28, operations: ['/'], max_operand: 12, multiplication_tables: [6, 7, 8, 9, 11, 12], description: 'Mastery: Hard division', is_active: true },
        { level: 29, operations: ['+', '-', '*', '/'], max_operand: 100, multiplication_tables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], description: 'Mastery: Random mix', is_active: true },
        { level: 30, operations: ['+', '-', '*', '/'], max_operand: 100, multiplication_tables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], description: 'CHAMPION LEVEL', is_active: true }
    ];

    for (const level of levels) {
        await localDB.put('level_configs', level);
    }
    console.log('Level configurations seeded successfully');
}

async function createDefaultUsers() {
    // Create admin user
    const adminId = 'admin-' + Date.now();
    await localDB.put('profiles', {
        id: adminId,
        email: 'admin@rewardmaths.local',
        username: 'admin',
        display_name: 'Admin',
        password_hash: localAuth.hashPassword('admin123'),
        current_level: 1,
        is_admin: true,
        high_score_streak: 0,
        low_score_streak: 0,
        avatar_emoji: '👑',
        reward_theme: 'default',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    });

    // Create default child users (simple names, no passwords needed)
    const children = [
        { username: 'tom', display_name: 'Tom', emoji: '🦖' },
        { username: 'patrick', display_name: 'Patrick', emoji: '🙂' },
        { username: 'eliza', display_name: 'Eliza', emoji: '🌸' }
    ];

    for (const child of children) {
        const id = `user-${child.username}-${Date.now()}`;
        await localDB.put('profiles', {
            id,
            email: `${child.username}@local`,
            username: child.username,
            display_name: child.display_name,
            password_hash: null,
            current_level: 1,
            is_admin: false,
            high_score_streak: 0,
            low_score_streak: 0,
            avatar_emoji: child.emoji,
            reward_theme: 'default',
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

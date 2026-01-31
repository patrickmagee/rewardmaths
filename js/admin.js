/**
 * Admin Dashboard Module
 * Handles admin functionality for user management and performance analytics
 */

import { supabase, getCurrentProfile, signOut } from './supabase.js';

/**
 * Admin Dashboard class
 */
export class AdminDashboard {
    constructor() {
        this.currentUser = null;
        this.isAdmin = false;
        this.users = [];
        this.levelConfigs = [];
    }

    /**
     * Initialize the admin dashboard
     */
    async init() {
        // Setup login button
        document.getElementById('patrickLoginBtn')?.addEventListener('click', () => this.login());

        // Show login screen
        this.showLoginScreen();
    }

    /**
     * Handle login
     */
    async login() {
        const loginError = document.getElementById('loginError');
        loginError.textContent = '';

        try {
            // Login as Patrick
            const { data, error } = await supabase.auth.signInByName('patrick');

            if (error) {
                loginError.textContent = error.message;
                return;
            }

            // Get profile and check admin status
            const profile = await getCurrentProfile();

            if (!profile) {
                loginError.textContent = 'Failed to load profile';
                return;
            }

            if (!profile.is_admin) {
                loginError.textContent = 'Access denied - not an admin';
                return;
            }

            this.currentUser = profile;
            this.isAdmin = true;

            // Load initial data
            await this.loadUsers();
            await this.loadLevelConfigs();
            this.setupEventListeners();
            this.showDashboard();
        } catch (err) {
            loginError.textContent = 'Login failed: ' + err.message;
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Logout button
        document.getElementById('logoutBtn')?.addEventListener('click', () => this.logout());

        // Refresh buttons
        document.getElementById('refreshUsers')?.addEventListener('click', () => this.loadUsers());
        document.getElementById('refreshPerformance')?.addEventListener('click', () => this.loadPerformanceData());

        // User filter
        document.getElementById('userFilter')?.addEventListener('change', () => this.loadPerformanceData());

        // Date filters
        document.getElementById('startDate')?.addEventListener('change', () => this.loadPerformanceData());
        document.getElementById('endDate')?.addEventListener('change', () => this.loadPerformanceData());

        // Level config save
        document.getElementById('saveLevelConfigs')?.addEventListener('click', () => this.saveLevelConfigs());

        // CSV export
        document.getElementById('exportCsv')?.addEventListener('click', () => this.exportToCsv());

        // Create user form
        document.getElementById('createUserForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.createUser();
        });
    }

    /**
     * Load all users
     */
    async loadUsers() {
        try {
            const { data, error } = await supabase
                .from('user_stats')
                .select('*')
                .order('username');

            if (error) throw error;

            this.users = data || [];
            this.renderUsersTable();
            this.updateUserFilter();
        } catch (error) {
            console.error('Failed to load users:', error);
            this.showError('Failed to load users: ' + error.message);
        }
    }

    /**
     * Render users table
     */
    renderUsersTable() {
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;

        tbody.innerHTML = this.users.map(user => `
            <tr>
                <td>${this.escapeHtml(user.display_name || user.username)}</td>
                <td>${user.current_level}</td>
                <td>${user.total_sessions || 0}</td>
                <td>${user.total_questions_answered || 0}</td>
                <td>${user.overall_accuracy || 0}%</td>
                <td>
                    <button class="btn btn-small" onclick="admin.editUserLevel('${user.id}', ${user.current_level})">
                        Set Level
                    </button>
                </td>
            </tr>
        `).join('');
    }

    /**
     * Update user filter dropdown
     */
    updateUserFilter() {
        const select = document.getElementById('userFilter');
        if (!select) return;

        const currentValue = select.value;
        select.innerHTML = '<option value="">All Users</option>' +
            this.users.map(user => `
                <option value="${user.id}">${this.escapeHtml(user.display_name || user.username)}</option>
            `).join('');
        select.value = currentValue;
    }

    /**
     * Edit user level
     */
    async editUserLevel(userId, currentLevel) {
        const newLevel = prompt(`Enter new level (1-30):`, currentLevel);

        if (newLevel === null) return;

        const level = parseInt(newLevel);
        if (isNaN(level) || level < 1 || level > 30) {
            alert('Please enter a valid level between 1 and 30');
            return;
        }

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ current_level: level })
                .eq('id', userId);

            if (error) throw error;

            alert('Level updated successfully');
            await this.loadUsers();
        } catch (error) {
            console.error('Failed to update level:', error);
            alert('Failed to update level: ' + error.message);
        }
    }

    /**
     * Load performance data
     */
    async loadPerformanceData() {
        const userId = document.getElementById('userFilter')?.value;
        const startDate = document.getElementById('startDate')?.value;
        const endDate = document.getElementById('endDate')?.value;

        try {
            let query = supabase
                .from('performance_analysis')
                .select('*')
                .order('started_at', { ascending: false })
                .limit(100);

            if (userId) {
                query = query.eq('user_id', userId);
            }
            if (startDate) {
                query = query.gte('started_at', startDate);
            }
            if (endDate) {
                query = query.lte('started_at', endDate + 'T23:59:59');
            }

            const { data, error } = await query;

            if (error) throw error;

            this.renderPerformanceTable(data || []);
            this.updateStats(data || []);
        } catch (error) {
            console.error('Failed to load performance data:', error);
            this.showError('Failed to load performance data: ' + error.message);
        }
    }

    /**
     * Render performance table
     */
    renderPerformanceTable(data) {
        const tbody = document.getElementById('performanceTableBody');
        if (!tbody) return;

        tbody.innerHTML = data.map(row => `
            <tr>
                <td>${this.escapeHtml(row.display_name || row.username)}</td>
                <td>${new Date(row.started_at).toLocaleDateString()}</td>
                <td>${row.level_number}</td>
                <td>${row.correct_answers}/${row.total_questions}</td>
                <td>${row.accuracy_percentage}%</td>
                <td>${row.average_response_time_ms ? (row.average_response_time_ms / 1000).toFixed(1) + 's' : '-'}</td>
                <td>${row.level_changed ? (row.new_level > row.level_number ? 'Up' : 'Down') : '-'}</td>
            </tr>
        `).join('');
    }

    /**
     * Update summary stats
     */
    updateStats(data) {
        const totalSessions = data.length;
        const totalQuestions = data.reduce((sum, row) => sum + (row.total_questions || 0), 0);
        const totalCorrect = data.reduce((sum, row) => sum + (row.correct_answers || 0), 0);
        const avgAccuracy = totalQuestions > 0 ? ((totalCorrect / totalQuestions) * 100).toFixed(1) : 0;

        document.getElementById('statSessions').textContent = totalSessions;
        document.getElementById('statQuestions').textContent = totalQuestions;
        document.getElementById('statAccuracy').textContent = avgAccuracy + '%';
    }

    /**
     * Load level configurations
     */
    async loadLevelConfigs() {
        try {
            const { data, error } = await supabase
                .from('level_configs')
                .select('*')
                .order('level');

            if (error) throw error;

            this.levelConfigs = data || [];
            this.renderLevelConfigs();
        } catch (error) {
            console.error('Failed to load level configs:', error);
            this.showError('Failed to load level configs: ' + error.message);
        }
    }

    /**
     * Render level configuration editor
     */
    renderLevelConfigs() {
        const container = document.getElementById('levelConfigsContainer');
        if (!container) return;

        container.innerHTML = this.levelConfigs.map(config => `
            <div class="level-config-card" data-level="${config.level}">
                <h4>Level ${config.level}</h4>
                <p class="level-description">${this.escapeHtml(config.description || '')}</p>
                <div class="config-fields">
                    <label>
                        Operations:
                        <input type="text" class="config-operations" value="${config.operations.join(', ')}" />
                    </label>
                    <label>
                        Max Operand:
                        <input type="number" class="config-max-operand" value="${config.max_operand}" min="10" max="100" />
                    </label>
                    <label>
                        Times Tables:
                        <input type="text" class="config-tables" value="${(config.multiplication_tables || []).join(', ')}" />
                    </label>
                    <label>
                        <input type="checkbox" class="config-active" ${config.is_active ? 'checked' : ''} />
                        Active
                    </label>
                </div>
            </div>
        `).join('');
    }

    /**
     * Save level configurations
     */
    async saveLevelConfigs() {
        const cards = document.querySelectorAll('.level-config-card');
        const updates = [];

        cards.forEach(card => {
            const level = parseInt(card.dataset.level);
            const operations = card.querySelector('.config-operations').value.split(',').map(s => s.trim()).filter(s => s);
            const maxOperand = parseInt(card.querySelector('.config-max-operand').value);
            const tables = card.querySelector('.config-tables').value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
            const isActive = card.querySelector('.config-active').checked;

            updates.push({
                level,
                operations,
                max_operand: maxOperand,
                multiplication_tables: tables,
                is_active: isActive
            });
        });

        try {
            for (const update of updates) {
                const { error } = await supabase
                    .from('level_configs')
                    .update(update)
                    .eq('level', update.level);

                if (error) throw error;
            }

            alert('Level configurations saved successfully');
        } catch (error) {
            console.error('Failed to save level configs:', error);
            alert('Failed to save level configs: ' + error.message);
        }
    }

    /**
     * Create a new user (child account)
     */
    async createUser() {
        const email = document.getElementById('newUserEmail')?.value;
        const password = document.getElementById('newUserPassword')?.value;
        const displayName = document.getElementById('newUserDisplayName')?.value;
        const username = document.getElementById('newUserUsername')?.value;

        if (!email || !password || !displayName || !username) {
            alert('Please fill in all fields');
            return;
        }

        try {
            // Create auth user via Supabase Admin API (requires service role)
            // For now, use signUp which creates the user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        display_name: displayName,
                        username: username
                    }
                }
            });

            if (authError) throw authError;

            if (authData.user) {
                // Create profile
                const { error: profileError } = await supabase
                    .from('profiles')
                    .insert({
                        id: authData.user.id,
                        username: username,
                        display_name: displayName,
                        current_level: 1,
                        is_admin: false
                    });

                if (profileError) throw profileError;
            }

            alert('User created successfully! They should check their email to confirm.');
            document.getElementById('createUserForm')?.reset();
            await this.loadUsers();
        } catch (error) {
            console.error('Failed to create user:', error);
            alert('Failed to create user: ' + error.message);
        }
    }

    /**
     * Export performance data to CSV
     */
    async exportToCsv() {
        const userId = document.getElementById('userFilter')?.value;
        const startDate = document.getElementById('startDate')?.value;
        const endDate = document.getElementById('endDate')?.value;

        try {
            let query = supabase
                .from('performance_analysis')
                .select('*')
                .order('started_at', { ascending: false });

            if (userId) query = query.eq('user_id', userId);
            if (startDate) query = query.gte('started_at', startDate);
            if (endDate) query = query.lte('started_at', endDate + 'T23:59:59');

            const { data, error } = await query;

            if (error) throw error;

            // Generate CSV
            const headers = ['Username', 'Date', 'Level', 'Correct', 'Total', 'Accuracy', 'Avg Time (s)', 'Level Changed'];
            const rows = (data || []).map(row => [
                row.display_name || row.username,
                new Date(row.started_at).toISOString(),
                row.level_number,
                row.correct_answers,
                row.total_questions,
                row.accuracy_percentage,
                row.average_response_time_ms ? (row.average_response_time_ms / 1000).toFixed(2) : '',
                row.level_changed ? (row.new_level > row.level_number ? 'Up' : 'Down') : ''
            ]);

            const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

            // Download
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `performance_export_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to export CSV:', error);
            alert('Failed to export: ' + error.message);
        }
    }

    /**
     * Logout
     */
    async logout() {
        await signOut();
        window.location.href = 'index.html';
    }

    /**
     * Show login screen
     */
    showLoginScreen() {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('dashboard')?.classList.add('hidden');
    }

    /**
     * Show dashboard
     */
    showDashboard() {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('dashboard')?.classList.remove('hidden');
        // Show admin username in header
        const adminUsernameEl = document.getElementById('adminUsername');
        if (adminUsernameEl && this.currentUser) {
            adminUsernameEl.textContent = this.currentUser.display_name || this.currentUser.username || 'Admin';
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 5000);
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize admin dashboard
const admin = new AdminDashboard();
window.admin = admin;

document.addEventListener('DOMContentLoaded', () => {
    admin.init();
});

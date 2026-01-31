-- Reward Maths - Supabase Migration
-- Initial Schema: profiles, game_sessions, question_attempts, level_configs
-- Created: 2026-01-31

-- ============================================================================
-- PROFILES TABLE (extends auth.users)
-- ============================================================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    avatar_emoji TEXT DEFAULT '🙂',
    current_level INTEGER DEFAULT 1 CHECK (current_level >= 1 AND current_level <= 30),
    is_admin BOOLEAN DEFAULT FALSE,
    reward_theme TEXT DEFAULT 'default',
    high_score_streak INTEGER DEFAULT 0,
    low_score_streak INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- GAME SESSIONS TABLE
-- ============================================================================
CREATE TABLE game_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    level_number INTEGER NOT NULL CHECK (level_number >= 1 AND level_number <= 30),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    total_questions INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    average_response_time_ms INTEGER,
    level_changed BOOLEAN DEFAULT FALSE,
    new_level INTEGER,
    change_reason TEXT
);

CREATE INDEX idx_game_sessions_user_id ON game_sessions(user_id);
CREATE INDEX idx_game_sessions_started_at ON game_sessions(started_at);

-- ============================================================================
-- QUESTION ATTEMPTS TABLE
-- ============================================================================
CREATE TABLE question_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES game_sessions(session_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    question_number INTEGER NOT NULL CHECK (question_number >= 1 AND question_number <= 20),
    question_text TEXT NOT NULL,
    correct_answer INTEGER NOT NULL,
    user_answer INTEGER,
    is_correct BOOLEAN NOT NULL,
    response_time_ms INTEGER,
    attempted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_question_attempts_session_id ON question_attempts(session_id);
CREATE INDEX idx_question_attempts_user_id ON question_attempts(user_id);
CREATE INDEX idx_question_attempts_attempted_at ON question_attempts(attempted_at);

-- ============================================================================
-- LEVEL CONFIGS TABLE (admin-editable)
-- ============================================================================
CREATE TABLE level_configs (
    level INTEGER PRIMARY KEY CHECK (level >= 1 AND level <= 30),
    operations TEXT[] NOT NULL DEFAULT ARRAY['+', '-'],
    max_operand INTEGER NOT NULL DEFAULT 20,
    multiplication_tables INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER level_configs_updated_at
    BEFORE UPDATE ON level_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- LEVEL HISTORY TABLE (for tracking level changes)
-- ============================================================================
CREATE TABLE level_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    old_level INTEGER NOT NULL,
    new_level INTEGER NOT NULL,
    reason TEXT,
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_level_history_user_id ON level_history(user_id);
CREATE INDEX idx_level_history_changed_at ON level_history(changed_at);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Performance analysis view
CREATE VIEW performance_analysis AS
SELECT
    p.username,
    p.display_name,
    gs.session_id,
    gs.level_number,
    gs.started_at,
    gs.completed_at,
    gs.total_questions,
    gs.correct_answers,
    CASE
        WHEN gs.total_questions > 0
        THEN ROUND((gs.correct_answers::NUMERIC / gs.total_questions::NUMERIC) * 100, 1)
        ELSE 0
    END as accuracy_percentage,
    gs.average_response_time_ms,
    gs.level_changed,
    gs.new_level,
    gs.change_reason
FROM game_sessions gs
JOIN profiles p ON gs.user_id = p.id
ORDER BY gs.started_at DESC;

-- Daily performance summary view
CREATE VIEW daily_performance AS
SELECT
    p.username,
    p.display_name,
    DATE(gs.started_at) as play_date,
    COUNT(DISTINCT gs.session_id) as sessions_played,
    SUM(gs.total_questions) as total_questions,
    SUM(gs.correct_answers) as total_correct,
    CASE
        WHEN SUM(gs.total_questions) > 0
        THEN ROUND((SUM(gs.correct_answers)::NUMERIC / SUM(gs.total_questions)::NUMERIC) * 100, 1)
        ELSE 0
    END as daily_accuracy,
    ROUND(AVG(gs.average_response_time_ms), 0) as avg_response_time
FROM game_sessions gs
JOIN profiles p ON gs.user_id = p.id
WHERE gs.completed_at IS NOT NULL
GROUP BY p.username, p.display_name, DATE(gs.started_at)
ORDER BY play_date DESC, p.username;

-- User stats summary view
CREATE VIEW user_stats AS
SELECT
    p.id,
    p.username,
    p.display_name,
    p.current_level,
    p.high_score_streak,
    p.low_score_streak,
    COUNT(DISTINCT gs.session_id) as total_sessions,
    COALESCE(SUM(gs.total_questions), 0) as total_questions_answered,
    COALESCE(SUM(gs.correct_answers), 0) as total_correct_answers,
    CASE
        WHEN COALESCE(SUM(gs.total_questions), 0) > 0
        THEN ROUND((SUM(gs.correct_answers)::NUMERIC / SUM(gs.total_questions)::NUMERIC) * 100, 1)
        ELSE 0
    END as overall_accuracy
FROM profiles p
LEFT JOIN game_sessions gs ON p.id = gs.user_id AND gs.completed_at IS NOT NULL
GROUP BY p.id, p.username, p.display_name, p.current_level, p.high_score_streak, p.low_score_streak;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE level_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE level_history ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can read own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile (non-admin fields)"
    ON profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can read all profiles"
    ON profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE
        )
    );

CREATE POLICY "Admins can update all profiles"
    ON profiles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE
        )
    );

CREATE POLICY "Admins can insert profiles"
    ON profiles FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE
        )
    );

-- Game sessions policies
CREATE POLICY "Users can read own sessions"
    ON game_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
    ON game_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
    ON game_sessions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all sessions"
    ON game_sessions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE
        )
    );

-- Question attempts policies
CREATE POLICY "Users can read own attempts"
    ON question_attempts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own attempts"
    ON question_attempts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read all attempts"
    ON question_attempts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE
        )
    );

-- Level configs policies (public read, admin write)
CREATE POLICY "Anyone can read level configs"
    ON level_configs FOR SELECT
    USING (TRUE);

CREATE POLICY "Only admins can modify level configs"
    ON level_configs FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE
        )
    );

-- Level history policies
CREATE POLICY "Users can read own level history"
    ON level_history FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own level history"
    ON level_history FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read all level history"
    ON level_history FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE
        )
    );

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to get user by username (for login display)
CREATE OR REPLACE FUNCTION get_user_by_username(p_username TEXT)
RETURNS TABLE (
    id UUID,
    username TEXT,
    display_name TEXT,
    avatar_emoji TEXT,
    current_level INTEGER,
    reward_theme TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        profiles.id,
        profiles.username,
        profiles.display_name,
        profiles.avatar_emoji,
        profiles.current_level,
        profiles.reward_theme
    FROM profiles
    WHERE profiles.username = p_username;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to complete a game session
CREATE OR REPLACE FUNCTION complete_game_session(
    p_session_id UUID,
    p_correct_answers INTEGER,
    p_total_questions INTEGER,
    p_avg_response_time INTEGER,
    p_level_changed BOOLEAN,
    p_new_level INTEGER,
    p_change_reason TEXT
)
RETURNS VOID AS $$
BEGIN
    UPDATE game_sessions
    SET
        completed_at = NOW(),
        correct_answers = p_correct_answers,
        total_questions = p_total_questions,
        average_response_time_ms = p_avg_response_time,
        level_changed = p_level_changed,
        new_level = p_new_level,
        change_reason = p_change_reason
    WHERE session_id = p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update user level and streaks
CREATE OR REPLACE FUNCTION update_user_progress(
    p_user_id UUID,
    p_new_level INTEGER,
    p_high_streak INTEGER,
    p_low_streak INTEGER
)
RETURNS VOID AS $$
BEGIN
    UPDATE profiles
    SET
        current_level = p_new_level,
        high_score_streak = p_high_streak,
        low_score_streak = p_low_streak,
        updated_at = NOW()
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

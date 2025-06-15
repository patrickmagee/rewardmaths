-- Reward Maths Game Performance Tracking Database
-- MySQL Schema for Bluehost

-- Create the main table for tracking every question attempt
CREATE TABLE question_attempts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    level_number INT NOT NULL,
    question_text VARCHAR(100) NOT NULL,
    correct_answer INT NOT NULL,
    user_answer INT,
    is_correct BOOLEAN NOT NULL,
    response_time_ms INT NULL COMMENT 'Response time in milliseconds, NULL if over 10 seconds',
    session_id VARCHAR(36) NOT NULL COMMENT 'UUID to group 20 questions together',
    question_number_in_session INT NOT NULL COMMENT '1-20 position in the session',
    
    INDEX idx_username (username),
    INDEX idx_timestamp (timestamp),
    INDEX idx_session (session_id),
    INDEX idx_level (level_number),
    INDEX idx_user_time (username, timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create a sessions summary table for quick analysis
CREATE TABLE game_sessions (
    session_id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NULL,
    level_number INT NOT NULL,
    total_questions INT DEFAULT 0,
    correct_answers INT DEFAULT 0,
    session_completed BOOLEAN DEFAULT FALSE,
    average_response_time_ms DECIMAL(8,2) NULL COMMENT 'Average for questions under 10s',
    
    INDEX idx_username (username),
    INDEX idx_start_time (start_time),
    INDEX idx_level (level_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create a user performance summary table for quick stats
CREATE TABLE user_performance_summary (
    username VARCHAR(50) PRIMARY KEY,
    total_questions_attempted INT DEFAULT 0,
    total_correct_answers INT DEFAULT 0,
    current_level INT DEFAULT 1,
    total_sessions INT DEFAULT 0,
    first_attempt_date DATETIME NULL,
    last_attempt_date DATETIME NULL,
    average_accuracy DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Percentage accuracy',
    average_response_time_ms DECIMAL(8,2) NULL COMMENT 'Average for questions under 10s',
    
    INDEX idx_last_attempt (last_attempt_date),
    INDEX idx_current_level (current_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert initial user records
INSERT INTO user_performance_summary (username, current_level, first_attempt_date) VALUES
('Tom', 1, NOW()),
('Patrick', 1, NOW()),
('Eliza', 1, NOW());

-- Create a view for easy performance analysis
CREATE VIEW performance_analysis AS
SELECT 
    qa.username,
    qa.level_number,
    qa.question_text,
    qa.is_correct,
    qa.response_time_ms,
    qa.timestamp,
    DATE(qa.timestamp) as attempt_date,
    gs.session_id,
    gs.correct_answers as session_score,
    gs.total_questions as session_total
FROM question_attempts qa
JOIN game_sessions gs ON qa.session_id = gs.session_id
ORDER BY qa.timestamp DESC;

-- Create a view for daily performance summary
CREATE VIEW daily_performance AS
SELECT 
    username,
    DATE(timestamp) as date,
    COUNT(*) as questions_attempted,
    SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct_answers,
    ROUND(AVG(CASE WHEN is_correct THEN 100.0 ELSE 0.0 END), 2) as accuracy_percentage,
    AVG(CASE WHEN response_time_ms IS NOT NULL THEN response_time_ms END) as avg_response_time_ms,
    MIN(level_number) as min_level,
    MAX(level_number) as max_level
FROM question_attempts
GROUP BY username, DATE(timestamp)
ORDER BY username, date DESC;

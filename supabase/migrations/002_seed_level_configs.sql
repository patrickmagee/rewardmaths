-- Reward Maths - Seed Level Configurations
-- 30 levels designed for P6/P7 (ages 10-12) Scottish curriculum
-- Created: 2026-01-31

-- Clear existing level configs
DELETE FROM level_configs;

-- ============================================================================
-- PHASE 1: FOUNDATION (Levels 1-5)
-- Addition, subtraction to 20, introduction to easy times tables
-- ============================================================================

INSERT INTO level_configs (level, operations, max_operand, multiplication_tables, description) VALUES
(1, ARRAY['+'], 10, ARRAY[]::INTEGER[],
    'Addition with numbers up to 10'),

(2, ARRAY['+', '-'], 10, ARRAY[]::INTEGER[],
    'Addition and subtraction with numbers up to 10'),

(3, ARRAY['+', '-'], 20, ARRAY[]::INTEGER[],
    'Addition and subtraction with numbers up to 20'),

(4, ARRAY['+', '-'], 20, ARRAY[2, 5, 10]::INTEGER[],
    'Add/subtract to 20, introduction to 2, 5, 10 times tables'),

(5, ARRAY['+', '-', '*'], 20, ARRAY[2, 5, 10]::INTEGER[],
    'Mixed operations with easy times tables (2, 5, 10)');

-- ============================================================================
-- PHASE 2: TIMES TABLES MASTERY (Levels 6-13)
-- Progressive introduction of all multiplication tables 2-12
-- ============================================================================

INSERT INTO level_configs (level, operations, max_operand, multiplication_tables, description) VALUES
(6, ARRAY['*'], 12, ARRAY[2, 3]::INTEGER[],
    'Times tables: 2 and 3'),

(7, ARRAY['*'], 12, ARRAY[2, 3, 4]::INTEGER[],
    'Times tables: 2, 3, and 4'),

(8, ARRAY['*'], 12, ARRAY[2, 3, 4, 5]::INTEGER[],
    'Times tables: 2, 3, 4, and 5'),

(9, ARRAY['*'], 12, ARRAY[2, 3, 4, 5, 6]::INTEGER[],
    'Times tables: 2 through 6'),

(10, ARRAY['*'], 12, ARRAY[2, 3, 4, 5, 6, 7]::INTEGER[],
    'Times tables: 2 through 7'),

(11, ARRAY['*'], 12, ARRAY[2, 3, 4, 5, 6, 7, 8]::INTEGER[],
    'Times tables: 2 through 8'),

(12, ARRAY['*'], 12, ARRAY[2, 3, 4, 5, 6, 7, 8, 9]::INTEGER[],
    'Times tables: 2 through 9'),

(13, ARRAY['*'], 12, ARRAY[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::INTEGER[],
    'All times tables: 2 through 12');

-- ============================================================================
-- PHASE 3: DIVISION (Levels 14-15)
-- Division using the times tables learned
-- ============================================================================

INSERT INTO level_configs (level, operations, max_operand, multiplication_tables, description) VALUES
(14, ARRAY['/'], 12, ARRAY[2, 3, 4, 5]::INTEGER[],
    'Division using tables 2-5'),

(15, ARRAY['/', '*'], 12, ARRAY[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::INTEGER[],
    'Division and multiplication with all tables');

-- ============================================================================
-- PHASE 4: MIXED OPERATIONS SPEED (Levels 16-25)
-- All four operations with progressively larger numbers
-- ============================================================================

INSERT INTO level_configs (level, operations, max_operand, multiplication_tables, description) VALUES
(16, ARRAY['+', '-'], 50, ARRAY[]::INTEGER[],
    'Addition and subtraction with numbers up to 50'),

(17, ARRAY['+', '-'], 100, ARRAY[]::INTEGER[],
    'Addition and subtraction with numbers up to 100'),

(18, ARRAY['+', '-', '*'], 50, ARRAY[2, 3, 4, 5, 6]::INTEGER[],
    'Mixed add/subtract/multiply, numbers to 50'),

(19, ARRAY['+', '-', '*', '/'], 50, ARRAY[2, 3, 4, 5, 6]::INTEGER[],
    'All four operations, numbers to 50'),

(20, ARRAY['+', '-', '*', '/'], 75, ARRAY[2, 3, 4, 5, 6, 7, 8]::INTEGER[],
    'All four operations, numbers to 75'),

(21, ARRAY['+', '-', '*', '/'], 100, ARRAY[2, 3, 4, 5, 6, 7, 8, 9]::INTEGER[],
    'All four operations, numbers to 100'),

(22, ARRAY['+', '-', '*', '/'], 100, ARRAY[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::INTEGER[],
    'All operations and all tables, numbers to 100'),

(23, ARRAY['+', '-'], 100, ARRAY[]::INTEGER[],
    'Speed challenge: Add/subtract to 100'),

(24, ARRAY['*', '/'], 12, ARRAY[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::INTEGER[],
    'Speed challenge: Multiply and divide with all tables'),

(25, ARRAY['+', '-', '*', '/'], 100, ARRAY[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::INTEGER[],
    'Advanced: All operations mixed, full range');

-- ============================================================================
-- PHASE 5: MASTERY (Levels 26-30)
-- Expert-level challenges with larger numbers and all operations
-- ============================================================================

INSERT INTO level_configs (level, operations, max_operand, multiplication_tables, description) VALUES
(26, ARRAY['+', '-'], 100, ARRAY[]::INTEGER[],
    'Mastery: Quick mental addition and subtraction'),

(27, ARRAY['*'], 12, ARRAY[6, 7, 8, 9, 11, 12]::INTEGER[],
    'Mastery: Harder times tables (6-9, 11, 12)'),

(28, ARRAY['/'], 12, ARRAY[6, 7, 8, 9, 11, 12]::INTEGER[],
    'Mastery: Division with harder tables'),

(29, ARRAY['+', '-', '*', '/'], 100, ARRAY[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::INTEGER[],
    'Mastery: All operations, random mix'),

(30, ARRAY['+', '-', '*', '/'], 100, ARRAY[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]::INTEGER[],
    'CHAMPION LEVEL: Complete mastery of all operations');

-- Verify seed data
SELECT level, operations, max_operand, multiplication_tables, description
FROM level_configs
ORDER BY level;

/**
 * Math Levels Configuration
 * Loads level configurations from Supabase and generates questions
 */

import { supabase } from './supabase.js';

/**
 * Math Levels class for managing progressive difficulty
 */
export class MathLevels {
    constructor() {
        this.levels = null;
        this.isLoaded = false;
    }

    /**
     * Loads math levels from Supabase
     * @returns {Promise<void>}
     */
    async loadLevels() {
        if (this.isLoaded && this.levels) {
            return;
        }

        try {
            const { data, error } = await supabase
                .from('level_configs')
                .select('*')
                .eq('is_active', true)
                .order('level', { ascending: true });

            if (error) {
                console.error('Failed to load level configs from Supabase:', error);
                this.levels = this.getDefaultLevels();
            } else if (data && data.length > 0) {
                this.levels = data;
                console.log(`Loaded ${data.length} level configs from Supabase`);
            } else {
                console.warn('No level configs found, using defaults');
                this.levels = this.getDefaultLevels();
            }

            this.isLoaded = true;
        } catch (error) {
            console.error('Error loading levels:', error);
            this.levels = this.getDefaultLevels();
            this.isLoaded = true;
        }
    }

    /**
     * Gets the configuration for a specific level
     * @param {number} level - Level number (1-30)
     * @returns {Object} Level configuration
     */
    getLevelConfig(level) {
        if (!this.levels || this.levels.length === 0) {
            return this.getDefaultLevelConfig(level);
        }

        const levelConfig = this.levels.find(l => l.level === level);
        if (levelConfig) {
            return levelConfig;
        }

        // Return highest available level if requested level not found
        return this.levels[this.levels.length - 1];
    }

    /**
     * Generates a math question based on level configuration
     * @param {number} level - Current level
     * @returns {Object} Question object with text and answer
     */
    generateQuestion(level) {
        const config = this.getLevelConfig(level);

        // Get a random operation from available operations
        const operation = this.getRandomOperation(config.operations);

        // Handle multiplication and division with times tables
        if (operation === '*' && config.multiplication_tables && config.multiplication_tables.length > 0) {
            return this.generateMultiplicationQuestion(config);
        } else if (operation === '/' && config.multiplication_tables && config.multiplication_tables.length > 0) {
            return this.generateDivisionQuestion(config);
        } else {
            return this.generateBasicQuestion(config, operation);
        }
    }

    /**
     * Generates a basic addition or subtraction question
     * @param {Object} config - Level configuration
     * @param {string} operation - Operation (+, -, *, /)
     * @returns {Object} Question object
     */
    generateBasicQuestion(config, operation) {
        let num1, num2, answer;
        const maxOperand = config.max_operand || 20;

        // Generate appropriate numbers based on operation
        switch (operation) {
            case '+':
                num1 = this.getRandomNumber(1, maxOperand);
                num2 = this.getRandomNumber(1, maxOperand);
                answer = num1 + num2;
                break;

            case '-':
                // Ensure positive result
                num1 = this.getRandomNumber(2, maxOperand);
                num2 = this.getRandomNumber(1, num1);
                answer = num1 - num2;
                break;

            case '*':
                // Simple multiplication without specific tables
                num1 = this.getRandomNumber(2, Math.min(12, maxOperand));
                num2 = this.getRandomNumber(2, Math.min(12, maxOperand));
                answer = num1 * num2;
                break;

            case '/':
                // Generate clean division
                num2 = this.getRandomNumber(2, Math.min(12, maxOperand));
                answer = this.getRandomNumber(1, 12);
                num1 = num2 * answer;
                break;

            default:
                num1 = this.getRandomNumber(1, maxOperand);
                num2 = this.getRandomNumber(1, maxOperand);
                answer = num1 + num2;
        }

        const operationSymbol = operation === '*' ? '\u00D7' : (operation === '/' ? '\u00F7' : operation);

        return {
            text: `${num1} ${operationSymbol} ${num2}`,
            answer: answer
        };
    }

    /**
     * Generates a multiplication question using times tables
     * @param {Object} config - Level configuration
     * @returns {Object} Question object
     */
    generateMultiplicationQuestion(config) {
        const tables = config.multiplication_tables || [2, 5, 10];
        const table = tables[Math.floor(Math.random() * tables.length)];
        const multiplier = this.getRandomNumber(1, 12);

        return {
            text: `${table} \u00D7 ${multiplier}`,
            answer: table * multiplier
        };
    }

    /**
     * Generates a division question using times tables
     * @param {Object} config - Level configuration
     * @returns {Object} Question object
     */
    generateDivisionQuestion(config) {
        const tables = config.multiplication_tables || [2, 5, 10];
        const divisor = tables[Math.floor(Math.random() * tables.length)];
        const quotient = this.getRandomNumber(1, 12);
        const dividend = divisor * quotient;

        return {
            text: `${dividend} \u00F7 ${divisor}`,
            answer: quotient
        };
    }

    /**
     * Gets a random operation from available operations
     * @param {Array} operations - Available operations
     * @returns {string} Random operation
     */
    getRandomOperation(operations) {
        if (!operations || operations.length === 0) {
            return '+';
        }
        return operations[Math.floor(Math.random() * operations.length)];
    }

    /**
     * Gets a random number within range
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Random number
     */
    getRandomNumber(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Default level configuration if Supabase fails
     * @param {number} level - Level number
     * @returns {Object} Default level config
     */
    getDefaultLevelConfig(level) {
        const defaults = this.getDefaultLevels();
        const config = defaults.find(l => l.level === level);
        return config || defaults[defaults.length - 1];
    }

    /**
     * Get default level configurations (fallback if Supabase unavailable)
     * @returns {Array} Default level configurations
     */
    getDefaultLevels() {
        return [
            // Foundation (1-5)
            { level: 1, operations: ['+'], max_operand: 10, multiplication_tables: [] },
            { level: 2, operations: ['+', '-'], max_operand: 10, multiplication_tables: [] },
            { level: 3, operations: ['+', '-'], max_operand: 20, multiplication_tables: [] },
            { level: 4, operations: ['+', '-'], max_operand: 20, multiplication_tables: [2, 5, 10] },
            { level: 5, operations: ['+', '-', '*'], max_operand: 20, multiplication_tables: [2, 5, 10] },

            // Times Tables (6-13)
            { level: 6, operations: ['*'], max_operand: 12, multiplication_tables: [2, 3] },
            { level: 7, operations: ['*'], max_operand: 12, multiplication_tables: [2, 3, 4] },
            { level: 8, operations: ['*'], max_operand: 12, multiplication_tables: [2, 3, 4, 5] },
            { level: 9, operations: ['*'], max_operand: 12, multiplication_tables: [2, 3, 4, 5, 6] },
            { level: 10, operations: ['*'], max_operand: 12, multiplication_tables: [2, 3, 4, 5, 6, 7] },
            { level: 11, operations: ['*'], max_operand: 12, multiplication_tables: [2, 3, 4, 5, 6, 7, 8] },
            { level: 12, operations: ['*'], max_operand: 12, multiplication_tables: [2, 3, 4, 5, 6, 7, 8, 9] },
            { level: 13, operations: ['*'], max_operand: 12, multiplication_tables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },

            // Division (14-15)
            { level: 14, operations: ['/'], max_operand: 12, multiplication_tables: [2, 3, 4, 5] },
            { level: 15, operations: ['/', '*'], max_operand: 12, multiplication_tables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },

            // Mixed Speed (16-25)
            { level: 16, operations: ['+', '-'], max_operand: 50, multiplication_tables: [] },
            { level: 17, operations: ['+', '-'], max_operand: 100, multiplication_tables: [] },
            { level: 18, operations: ['+', '-', '*'], max_operand: 50, multiplication_tables: [2, 3, 4, 5, 6] },
            { level: 19, operations: ['+', '-', '*', '/'], max_operand: 50, multiplication_tables: [2, 3, 4, 5, 6] },
            { level: 20, operations: ['+', '-', '*', '/'], max_operand: 75, multiplication_tables: [2, 3, 4, 5, 6, 7, 8] },
            { level: 21, operations: ['+', '-', '*', '/'], max_operand: 100, multiplication_tables: [2, 3, 4, 5, 6, 7, 8, 9] },
            { level: 22, operations: ['+', '-', '*', '/'], max_operand: 100, multiplication_tables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
            { level: 23, operations: ['+', '-'], max_operand: 100, multiplication_tables: [] },
            { level: 24, operations: ['*', '/'], max_operand: 12, multiplication_tables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
            { level: 25, operations: ['+', '-', '*', '/'], max_operand: 100, multiplication_tables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },

            // Mastery (26-30)
            { level: 26, operations: ['+', '-'], max_operand: 100, multiplication_tables: [] },
            { level: 27, operations: ['*'], max_operand: 12, multiplication_tables: [6, 7, 8, 9, 11, 12] },
            { level: 28, operations: ['/'], max_operand: 12, multiplication_tables: [6, 7, 8, 9, 11, 12] },
            { level: 29, operations: ['+', '-', '*', '/'], max_operand: 100, multiplication_tables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
            { level: 30, operations: ['+', '-', '*', '/'], max_operand: 100, multiplication_tables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }
        ];
    }
}

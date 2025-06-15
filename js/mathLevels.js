/**
 * Math Levels Configuration
 * Handles loading and using progressive math challenge levels
 */

/**
 * Math Levels class for managing progressive difficulty
 */
export class MathLevels {
    constructor() {
        this.levels = null;
        this.loadLevels();
    }

    /**
     * Loads math levels from JSON file
     */
    async loadLevels() {
        try {
            const response = await fetch('./math_levels.json');
            this.levels = await response.json();
        } catch (error) {
            console.error('Failed to load math levels:', error);
            // Fallback to basic levels if JSON fails to load
            this.levels = this.getBasicLevels();
        }
    }

    /**
     * Gets the configuration for a specific level
     * @param {number} level - Level number (1-100)
     * @returns {Object} Level configuration
     */
    getLevelConfig(level) {
        if (!this.levels) {
            return this.getBasicLevelConfig(level);
        }

        const levelConfig = this.levels.find(l => l.level === level);
        return levelConfig || this.levels[this.levels.length - 1]; // Return highest level if not found
    }

    /**
     * Generates a math question based on level configuration
     * @param {number} level - Current level
     * @returns {Object} Question object with text and answer
     */
    generateQuestion(level) {
        const config = this.getLevelConfig(level);
        
        if (config.multi_step && config.operands_per_question > 2) {
            return this.generateMultiStepQuestion(config);
        } else {
            return this.generateSimpleQuestion(config);
        }
    }

    /**
     * Generates a simple two-operand question
     * @param {Object} config - Level configuration
     * @returns {Object} Question object
     */
    generateSimpleQuestion(config) {
        const operation = this.getRandomOperation(config.operations);
        
        if (operation === '*' && config.multiplication_tables.length > 0) {
            return this.generateMultiplicationQuestion(config);
        } else if (operation === '/' && config.multiplication_tables.length > 0) {
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
        
        do {
            num1 = this.getRandomNumber(1, config.max_operand);
            num2 = this.getRandomNumber(1, config.max_operand);
            
            switch (operation) {
                case '+':
                    answer = num1 + num2;
                    break;
                case '-':
                    answer = num1 - num2;
                    // Ensure non-negative results if not allowed
                    if (!config.negative_results_allowed && answer < 0) {
                        [num1, num2] = [num2, num1]; // Swap to make positive
                        answer = num1 - num2;
                    }
                    break;
                case '*':
                    answer = num1 * num2;
                    break;
                case '/':
                    // Ensure clean division
                    answer = num1;
                    num1 = num1 * num2;
                    break;
            }
        } while (!config.negative_results_allowed && answer < 0);

        return {
            text: `${num1} ${operation} ${num2}`,
            answer: answer
        };
    }

    /**
     * Generates a multiplication question using times tables
     * @param {Object} config - Level configuration
     * @returns {Object} Question object
     */
    generateMultiplicationQuestion(config) {
        const table = config.multiplication_tables[
            Math.floor(Math.random() * config.multiplication_tables.length)
        ];
        const multiplier = this.getRandomNumber(1, 12);
        
        return {
            text: `${table} × ${multiplier}`,
            answer: table * multiplier
        };
    }

    /**
     * Generates a division question using times tables
     * @param {Object} config - Level configuration
     * @returns {Object} Question object
     */
    generateDivisionQuestion(config) {
        const table = config.multiplication_tables[
            Math.floor(Math.random() * config.multiplication_tables.length)
        ];
        const divisor = this.getRandomNumber(1, 12);
        const dividend = table * divisor;
        
        return {
            text: `${dividend} ÷ ${table}`,
            answer: divisor
        };
    }

    /**
     * Generates a multi-step question with multiple operands
     * @param {Object} config - Level configuration
     * @returns {Object} Question object
     */
    generateMultiStepQuestion(config) {
        const operandCount = config.operands_per_question;
        const operands = [];
        const operations = [];
        
        // Generate operands and operations
        for (let i = 0; i < operandCount; i++) {
            operands.push(this.getRandomNumber(1, Math.min(config.max_operand, 1000))); // Limit for readability
        }
        
        for (let i = 0; i < operandCount - 1; i++) {
            operations.push(this.getRandomOperation(config.operations));
        }
        
        // Build question text and calculate answer
        let questionText = operands[0].toString();
        let answer = operands[0];
        
        for (let i = 0; i < operations.length; i++) {
            questionText += ` ${operations[i]} ${operands[i + 1]}`;
            
            switch (operations[i]) {
                case '+':
                    answer += operands[i + 1];
                    break;
                case '-':
                    answer -= operands[i + 1];
                    break;
                case '*':
                    answer *= operands[i + 1];
                    break;
                case '/':
                    answer = Math.round(answer / operands[i + 1]);
                    break;
            }
        }
        
        return {
            text: questionText,
            answer: answer
        };
    }

    /**
     * Gets a random operation from available operations
     * @param {Array} operations - Available operations
     * @returns {string} Random operation
     */
    getRandomOperation(operations) {
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
     * Fallback basic level configuration if JSON fails to load
     * @param {number} level - Level number
     * @returns {Object} Basic level config
     */
    getBasicLevelConfig(level) {
        return {
            level: level,
            operations: ['+', '-'],
            max_operand: Math.min(10 + level * 2, 100),
            operands_per_question: 2,
            carry_borrow: level > 2,
            negative_results_allowed: false,
            multi_step: false,
            multiplication_tables: [],
            two_digit_divisor: false
        };
    }

    /**
     * Fallback basic levels array
     * @returns {Array} Basic levels configuration
     */
    getBasicLevels() {
        const levels = [];
        for (let i = 1; i <= 100; i++) {
            levels.push(this.getBasicLevelConfig(i));
        }
        return levels;
    }
}

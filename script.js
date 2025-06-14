// User Management System
class UserManager {
    constructor() {
        this.users = this.loadUsers();
        this.currentUser = null;
        this.failedAttempts = {};
        this.lockoutTimes = [1000, 5000, 30000, 60000, 300000, 1800000, 3600000, 86400000]; // 1s, 5s, 30s, 1min, 5min, 30min, 1hr, 1day
        
        // Load failed attempts from localStorage
        const savedFailedAttempts = localStorage.getItem('mathAdventureFailedAttempts');
        this.failedAttempts = savedFailedAttempts ? JSON.parse(savedFailedAttempts) : {};
    }

    loadUsers() {
        // Create predefined users
        return [
            { username: 'Tom', password: 'Tom1234', level: 25, gameData: {}, statistics: this.createEmptyStats() },
            { username: 'Patrick', password: 'Patrick1234', level: 30, gameData: {}, statistics: this.createEmptyStats() },
            { username: 'Eliza', password: 'Eliza1234', level: 20, gameData: {}, statistics: this.createEmptyStats() }
        ];
    }

    createEmptyStats() {
        return {
            totalCorrect: 0,
            totalWrong: 0,
            gamesPlayed: 0,
            lastPlayed: null,
            history: []
        };
    }

    loginUser(username, password) {
        const user = this.users.find(u => u.username === username);
        
        if (!user) {
            return { success: false, message: 'Invalid username or password' };
        }
        
        // Check if user is locked out
        if (this.isLockedOut(username)) {
            const remainingTime = this.getRemainingLockoutTime(username);
            const timeStr = this.formatLockoutTime(remainingTime);
            return { success: false, message: `Account is locked. Try again in ${timeStr}` };
        }
        
        if (user.password !== password) {
            // Increment failed attempts
            this.recordFailedAttempt(username);
            
            const attempts = this.getFailedAttempts(username);
            if (attempts >= this.lockoutTimes.length) {
                return { success: false, message: 'Too many failed attempts. Account locked for 24 hours.' };
            } else {
                const lockoutTime = this.getCurrentLockoutTime(username);
                const timeStr = this.formatLockoutTime(lockoutTime);
                return { success: false, message: `Invalid username or password. Account locked for ${timeStr}.` };
            }
        }
        
        // Successful login, reset failed attempts
        this.resetFailedAttempts(username);
        this.currentUser = user;
        return { success: true, user };
    }

    isLockedOut(username) {
        if (!this.failedAttempts[username]) return false;
        
        const lastAttemptTime = this.failedAttempts[username].timestamp;
        const attempts = this.failedAttempts[username].count;
        
        if (attempts === 0) return false;
        
        const lockoutDuration = this.getLockoutDuration(attempts);
        const now = Date.now();
        
        return (now - lastAttemptTime) < lockoutDuration;
    }
    
    getRemainingLockoutTime(username) {
        if (!this.failedAttempts[username]) return 0;
        
        const lastAttemptTime = this.failedAttempts[username].timestamp;
        const attempts = this.failedAttempts[username].count;
        const lockoutDuration = this.getLockoutDuration(attempts);
        const now = Date.now();
        
        return Math.max(0, lockoutDuration - (now - lastAttemptTime));
    }
    
    formatLockoutTime(ms) {
        if (ms < 1000) return "less than a second";
        if (ms < 60000) return `${Math.ceil(ms / 1000)} seconds`;
        if (ms < 3600000) return `${Math.ceil(ms / 60000)} minutes`;
        if (ms < 86400000) return `${Math.ceil(ms / 3600000)} hours`;
        return `${Math.ceil(ms / 86400000)} days`;
    }
    
    getLockoutDuration(attempts) {
        const index = Math.min(attempts - 1, this.lockoutTimes.length - 1);
        return this.lockoutTimes[index];
    }
    
    getCurrentLockoutTime(username) {
        const attempts = this.getFailedAttempts(username);
        return this.getLockoutDuration(attempts);
    }
    
    recordFailedAttempt(username) {
        if (!this.failedAttempts[username]) {
            this.failedAttempts[username] = { count: 0, timestamp: 0 };
        }
        
        this.failedAttempts[username].count++;
        this.failedAttempts[username].timestamp = Date.now();
        
        // Store in localStorage to persist between sessions
        localStorage.setItem('mathAdventureFailedAttempts', JSON.stringify(this.failedAttempts));
    }
    
    getFailedAttempts(username) {
        if (!this.failedAttempts[username]) return 0;
        return this.failedAttempts[username].count;
    }
    
    resetFailedAttempts(username) {
        if (this.failedAttempts[username]) {
            this.failedAttempts[username].count = 0;
            this.failedAttempts[username].timestamp = 0;
            
            // Update localStorage
            localStorage.setItem('mathAdventureFailedAttempts', JSON.stringify(this.failedAttempts));
        }
    }

    updateUserProgress(level, gameData) {
        if (!this.currentUser) return;
        
        // Find the user in the array and update
        const userIndex = this.users.findIndex(u => u.username === this.currentUser.username);
        if (userIndex !== -1) {
            // Update level
            this.users[userIndex].level = level;
            
            // Update game data
            this.users[userIndex].gameData = gameData;
            
            // Update statistics
            if (!this.users[userIndex].statistics) {
                this.users[userIndex].statistics = this.createEmptyStats();
            }
            
            const stats = this.users[userIndex].statistics;
            stats.totalCorrect += gameData.correctAnswers || 0;
            stats.totalWrong += gameData.wrongAnswers || 0;
            stats.gamesPlayed += 1;
            stats.lastPlayed = new Date().toISOString();
            
            // Record history (keep last 10 games)
            stats.history.unshift({
                date: new Date().toISOString(),
                correct: gameData.correctAnswers || 0,
                wrong: gameData.wrongAnswers || 0,
                level: level
            });
            
            if (stats.history.length > 10) {
                stats.history = stats.history.slice(0, 10);
            }
            
            // Check for badges
            if (gameData.correctAnswers === 10) {
                stats.badges.perfectRound = true;
            }
            
            if (stats.gamesPlayed >= 10) {
                stats.badges.tenGames = true;
            }
            
            if (level >= 20) {
                stats.badges.levelTwenty = true;
            }
            
            if (level >= 50) {
                stats.badges.levelFifty = true;
            }
            
            this.currentUser = this.users[userIndex];
            this.saveUsers(this.users);
            
            return this.users[userIndex];
        }
    }

    logoutUser() {
        this.currentUser = null;
        document.getElementById('loginScreen').style.display = 'block';
        document.getElementById('gameScreen').style.display = 'none';
        document.getElementById('usernameInput').value = '';
        document.getElementById('passwordInput').value = '';
        document.getElementById('loginError').textContent = '';
    }
}

class MathGame {
    constructor(userManager) {
        this.userManager = userManager;
        this.level = userManager.currentUser ? userManager.currentUser.level : 25;
        this.currentQuestion = 1;
        this.correctAnswers = 0;
        this.wrongAnswers = 0;
        this.currentAnswer = 0;
        this.questionsPerRound = 10;
        this.startTime = new Date();
        this.questionTimes = [];
        
        document.getElementById('playerName').textContent = userManager.currentUser.username;
        
        this.updateDisplay();
        this.generateQuestion();
        this.setupEventListeners();
        this.updateStatistics();
    }

    setupEventListeners() {
        const answerInput = document.getElementById('answerInput');
        const submitBtn = document.getElementById('submitBtn');

        // Enter key handler
        answerInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !submitBtn.disabled) {
                e.preventDefault(); // Prevent default form submission
                this.checkAnswer();
            }
        });

        // Submit button click handler
        submitBtn.addEventListener('click', () => {
            this.checkAnswer();
        });

        // Focus input field when it's shown
        answerInput.focus();
    }

    generateQuestion() {
        const difficulty = this.level;
        let num1, num2, operation, question, answer;

        // Record the time when the question is generated
        this.questionStartTime = new Date();

        // Determine number ranges based on difficulty level
        if (difficulty <= 10) {
            // Level 1-10: Single digit addition/subtraction
            num1 = Math.floor(Math.random() * 9) + 1;
            num2 = Math.floor(Math.random() * 9) + 1;
        } else if (difficulty <= 25) {
            // Level 11-25: Mix of single and double digit
            num1 = Math.floor(Math.random() * 20) + 1;
            num2 = Math.floor(Math.random() * 10) + 1;
        } else if (difficulty <= 50) {
            // Level 26-50: Double digit numbers
            num1 = Math.floor(Math.random() * 50) + 10;
            num2 = Math.floor(Math.random() * 30) + 1;
        } else if (difficulty <= 75) {
            // Level 51-75: Larger double digit numbers
            num1 = Math.floor(Math.random() * 99) + 10;
            num2 = Math.floor(Math.random() * 50) + 1;
        } else {
            // Level 76-100: Triple digit numbers
            num1 = Math.floor(Math.random() * 500) + 50;
            num2 = Math.floor(Math.random() * 100) + 1;
        }

        // Choose operation based on difficulty
        // More subtraction and multiplication as difficulty increases
        const rand = Math.random();
        if (difficulty <= 20) {
            // Mostly addition for beginners
            if (rand < 0.8) {
                operation = '+';
                question = `${num1} ${operation} ${num2}`;
                answer = num1 + num2;
            } else {
                operation = '−';
                // Ensure positive result for subtraction
                if (num1 < num2) {
                    [num1, num2] = [num2, num1];
                }
                question = `${num1} ${operation} ${num2}`;
                answer = num1 - num2;
            }
        } else if (difficulty <= 50) {
            // More subtraction for intermediate
            if (rand < 0.6) {
                operation = '+';
                question = `${num1} ${operation} ${num2}`;
                answer = num1 + num2;
            } else {
                operation = '−';
                // Ensure positive result for subtraction
                if (num1 < num2) {
                    [num1, num2] = [num2, num1];
                }
                question = `${num1} ${operation} ${num2}`;
                answer = num1 - num2;
            }
        } else {
            // Add multiplication for advanced levels
            if (rand < 0.4) {
                operation = '+';
                question = `${num1} ${operation} ${num2}`;
                answer = num1 + num2;
            } else if (rand < 0.8) {
                operation = '−';
                // Ensure positive result for subtraction
                if (num1 < num2) {
                    [num1, num2] = [num2, num1];
                }
                question = `${num1} ${operation} ${num2}`;
                answer = num1 - num2;
            } else {
                // Scale down numbers for multiplication
                num1 = Math.min(num1, 20);
                num2 = Math.min(num2, 10);
                operation = '×';
                question = `${num1} ${operation} ${num2}`;
                answer = num1 * num2;
            }
        }

        this.currentAnswer = answer;
        document.getElementById('question').textContent = question;
        document.getElementById('answerInput').value = '';
        document.getElementById('answerInput').focus();
        document.getElementById('feedback').textContent = '';
        document.getElementById('submitBtn').style.display = 'inline-block';
        document.getElementById('nextBtn').style.display = 'none';
        document.getElementById('submitBtn').disabled = false;
    }

    checkAnswer() {
        const userAnswer = parseInt(document.getElementById('answerInput').value);
        const feedback = document.getElementById('feedback');
        
        if (isNaN(userAnswer)) {
            feedback.textContent = 'Please enter a number';
            feedback.className = 'feedback incorrect';
            return;
        }

        // Calculate time taken to answer
        const endTime = new Date();
        const timeTaken = (endTime - this.questionStartTime) / 1000; // in seconds
        this.questionTimes.push(timeTaken);

        document.getElementById('submitBtn').style.display = 'none';
        document.getElementById('submitBtn').disabled = true;

        if (userAnswer === this.currentAnswer) {
            feedback.textContent = '✓ Correct! Well done!';
            feedback.className = 'feedback correct';
            this.correctAnswers++;
            
            if (this.currentQuestion < this.questionsPerRound) {
                // Auto-advance to next question after 500ms
                setTimeout(() => {
                    this.currentQuestion++;
                    this.generateQuestion();
                    this.updateStats();
                }, 500);
            } else {
                // End the round after 500ms if all questions are done
                setTimeout(() => this.endRound(), 500);
            }
        } else {
            feedback.textContent = `✗ Sorry, the answer is ${this.currentAnswer}. Starting over!`;
            feedback.className = 'feedback incorrect';
            this.wrongAnswers++;
            
            // Reset to beginning of round after 1.5 seconds
            setTimeout(() => {
                this.currentQuestion = 1;
                this.correctAnswers = 0;
                this.wrongAnswers = 0;
                this.questionTimes = [];
                this.generateQuestion();
                this.updateStats();
            }, 1500);
        }

        this.updateStats();
    }

    nextQuestion() {
        this.currentQuestion++;
        this.generateQuestion();
        this.updateStats();
    }

    endRound() {
        const wrongCount = this.wrongAnswers;
        let levelChange = 0;
        let changeMessage = '';

        if (this.correctAnswers === 10) {
            // All correct - increase difficulty
            levelChange = Math.max(1, Math.floor(this.level * 0.1));
            this.level = Math.min(100, this.level + levelChange);
            changeMessage = `🎉 Perfect score! Level increased by ${levelChange}!`;
            document.getElementById('difficultyChange').className = 'difficulty-change level-up';
        } else if (wrongCount > 2) {
            // More than 2 wrong - decrease difficulty
            levelChange = Math.max(1, Math.floor(this.level * 0.1));
            this.level = Math.max(1, this.level - levelChange);
            changeMessage = `📚 Let's try some easier questions. Level decreased by ${levelChange}.`;
            document.getElementById('difficultyChange').className = 'difficulty-change level-down';
        } else {
            // 1-2 wrong - same difficulty
            changeMessage = `👍 Good job! Staying at the same level to build confidence.`;
            document.getElementById('difficultyChange').className = 'difficulty-change level-same';
        }

        // Calculate average time per question
        const totalTime = this.questionTimes.reduce((sum, time) => sum + time, 0);
        const averageTime = totalTime / this.questionTimes.length;

        document.getElementById('roundResults').innerHTML = `
            <p>You got <strong>${this.correctAnswers} out of ${this.questionsPerRound}</strong> questions correct!</p>
            <p>Average time per question: <strong>${averageTime.toFixed(1)} seconds</strong></p>
        `;
        
        document.getElementById('difficultyChange').textContent = changeMessage;
        document.getElementById('gameArea').style.display = 'none';
        document.getElementById('roundComplete').style.display = 'block';
        
        this.updateDisplay();
        
        // Save user progress
        this.userManager.updateUserProgress(this.level, {
            correctAnswers: this.correctAnswers,
            wrongAnswers: this.wrongAnswers,
            averageTime: averageTime,
            lastPlayed: new Date().toISOString()
        });
        
        // Update statistics display
        this.updateStatistics();
    }

    startNewRound() {
        this.currentQuestion = 1;
        this.correctAnswers = 0;
        this.wrongAnswers = 0;
        this.questionTimes = [];
        this.startTime = new Date();
        
        document.getElementById('gameArea').style.display = 'block';
        document.getElementById('roundComplete').style.display = 'none';
        
        this.updateStats();
        this.generateQuestion();
    }

    updateDisplay() {
        document.getElementById('levelDisplay').textContent = this.level;
        document.getElementById('progressText').textContent = `Level ${this.level} / 100`;
        
        const progressPercent = (this.level / 100) * 100;
        document.getElementById('progressBar').style.width = `${progressPercent}%`;
        
        // Calculate age level (1 = 7 years, 100 = 12 years)
        const ageLevel = 7 + ((this.level - 1) / 99) * 5;
        document.getElementById('ageLevel').textContent = `${ageLevel.toFixed(1)} years`;
    }

    updateStats() {
        document.getElementById('questionNumber').textContent = `${this.currentQuestion} / ${this.questionsPerRound}`;
        document.getElementById('correctCount').textContent = this.correctAnswers;
        document.getElementById('wrongCount').textContent = this.wrongAnswers;
    }
    
    updateStatistics() {
        if (!this.userManager.currentUser || !this.userManager.currentUser.statistics) return;
        
        const stats = this.userManager.currentUser.statistics;
        
        // Update badges display
        if (document.getElementById('badgesContainer')) {
            const badgesContainer = document.getElementById('badgesContainer');
            badgesContainer.innerHTML = '';
            
            // Perfect round badge
            const perfectBadge = document.createElement('div');
            perfectBadge.className = `badge ${stats.badges.perfectRound ? 'earned' : ''}`;
            perfectBadge.title = 'Perfect Round: Get all questions correct in one round';
            perfectBadge.innerHTML = '🏆';
            badgesContainer.appendChild(perfectBadge);
            
            // 10 games badge
            const tenGamesBadge = document.createElement('div');
            tenGamesBadge.className = `badge ${stats.badges.tenGames ? 'earned' : ''}`;
            tenGamesBadge.title = 'Dedicated Player: Complete 10 rounds';
            tenGamesBadge.innerHTML = '🎮';
            badgesContainer.appendChild(tenGamesBadge);
            
            // Level 20 badge
            const level20Badge = document.createElement('div');
            level20Badge.className = `badge ${stats.badges.levelTwenty ? 'earned' : ''}`;
            level20Badge.title = 'Rising Star: Reach level 20';
            level20Badge.innerHTML = '⭐';
            badgesContainer.appendChild(level20Badge);
            
            // Level 50 badge
            const level50Badge = document.createElement('div');
            level50Badge.className = `badge ${stats.badges.levelFifty ? 'earned' : ''}`;
            level50Badge.title = 'Math Master: Reach level 50';
            level50Badge.innerHTML = '🔥';
            badgesContainer.appendChild(level50Badge);
        }
        
        // Update history chart if it exists
        if (document.getElementById('statsChart')) {
            const chartContainer = document.getElementById('statsChart');
            chartContainer.innerHTML = '';
            
            // Create bars for the last few games (up to 7)
            const historyToShow = stats.history.slice(0, 7);
            
            // If we have history data
            if (historyToShow.length > 0) {
                historyToShow.forEach(game => {
                    const totalQuestions = game.correct + game.wrong;
                    if (totalQuestions === 0) return;
                    
                    const correctPercent = (game.correct / totalQuestions) * 100;
                    
                    const bar = document.createElement('div');
                    bar.className = 'chart-bar';
                    bar.style.height = `${correctPercent}%`;
                    bar.title = `${game.correct} correct, ${game.wrong} wrong`;
                    
                    chartContainer.appendChild(bar);
                });
            } else {
                // Show placeholder if no history
                chartContainer.innerHTML = '<p style="text-align: center; color: #a0aec0;">Complete a round to see your progress!</p>';
            }
        }
    }
}

// Global variables and functions
let userManager;
let game;

// Login and user management functions
function showCreateUser() {
    // Removed create user function as we're using predefined users
    alert('This application uses predefined accounts only:\n- Tom (password: Tom1234)\n- Patrick (password: Patrick1234)\n- Eliza (password: Eliza1234)');
}

function cancelCreate() {
    document.getElementById('createUserForm').style.display = 'none';
    document.getElementById('userList').style.display = 'block';
    document.getElementById('usernameInput').value = '';
    document.getElementById('passwordInput').value = '';
}

function createUser() {
    // Removed as we're using predefined users
    alert('This application uses predefined accounts only');
}

function showLoginForm(username) {
    // Check if user is locked out before showing the login form
    if (userManager.isLockedOut(username)) {
        const remainingTime = userManager.getRemainingLockoutTime(username);
        const timeStr = userManager.formatLockoutTime(remainingTime);
        alert(`This account is temporarily locked due to too many incorrect password attempts. Please try again in ${timeStr}.`);
        return;
    }
    
    document.getElementById('userList').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('loginUsername').textContent = username;
    document.getElementById('loginPasswordInput').focus();
    document.getElementById('loginError').textContent = '';
}

function cancelLogin() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('userList').style.display = 'block';
    document.getElementById('loginPasswordInput').value = '';
}

function login() {
    const username = document.getElementById('usernameInput').value;
    const password = document.getElementById('passwordInput').value;
    
    const result = userManager.loginUser(username, password);
    
    if (result.success) {
        // Hide login screen, show game
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('gameScreen').style.display = 'flex';
        
        // Start game with the current user
        game = new MathGame(userManager);
    } else {
        document.getElementById('loginError').textContent = result.message;
    }
}

function logout() {
    // Save current progress before logout
    if (game) {
        userManager.updateUserProgress(game.level, {
            correctAnswers: game.correctAnswers,
            wrongAnswers: game.wrongAnswers,
            lastPlayed: new Date().toISOString()
        });
    }
    
    userManager.logoutUser();
}

// Initialize the app when the page loads
window.addEventListener('load', () => {
    userManager = new UserManager();
});

// Predefined users
const users = [
    { username: 'Tom', password: 'Tom1234' },
    { username: 'Patrick', password: 'Patrick1234' },
    { username: 'Eliza', password: 'Eliza1234' }
];

let failedAttempts = {};
let currentUser = null;
let correctStreak = 0;
let timeoutDurations = [1000, 5000, 30000, 60000, 300000, 1800000, 3600000, 86400000];

// Login functionality
function login() {
    console.log('Login function invoked');
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    // Allow blank login
    if (!username || !password) {
        console.log('Blank login allowed');
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('gameScreen').style.display = 'flex';
        startGame();
        return;
    }

    const user = users.find(u => u.username === username);
    if (!user || user.password !== password) {
        console.log('Invalid login attempt');
        handleFailedLogin(username);
        return;
    }

    console.log('Login successful');
    resetFailedAttempts(username);
    currentUser = user;
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'flex';
    startGame();
}

function handleFailedLogin(username) {
    if (!failedAttempts[username]) {
        failedAttempts[username] = { count: 0, timestamp: 0 };
    }

    failedAttempts[username].count++;
    failedAttempts[username].timestamp = Date.now();

    const attempts = failedAttempts[username].count;
    const lockoutDuration = timeoutDurations[Math.min(attempts - 1, timeoutDurations.length - 1)];

    const remainingTime = lockoutDuration - (Date.now() - failedAttempts[username].timestamp);
    const timeStr = formatTime(remainingTime);

    document.getElementById('loginError').textContent = `Invalid login. Try again in ${timeStr}.`;
}

function resetFailedAttempts(username) {
    if (failedAttempts[username]) {
        failedAttempts[username] = { count: 0, timestamp: 0 };
    }
}

function formatTime(ms) {
    if (ms < 1000) return 'less than a second';
    if (ms < 60000) return `${Math.ceil(ms / 1000)} seconds`;
    if (ms < 3600000) return `${Math.ceil(ms / 60000)} minutes`;
    if (ms < 86400000) return `${Math.ceil(ms / 3600000)} hours`;
    return `${Math.ceil(ms / 86400000)} days`;
}

// Game functionality
function startGame() {
    correctStreak = 0;
    updateProgressBar();
    generateQuestion();
    document.getElementById('submitButton').addEventListener('click', checkAnswer);
    document.getElementById('answer').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') checkAnswer();
    });
    document.getElementById('logoutButton').addEventListener('click', logout);
}

function generateQuestion() {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    const operation = '+';
    const question = `${num1} ${operation} ${num2}`;
    const answer = num1 + num2;

    document.getElementById('question').textContent = question;
    document.getElementById('question').dataset.answer = answer;
}

function updateProgressBar() {
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const progressPercentage = (correctStreak / 10) * 100;
    progressBar.style.width = `${progressPercentage}%`;
    progressText.textContent = `${correctStreak}/10`;
}

function checkAnswer() {
    const userAnswer = parseInt(document.getElementById('answer').value);
    const correctAnswer = parseInt(document.getElementById('question').dataset.answer);

    if (userAnswer === correctAnswer) {
        correctStreak++;
        updateProgressBar();

        if (correctStreak === 10) {
            document.getElementById('feedback').textContent = '🎉 You got 10 in a row correct!';
            setTimeout(() => {
                correctStreak = 0;
                updateProgressBar();
                generateQuestion();
            }, 1500);
        } else {
            document.getElementById('feedback').textContent = 'Correct!';
            setTimeout(generateQuestion, 500);
        }
    } else {
        correctStreak = 0;
        updateProgressBar();
        document.getElementById('feedback').textContent = `Wrong! The correct answer was ${correctAnswer}. Starting over.`;
        setTimeout(generateQuestion, 1500);
    }

    document.getElementById('answer').value = '';
}

function logout() {
    currentUser = null;
    document.getElementById('gameScreen').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
}

document.getElementById('loginButton').addEventListener('click', login);

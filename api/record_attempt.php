<?php
/**
 * API Endpoint: Record Question Attempt
 * Records every question attempt with timing and performance data
 */

require_once 'config.php';

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

// Validate required fields
$required_fields = ['username', 'level_number', 'question_text', 'correct_answer', 'user_answer', 'session_id', 'question_number_in_session'];
foreach ($required_fields as $field) {
    if (!isset($input[$field])) {
        http_response_code(400);
        echo json_encode(['error' => "Missing required field: $field"]);
        exit;
    }
}

try {
    $pdo = getDBConnection();
    
    // Calculate if answer is correct
    $is_correct = (int)$input['user_answer'] === (int)$input['correct_answer'];
    
    // Process response time (round to nearest 100ms if under 10 seconds)
    $response_time_ms = null;
    if (isset($input['response_time_ms']) && $input['response_time_ms'] < 10000) {
        $response_time_ms = round($input['response_time_ms'] / 100) * 100; // Round to nearest 100ms
    }
    
    // Insert question attempt
    $stmt = $pdo->prepare("
        INSERT INTO question_attempts (
            username, level_number, question_text, correct_answer, user_answer, 
            is_correct, response_time_ms, session_id, question_number_in_session
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    
    $stmt->execute([
        $input['username'],
        (int)$input['level_number'],
        $input['question_text'],
        (int)$input['correct_answer'],
        (int)$input['user_answer'],
        $is_correct,
        $response_time_ms,
        $input['session_id'],
        (int)$input['question_number_in_session']
    ]);
    
    // Update or create session record
    $session_stmt = $pdo->prepare("
        INSERT INTO game_sessions (session_id, username, start_time, level_number, total_questions, correct_answers)
        VALUES (?, ?, NOW(), ?, 1, ?)
        ON DUPLICATE KEY UPDATE
            total_questions = total_questions + 1,
            correct_answers = correct_answers + ?,
            end_time = CASE WHEN total_questions + 1 >= 20 THEN NOW() ELSE end_time END,
            session_completed = CASE WHEN total_questions + 1 >= 20 THEN TRUE ELSE session_completed END
    ");
    
    $correct_increment = $is_correct ? 1 : 0;
    $session_stmt->execute([
        $input['session_id'],
        $input['username'],
        (int)$input['level_number'],
        $correct_increment,
        $correct_increment
    ]);
    
    // Update user performance summary
    $user_stmt = $pdo->prepare("
        INSERT INTO user_performance_summary (
            username, total_questions_attempted, total_correct_answers, 
            current_level, total_sessions, first_attempt_date, last_attempt_date
        )
        VALUES (?, 1, ?, ?, 0, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
            total_questions_attempted = total_questions_attempted + 1,
            total_correct_answers = total_correct_answers + ?,
            current_level = ?,
            last_attempt_date = NOW(),
            average_accuracy = (total_correct_answers + ?) / (total_questions_attempted + 1) * 100
    ");
    
    $user_stmt->execute([
        $input['username'],
        $correct_increment,
        (int)$input['level_number'],
        $correct_increment,
        (int)$input['level_number'],
        $correct_increment
    ]);
    
    // Update session average response time if this session is complete
    if (isset($input['question_number_in_session']) && $input['question_number_in_session'] == 20) {
        $avg_stmt = $pdo->prepare("
            UPDATE game_sessions 
            SET average_response_time_ms = (
                SELECT AVG(response_time_ms) 
                FROM question_attempts 
                WHERE session_id = ? AND response_time_ms IS NOT NULL
            )
            WHERE session_id = ?
        ");
        $avg_stmt->execute([$input['session_id'], $input['session_id']]);
        
        // Update user's overall average response time
        $user_avg_stmt = $pdo->prepare("
            UPDATE user_performance_summary 
            SET average_response_time_ms = (
                SELECT AVG(response_time_ms) 
                FROM question_attempts 
                WHERE username = ? AND response_time_ms IS NOT NULL
            )
            WHERE username = ?
        ");
        $user_avg_stmt->execute([$input['username'], $input['username']]);
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Question attempt recorded successfully',
        'is_correct' => $is_correct,
        'response_time_recorded' => $response_time_ms
    ]);
    
} catch (PDOException $e) {
    error_log("Database error in record_attempt.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Failed to record attempt']);
}
?>

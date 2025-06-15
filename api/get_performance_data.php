<?php
/**
 * API Endpoint: Get Performance Data
 * Retrieves performance data for analysis and export
 */

require_once 'config.php';

// Only allow GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

try {
    $pdo = getDBConnection();
    
    // Get query parameters
    $username = $_GET['username'] ?? null;
    $limit = min((int)($_GET['limit'] ?? 100), 1000); // Max 1000 records
    $offset = (int)($_GET['offset'] ?? 0);
    $date_from = $_GET['date_from'] ?? null;
    $date_to = $_GET['date_to'] ?? null;
    
    // Build query based on parameters
    $where_conditions = [];
    $params = [];
    
    if ($username) {
        $where_conditions[] = "username = ?";
        $params[] = $username;
    }
    
    if ($date_from) {
        $where_conditions[] = "DATE(timestamp) >= ?";
        $params[] = $date_from;
    }
    
    if ($date_to) {
        $where_conditions[] = "DATE(timestamp) <= ?";
        $params[] = $date_to;
    }
    
    $where_clause = empty($where_conditions) ? '' : 'WHERE ' . implode(' AND ', $where_conditions);
    
    // Get question attempts
    $stmt = $pdo->prepare("
        SELECT 
            username,
            timestamp,
            level_number,
            question_text,
            correct_answer,
            user_answer,
            is_correct,
            response_time_ms,
            session_id,
            question_number_in_session
        FROM question_attempts 
        $where_clause
        ORDER BY timestamp DESC 
        LIMIT ? OFFSET ?
    ");
    
    $params[] = $limit;
    $params[] = $offset;
    $stmt->execute($params);
    $attempts = $stmt->fetchAll();
    
    // Get total count
    $count_stmt = $pdo->prepare("
        SELECT COUNT(*) as total 
        FROM question_attempts 
        $where_clause
    ");
    $count_stmt->execute(array_slice($params, 0, -2)); // Remove limit and offset
    $total = $count_stmt->fetch()['total'];
    
    // Get summary statistics
    $summary_stmt = $pdo->prepare("
        SELECT 
            COUNT(*) as total_questions,
            SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct_answers,
            ROUND(AVG(CASE WHEN is_correct THEN 100.0 ELSE 0.0 END), 2) as accuracy_percentage,
            AVG(CASE WHEN response_time_ms IS NOT NULL THEN response_time_ms END) as avg_response_time_ms,
            MIN(timestamp) as first_attempt,
            MAX(timestamp) as last_attempt
        FROM question_attempts 
        $where_clause
    ");
    $summary_stmt->execute(array_slice($params, 0, -2)); // Remove limit and offset
    $summary = $summary_stmt->fetch();
    
    echo json_encode([
        'success' => true,
        'data' => $attempts,
        'pagination' => [
            'total' => (int)$total,
            'limit' => $limit,
            'offset' => $offset,
            'has_more' => ($offset + $limit) < $total
        ],
        'summary' => $summary,
        'filters' => [
            'username' => $username,
            'date_from' => $date_from,
            'date_to' => $date_to
        ]
    ]);
    
} catch (PDOException $e) {
    error_log("Database error in get_performance_data.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Failed to retrieve performance data']);
}
?>

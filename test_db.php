<?php
/**
 * Database Connection Test
 * Use this to verify your database setup is working
 */

// Display errors for debugging
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

echo "<h1>Database Connection Test</h1>";

try {
    require_once 'api/config.php';
    
    echo "<p>✅ Config file loaded successfully</p>";
    
    $pdo = getDBConnection();
    echo "<p>✅ Database connection successful!</p>";
    
    // Test if tables exist
    $stmt = $pdo->query("SHOW TABLES");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    echo "<h2>📊 Database Tables:</h2>";
    if (empty($tables)) {
        echo "<p>❌ No tables found. You need to run the database_setup.sql script.</p>";
        echo "<p><strong>Next step:</strong> Go to cPanel → phpMyAdmin → Your Database → SQL tab → Copy/paste database_setup.sql → Execute</p>";
    } else {
        echo "<ul>";
        foreach ($tables as $table) {
            echo "<li>✅ $table</li>";
        }
        echo "</ul>";
        
        $required_tables = ['question_attempts', 'game_sessions', 'user_performance_summary'];
        $missing_tables = array_diff($required_tables, $tables);
        
        if (empty($missing_tables)) {
            echo "<p>✅ All required tables are present!</p>";
            
            // Test inserting a sample record
            try {
                $test_stmt = $pdo->prepare("
                    INSERT INTO question_attempts (
                        username, level_number, question_text, correct_answer, user_answer, 
                        is_correct, response_time_ms, session_id, question_number_in_session
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ");
                
                $test_stmt->execute([
                    'TestUser',
                    1,
                    '2 + 2',
                    4,
                    4,
                    true,
                    1500,
                    'test-session-' . time(),
                    1
                ]);
                
                echo "<p>✅ Test data insertion successful!</p>";
                echo "<p>🎉 <strong>Database is fully functional and ready!</strong></p>";
                
                // Clean up test data
                $pdo->exec("DELETE FROM question_attempts WHERE username = 'TestUser'");
                
            } catch (Exception $e) {
                echo "<p>❌ Test insertion failed: " . $e->getMessage() . "</p>";
            }
            
        } else {
            echo "<p>❌ Missing required tables: " . implode(', ', $missing_tables) . "</p>";
            echo "<p><strong>Next step:</strong> Run the database_setup.sql script in phpMyAdmin</p>";
        }
    }
    
} catch (Exception $e) {
    echo "<p>❌ Database connection failed: " . $e->getMessage() . "</p>";
    echo "<h2>🔧 Troubleshooting Steps:</h2>";
    echo "<ol>";
    echo "<li>Check that you've updated the database credentials in api/config.php</li>";
    echo "<li>Verify the database exists in your Bluehost cPanel</li>";
    echo "<li>Ensure the database user has proper privileges</li>";
    echo "<li>Check that the database name includes your cPanel username prefix</li>";
    echo "</ol>";
}

echo "<hr>";
echo "<h2>📋 Next Steps:</h2>";
echo "<ol>";
echo "<li><strong>If database connection failed:</strong> Update credentials in api/config.php</li>";
echo "<li><strong>If tables are missing:</strong> Run database_setup.sql in phpMyAdmin</li>";
echo "<li><strong>If everything is working:</strong> Test the game at <a href='index.html'>index.html</a></li>";
echo "<li><strong>View performance data:</strong> Check <a href='admin.html'>admin.html</a></li>";
echo "</ol>";

echo "<p><small>You can delete this test file (test_db.php) once everything is working.</small></p>";
?>

# Database Setup Guide - Performance Tracking System

## Overview
This guide will help you set up the MySQL database for comprehensive performance tracking in the Reward Maths Game.

## Prerequisites
- Bluehost hosting account with MySQL database access
- cPanel access to create databases and users

## Step 1: Create MySQL Database

### Via Bluehost cPanel:
1. Log into your Bluehost cPanel
2. Navigate to "MySQL Databases"
3. Create a new database:
   - Database Name: `rewardmaths_performance` (or your preferred name)
   - Click "Create Database"

### Create Database User:
1. In the same MySQL Databases section
2. Create a new user:
   - Username: `rewardmaths_user` (or your preferred name)
   - Password: Generate a strong password
   - Click "Create User"

### Grant Privileges:
1. In the "Add User to Database" section
2. Select your user and database
3. Grant "ALL PRIVILEGES"
4. Click "Make Changes"

## Step 2: Configure Database Connection

### Update `api/config.php`:
```php
// Database configuration - UPDATE THESE VALUES
define('DB_HOST', 'localhost');  // Usually 'localhost' on Bluehost
define('DB_NAME', 'your_cpanel_username_rewardmaths_performance');  // Your actual database name
define('DB_USER', 'your_cpanel_username_rewardmaths_user');         // Your actual username
define('DB_PASS', 'your_actual_password');                          // Your actual password
```

**Note**: Bluehost typically prefixes database and user names with your cPanel username.

## Step 3: Create Database Tables

### Option A: Via cPanel phpMyAdmin
1. Go to cPanel → phpMyAdmin
2. Select your database
3. Click "SQL" tab
4. Copy and paste the contents of `database_setup.sql`
5. Click "Go" to execute

### Option B: Via MySQL Command Line (if available)
```bash
mysql -u your_username -p your_database_name < database_setup.sql
```

## Step 4: Verify Installation

### Test Database Connection:
Create a simple test file `test_db.php`:
```php
<?php
require_once 'api/config.php';

try {
    $pdo = getDBConnection();
    echo "✅ Database connection successful!\n";
    
    // Test if tables exist
    $stmt = $pdo->query("SHOW TABLES");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    echo "📊 Tables found: " . implode(', ', $tables) . "\n";
    
    if (in_array('question_attempts', $tables)) {
        echo "✅ Performance tracking tables are ready!\n";
    }
} catch (Exception $e) {
    echo "❌ Database connection failed: " . $e->getMessage() . "\n";
}
?>
```

Run this file in your browser: `https://yourdomain.com/test_db.php`

## Step 5: Deploy Files

### Upload all files to your Bluehost account:
```
/api/config.php                 (with your database credentials)
/api/record_attempt.php         (API endpoint for recording attempts)
/api/get_performance_data.php   (API endpoint for retrieving data)
/js/performanceTracker.js       (JavaScript performance tracking)
/admin.html                     (Performance dashboard)
/database_setup.sql             (Database schema)
```

## Step 6: Test the System

### 1. Test Game Integration:
- Play the math game
- Check browser console for performance tracking logs
- Look for messages like: "Recorded: 2 + 4 = 6 (CORRECT) in 1500ms"

### 2. Test Admin Dashboard:
- Visit `https://yourdomain.com/admin.html`
- You should see the performance dashboard
- Filter by user and date range
- Export data to CSV

### 3. Verify Database Data:
Check in phpMyAdmin that data is being inserted into:
- `question_attempts` table
- `game_sessions` table  
- `user_performance_summary` table

## Database Schema Overview

### Tables Created:

#### `question_attempts`
- Records every single question attempt
- Includes timing data (rounded to nearest 100ms if under 10s)
- Tracks correctness, user answers, session grouping

#### `game_sessions`
- Summary of each 20-question session
- Tracks completion status and average response times
- Links to individual question attempts

#### `user_performance_summary`
- High-level statistics per user
- Overall accuracy, total questions, current level
- Automatically updated as users play

#### Views for Analysis:
- `performance_analysis` - Detailed view joining attempts and sessions
- `daily_performance` - Daily summary statistics per user

## Data Collected

### For Each Question Attempt:
- ✅ Username
- ✅ Exact timestamp
- ✅ Level number
- ✅ Question text (e.g., "2 + 4")
- ✅ Correct answer
- ✅ User's answer
- ✅ Whether answer was correct
- ✅ Response time (to nearest 100ms if under 10 seconds)
- ✅ Session ID (groups 20 questions together)
- ✅ Question number within session (1-20)

### Analysis Capabilities:
- Track improvement over time
- Identify difficult question types
- Monitor response speed trends
- Analyze session completion patterns
- Compare performance across users
- Export data for external analysis

## Security Considerations

### Database Security:
- Use strong passwords for database users
- Limit database user privileges to only necessary operations
- Keep database credentials secure in `config.php`

### API Security:
- APIs validate input data
- Use prepared statements to prevent SQL injection
- Error logging without exposing sensitive information

## Troubleshooting

### Common Issues:

#### "Database connection failed"
- Check database credentials in `config.php`
- Verify database and user exist in cPanel
- Ensure user has proper privileges

#### "Table doesn't exist"
- Run the `database_setup.sql` script
- Check if tables were created successfully in phpMyAdmin

#### "No data appearing"
- Check browser console for JavaScript errors
- Verify API endpoints are accessible
- Test with simple question attempts

#### Performance tracking not working:
- Check browser console for error messages
- Verify `performanceTracker.js` is loaded
- Test API endpoints directly

### Debug Steps:
1. Test database connection with `test_db.php`
2. Check browser console for JavaScript errors
3. Test API endpoints directly in browser
4. Verify data in phpMyAdmin
5. Check server error logs

## Maintenance

### Regular Tasks:
- Monitor database size growth
- Archive old data if needed (level history is limited to 50 entries per user)
- Review performance data for insights
- Backup database regularly

### Data Retention:
- Question attempts: Unlimited (monitor storage)
- Session data: Unlimited
- Level history: Limited to 50 entries per user (automatic cleanup)

## Future Enhancements

### Possible Additions:
- Real-time analytics dashboard
- Automated performance reports
- Machine learning analysis of learning patterns
- Integration with external analytics tools
- Parent/teacher reporting features

This comprehensive performance tracking system will provide valuable insights into each child's learning progress and help identify areas where they might need additional support.

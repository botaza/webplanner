<?php
// php/send-notifications.php - WebPlanner Notification Sender (Cron Job)
// PATCHED: Complete notification rules with completed event filtering and cache management

// Error reporting for debugging (disable in production)
error_reporting(E_ALL);
ini_set('display_errors', 0); // Set to 1 for debugging, 0 for production

// Set CLI mode detection
$isCli = php_sapi_name() === 'cli';

// If not CLI, require authentication (for web-triggered testing)
if (!$isCli) {
    // Simple token-based auth for web access (replace with proper auth in production)
    $authToken = $_GET['auth'] ?? $_POST['auth'] ?? '';
    $expectedToken = 'YOUR_SECRET_AUTH_TOKEN'; // ✅ Change this!
    
    if ($authToken !== $expectedToken) {
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }
    
    header('Content-Type: text/plain');
}

// ==================== CONFIGURATION ====================

// Data directory paths
$baseDir = __DIR__ . '/..';
$dataDir = $baseDir . '/data';

// Create directory if it doesn't exist
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0755, true);
}

// File paths
define('TOKENS_FILE', $dataDir . '/tokens.json');
define('EVENTS_FILE', $dataDir . '/events.json');
define('DONE_FILE', $dataDir . '/done.json');
define('NOTIFIED_FILE', $dataDir . '/notified.json');
define('CREDENTIALS_FILE', __DIR__ . '/firebase-credentials.json');

// Firebase Project ID (✅ Replace with your actual project ID)
define('FIREBASE_PROJECT_ID', 'YOUR_PROJECT_ID');

// Notification settings
define('TIMEZONE', 'Europe/Moscow'); // ✅ Set your timezone
define('DRY_RUN', false); // Set to true for testing without sending

// ==================== HELPER FUNCTIONS ====================

/**
 * Log message with timestamp
 * @param string $message
 */
function log($message) {
    $timestamp = date('Y-m-d H:i:s');
    $logLine = "[{$timestamp}] {$message}";
    echo $logLine . PHP_EOL;
    error_log($logLine);
}

/**
 * Read JSON file and return array
 * @param string $file
 * @return array
 */
function read($file) {
    if (!file_exists($file)) {
        return [];
    }
    $content = file_get_contents($file);
    if (empty($content)) {
        return [];
    }
    $data = json_decode($content, true);
    return is_array($data) ? $data : [];
}

/**
 * Write array to JSON file
 * @param string $file
 * @param array $data
 * @return bool
 */
function write($file, $data) {
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    return file_put_contents($file, $json) !== false;
}

/**
 * Get current timestamp
 * @return int
 */
function now() {
    return time();
}

/**
 * Get current datetime in configured timezone
 * @return string
 */
function nowDatetime() {
    $tz = new DateTimeZone(TIMEZONE);
    $dt = new DateTime('now', $tz);
    return $dt->format('Y-m-d H:i:s');
}

/**
 * Get today's date
 * @return string
 */
function todayDate() {
    $tz = new DateTimeZone(TIMEZONE);
    $dt = new DateTime('now', $tz);
    return $dt->format('Y-m-d');
}

/**
 * Get tomorrow's date
 * @return string
 */
function tomorrowDate() {
    $tz = new DateTimeZone(TIMEZONE);
    $dt = new DateTime('now', $tz);
    $dt->modify('+1 day');
    return $dt->format('Y-m-d');
}

/**
 * Get current hour (0-23)
 * @return int
 */
function currentHour() {
    $tz = new DateTimeZone(TIMEZONE);
    $dt = new DateTime('now', $tz);
    return (int)$dt->format('H');
}

/**
 * Get current day of week (1=Monday, 7=Sunday)
 * @return int
 */
function currentDayOfWeek() {
    $tz = new DateTimeZone(TIMEZONE);
    $dt = new DateTime('now', $tz);
    return (int)$dt->format('N');
}

/**
 * Clean old entries from notified cache (older than 7 days)
 * @param array $notified
 */
function cleanNotified(&$notified) {
    $cutoff = now() - (7 * 24 * 60 * 60); // 7 days
    $originalCount = count($notified);
    
    $notified = array_values(array_filter($notified, function($entry) use ($cutoff) {
        $parts = explode(':', $entry);
        if (count($parts) >= 2 && is_numeric($parts[0])) {
            return (int)$parts[0] > $cutoff;
        }
        return true;
    }));
    
    $removed = $originalCount - count($notified);
    if ($removed > 0) {
        log("Cleaned {$removed} old entries from notification cache");
    }
}

/**
 * Check if notification was already sent
 * @param array $notified
 * @param string $key
 * @return bool
 */
function alreadyNotified($notified, $key) {
    return in_array($key, $notified);
}

/**
 * Mark notification as sent
 * @param array $notified
 * @param string $key
 */
function markNotified(&$notified, $key) {
    $notified[] = now() . ':' . $key;
}

/**
 * ✅ PATCH: Check if event should be skipped for notifications
 * Completed events should NOT receive notifications
 * @param array $ev
 * @return bool
 */
function shouldSkipForNotifications($ev) {
    // Skip if explicitly marked as completed
    if (!empty($ev['completed']) && $ev['completed'] === true) {
        return true;
    }
    // Skip if missing critical fields
    if (empty($ev['dt']) || empty($ev['id'])) {
        return true;
    }
    return false;
}

/**
 * Format event line for notification
 * @param array $ev
 * @return string
 */
function formatEventLine($ev) {
    $parts = [];
    if (!empty($ev['desc'])) {
        $parts[] = $ev['desc'];
    }
    if (!empty($ev['place'])) {
        $parts[] = '📍 ' . $ev['place'];
    }
    if (!empty($ev['duration'])) {
        $parts[] = '⏱ ' . $ev['duration'] . ' min';
    }
    if (!empty($ev['hashtag'])) {
        $parts[] = $ev['hashtag'];
    }
    return implode(' | ', $parts) ?: '(no details)';
}

/**
 * Get OAuth access token for FCM
 * @return string|null
 */
function getOAuthToken() {
    static $accessToken = null;
    static $tokenTime = null;
    
    // Token valid for 1 hour
    if ($accessToken && $tokenTime && (now() - $tokenTime) < 3500) {
        return $accessToken;
    }
    
    if (!file_exists(CREDENTIALS_FILE)) {
        log('Firebase credentials file not found: ' . CREDENTIALS_FILE);
        return null;
    }
    
    $credentials = json_decode(file_get_contents(CREDENTIALS_FILE), true);
    if (!$credentials) {
        log('Invalid Firebase credentials');
        return null;
    }
    
    // Create JWT
    $header = json_encode(['alg' => 'RS256', 'typ' => 'JWT']);
    $iat = now();
    $payload = json_encode([
        'iss' => $credentials['client_email'],
        'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
        'aud' => 'https://oauth2.googleapis.com/token',
        'exp' => $iat + 3600,
        'iat' => $iat
    ]);
    
    $base64Header = rtrim(strtr(base64_encode($header), '+/', '-_'), '=');
    $base64Payload = rtrim(strtr(base64_encode($payload), '+/', '-_'), '=');
    
    // Sign with private key
    $signature = '';
    openssl_sign("$base64Header.$base64Payload", $signature, $credentials['private_key'], OPENSSL_ALGO_SHA256);
    $base64Signature = rtrim(strtr(base64_encode($signature), '+/', '-_'), '=');
    
    $jwt = "$base64Header.$base64Payload.$base64Signature";
    
    // Exchange JWT for access token
    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
        'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion' => $jwt
    ]));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        log("OAuth token request failed (HTTP {$httpCode})");
        return null;
    }
    
    $result = json_decode($response, true);
    if (isset($result['access_token'])) {
        $accessToken = $result['access_token'];
        $tokenTime = $iat;
        log('OAuth token obtained successfully');
        return $accessToken;
    }
    
    log('Failed to get access token: ' . ($result['error_description'] ?? 'unknown'));
    return null;
}

/**
 * Send FCM notification
 * @param string $accessToken
 * @param array $tokens
 * @param string $title
 * @param string $body
 * @param string $rule
 * @param string $eventId
 * @param string $eventDesc
 * @return bool
 */
function sendNotification($accessToken, $tokens, $title, $body, $rule, $eventId, $eventDesc) {
    if (empty($tokens)) {
        log('No tokens to send notification');
        return false;
    }
    
    if (DRY_RUN) {
        log("[DRY RUN] Would send: {$title} - {$body}");
        return true;
    }
    
    $url = "https://fcm.googleapis.com/v1/projects/" . FIREBASE_PROJECT_ID . "/messages:send";
    
    // Send to each token (in production, use batch API for efficiency)
    $successCount = 0;
    foreach ($tokens as $token) {
        $payload = [
            'message' => [
                'token' => $token,
                'notification' => [
                    'title' => $title,
                    'body' => $body
                ],
                'data' => [
                    'event_id' => $eventId,
                    'rule' => $rule,
                    'event_desc' => $eventDesc,
                    'url' => '/',
                    'timestamp' => now()
                ],
                'android' => [
                    'priority' => 'high',
                    'notification' => [
                        'click_action' => '/'
                    ]
                ],
                'apns' => [
                    'payload' => [
                        'aps' => [
                            'sound' => 'default',
                            'badge' => 1
                        ]
                    ]
                ]
            ]
        ];
        
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $accessToken
        ]);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode === 200) {
            $successCount++;
        } else {
            log("Notification failed (HTTP {$httpCode}): " . substr($response ?: 'no response', 0, 100));
        }
    }
    
    if ($successCount > 0) {
        log("Notification sent successfully to {$successCount}/" . count($tokens) . " tokens");
        return true;
    }
    
    return false;
}

/**
 * Get valid FCM tokens (excluding expired)
 * @return array
 */
function getValidTokens() {
    $tokensData = read(TOKENS_FILE);
    $validTokens = [];
    $now = now();
    
    foreach ($tokensData as $t) {
        // Skip expired tokens
        if (isset($t['expires_at']) && $t['expires_at'] < $now) {
            continue;
        }
        if (!empty($t['token'])) {
            $validTokens[] = $t['token'];
        }
    }
    
    log('Valid tokens: ' . count($validTokens));
    return $validTokens;
}

// ==================== NOTIFICATION RULES ====================

/**
 * RULE 1: 1 hour before any event
 * Sends notification 60 minutes before event starts
 */
function rule1_OneHourBefore($events, $tokens, &$notified, $accessToken) {
    log('RULE 1: Checking 1-hour-before notifications...');
    
    $now = now();
    $sent = 0;
    
    foreach ($events as $ev) {
        // ✅ PATCH: Skip completed events
        if (shouldSkipForNotifications($ev)) {
            continue;
        }
        
        $eventTime = strtotime($ev['dt']);
        if (!$eventTime) continue;
        
        $diff = $eventTime - $now;
        
        // Check if within 1 hour window (between 55 and 65 minutes)
        if ($diff <= 0 || $diff > 3900) { // 65 minutes
            continue;
        }
        
        // More precise: only send between 55-65 minutes before
        if ($diff < 3300 || $diff > 3900) {
            continue;
        }
        
        $key = '1h:' . $ev['id'];
        if (alreadyNotified($notified, $key)) {
            continue;
        }
        
        $diffMins = (int)round($diff / 60);
        $title = '⏰ Starting Soon';
        $body = formatEventLine($ev) . " — in {$diffMins} min";
        
        if (sendNotification($accessToken, $tokens, $title, $body, 'rule1_1hour', $ev['id'], $ev['desc'] ?? '')) {
            markNotified($notified, $key);
            $sent++;
        }
    }
    
    log("RULE 1: Sent {$sent} notifications");
    return $sent;
}

/**
 * RULE 2: Morning reminder (8 AM)
 * Sends summary of today's events at 8 AM
 */
function rule2_MorningReminder($events, $tokens, &$notified, $accessToken) {
    log('RULE 2: Checking morning reminder...');
    
    $hour = currentHour();
    if ($hour !== 8) {
        log('RULE 2: Not 8 AM, skipping');
        return 0;
    }
    
    $today = todayDate();
    $todayEvents = array_filter($events, function($ev) use ($today) {
        // ✅ PATCH: Skip completed events
        if (shouldSkipForNotifications($ev)) {
            return false;
        }
        return !empty($ev['dt']) && strpos($ev['dt'], $today) === 0;
    });
    
    if (empty($todayEvents)) {
        log('RULE 2: No events today');
        return 0;
    }
    
    $key = 'morning:' . $today;
    if (alreadyNotified($notified, $key)) {
        log('RULE 2: Already sent today');
        return 0;
    }
    
    $count = count($todayEvents);
    $title = '🌅 Good Morning!';
    $body = "You have {$count} event" . ($count !== 1 ? 's' : '') . " today";
    
    if (sendNotification($accessToken, $tokens, $title, $body, 'rule2_morning', 'daily_summary', $today)) {
        markNotified($notified, $key);
        log("RULE 2: Sent morning reminder for {$count} events");
        return 1;
    }
    
    return 0;
}

/**
 * RULE 3: Evening prep (8 PM)
 * Sends summary of tomorrow's events at 8 PM
 */
function rule3_EveningPrep($events, $tokens, &$notified, $accessToken) {
    log('RULE 3: Checking evening prep...');
    
    $hour = currentHour();
    if ($hour !== 20) {
        log('RULE 3: Not 8 PM, skipping');
        return 0;
    }
    
    $tomorrow = tomorrowDate();
    $tomorrowEvents = array_filter($events, function($ev) use ($tomorrow) {
        // ✅ PATCH: Skip completed events
        if (shouldSkipForNotifications($ev)) {
            return false;
        }
        return !empty($ev['dt']) && strpos($ev['dt'], $tomorrow) === 0;
    });
    
    if (empty($tomorrowEvents)) {
        log('RULE 3: No events tomorrow');
        return 0;
    }
    
    $key = 'evening:' . $tomorrow;
    if (alreadyNotified($notified, $key)) {
        log('RULE 3: Already sent today');
        return 0;
    }
    
    $count = count($tomorrowEvents);
    $title = '🌆 Tomorrow\'s Plan';
    $body = "You have {$count} event" . ($count !== 1 ? 's' : '') . " tomorrow";
    
    if (sendNotification($accessToken, $tokens, $title, $body, 'rule3_evening', 'daily_summary', $tomorrow)) {
        markNotified($notified, $key);
        log("RULE 3: Sent evening prep for {$count} events");
        return 1;
    }
    
    return 0;
}

/**
 * RULE 4: Today's events reminder (10 AM)
 * Lists all events for today
 */
function rule4_TodaysEvents($events, $tokens, &$notified, $accessToken) {
    log('RULE 4: Checking today\'s events reminder...');
    
    $hour = currentHour();
    if ($hour !== 10) {
        log('RULE 4: Not 10 AM, skipping');
        return 0;
    }
    
    $today = todayDate();
    $todayEvents = array_filter($events, function($ev) use ($today) {
        // ✅ PATCH: Skip completed events
        if (shouldSkipForNotifications($ev)) {
            return false;
        }
        return !empty($ev['dt']) && strpos($ev['dt'], $today) === 0;
    });
    
    if (empty($todayEvents)) {
        log('RULE 4: No events today');
        return 0;
    }
    
    $key = 'today:' . $today;
    if (alreadyNotified($notified, $key)) {
        log('RULE 4: Already sent today');
        return 0;
    }
    
    // Build event list
    $eventList = [];
    foreach ($todayEvents as $ev) {
        $time = substr($ev['dt'], 11, 5);
        $desc = $ev['desc'] ?? '(no description)';
        $eventList[] = "{$time} - {$desc}";
    }
    
    $title = '📅 Today\'s Schedule';
    $body = implode("\n", array_slice($eventList, 0, 5));
    if (count($eventList) > 5) {
        $body .= "\n...and " . (count($eventList) - 5) . " more";
    }
    
    if (sendNotification($accessToken, $tokens, $title, $body, 'rule4_today', 'daily_list', $today)) {
        markNotified($notified, $key);
        log("RULE 4: Sent today's events list");
        return 1;
    }
    
    return 0;
}

/**
 * RULE 5: Tomorrow preview (6 PM)
 * Detailed preview of tomorrow's events
 */
function rule5_TomorrowPreview($events, $tokens, &$notified, $accessToken) {
    log('RULE 5: Checking tomorrow preview...');
    
    $hour = currentHour();
    if ($hour !== 18) {
        log('RULE 5: Not 6 PM, skipping');
        return 0;
    }
    
    $tomorrow = tomorrowDate();
    $tomorrowEvents = array_filter($events, function($ev) use ($tomorrow) {
        // ✅ PATCH: Skip completed events
        if (shouldSkipForNotifications($ev)) {
            return false;
        }
        return !empty($ev['dt']) && strpos($ev['dt'], $tomorrow) === 0;
    });
    
    if (empty($tomorrowEvents)) {
        log('RULE 5: No events tomorrow');
        return 0;
    }
    
    $key = 'tomorrow:' . $tomorrow;
    if (alreadyNotified($notified, $key)) {
        log('RULE 5: Already sent today');
        return 0;
    }
    
    // Build event list with details
    $eventList = [];
    foreach ($tomorrowEvents as $ev) {
        $time = substr($ev['dt'], 11, 5);
        $desc = $ev['desc'] ?? '(no description)';
        $parts = ["{$time} - {$desc}"];
        if (!empty($ev['place'])) $parts[] = "  📍 {$ev['place']}";
        if (!empty($ev['duration'])) $parts[] = "  ⏱ {$ev['duration']} min";
        $eventList[] = implode("\n", $parts);
    }
    
    $title = '📆 Tomorrow\'s Preview';
    $body = implode("\n\n", array_slice($eventList, 0, 3));
    if (count($eventList) > 3) {
        $body .= "\n\n...and " . (count($eventList) - 3) . " more";
    }
    
    if (sendNotification($accessToken, $tokens, $title, $body, 'rule5_tomorrow', 'daily_preview', $tomorrow)) {
        markNotified($notified, $key);
        log("RULE 5: Sent tomorrow preview");
        return 1;
    }
    
    return 0;
}

/**
 * RULE 6: Weekly summary (Monday 9 AM)
 * Summary of upcoming week's events
 */
function rule6_WeeklySummary($events, $tokens, &$notified, $accessToken) {
    log('RULE 6: Checking weekly summary...');
    
    $hour = currentHour();
    $dayOfWeek = currentDayOfWeek();
    
    // Only send on Monday at 9 AM
    if ($dayOfWeek !== 1 || $hour !== 9) {
        log('RULE 6: Not Monday 9 AM, skipping');
        return 0;
    }
    
    $today = todayDate();
    $weekEnd = date('Y-m-d', strtotime('+6 days'));
    
    $weekEvents = array_filter($events, function($ev) use ($today, $weekEnd) {
        // ✅ PATCH: Skip completed events
        if (shouldSkipForNotifications($ev)) {
            return false;
        }
        if (empty($ev['dt'])) return false;
        $eventDate = substr($ev['dt'], 0, 10);
        return $eventDate >= $today && $eventDate <= $weekEnd;
    });
    
    if (empty($weekEvents)) {
        log('RULE 6: No events this week');
        return 0;
    }
    
    $key = 'weekly:' . $today;
    if (alreadyNotified($notified, $key)) {
        log('RULE 6: Already sent this week');
        return 0;
    }
    
    $count = count($weekEvents);
    $title = '📊 Weekly Overview';
    $body = "You have {$count} event" . ($count !== 1 ? 's' : '') . " this week";
    
    if (sendNotification($accessToken, $tokens, $title, $body, 'rule6_weekly', 'weekly_summary', $today)) {
        markNotified($notified, $key);
        log("RULE 6: Sent weekly summary for {$count} events");
        return 1;
    }
    
    return 0;
}

// ==================== MAIN EXECUTION ====================

log('========================================');
log('send-notifications.php started');
log('Current time: ' . nowDatetime());
log('Timezone: ' . TIMEZONE);
log('Dry Run: ' . (DRY_RUN ? 'YES' : 'NO'));
log('========================================');

// Load tokens
$tokens = getValidTokens();
if (empty($tokens)) {
    log('No valid tokens. Exiting.');
    exit(0);
}

// ✅ PATCH: Load events from BOTH active and done files
$activeEvents = read(EVENTS_FILE);
$doneEvents = read(DONE_FILE);

// Mark with completed flag
foreach ($activeEvents as &$e) {
    $e['completed'] = false;
}
unset($e);

foreach ($doneEvents as &$e) {
    $e['completed'] = true;
}
unset($e);

// Merge all events (completed events stay in list but won't get notifications)
$events = array_merge($activeEvents, $doneEvents);

log('Events loaded: ' . count($events) . ' (active: ' . count($activeEvents) . ', done: ' . count($doneEvents) . ')');

// Load and clean notified cache
$notified = read(NOTIFIED_FILE);
cleanNotified($notified);

// Get OAuth token
$accessToken = getOAuthToken();
if (!$accessToken) {
    log('Failed to get OAuth token. Exiting.');
    exit(1);
}

// Track if anything was sent
$anythingToDo = false;
$totalSent = 0;

// Execute all rules
$totalSent += rule1_OneHourBefore($events, $tokens, $notified, $accessToken);
$totalSent += rule2_MorningReminder($events, $tokens, $notified, $accessToken);
$totalSent += rule3_EveningPrep($events, $tokens, $notified, $accessToken);
$totalSent += rule4_TodaysEvents($events, $tokens, $notified, $accessToken);
$totalSent += rule5_TomorrowPreview($events, $tokens, $notified, $accessToken);
$totalSent += rule6_WeeklySummary($events, $tokens, $notified, $accessToken);

$anythingToDo = $totalSent > 0;

// Save notified cache
write(NOTIFIED_FILE, $notified);
log('Notification cache saved (' . count($notified) . ' entries)');

// Summary
log('========================================');
if ($anythingToDo) {
    log("Notifications sent: {$totalSent}");
} else {
    log('Nothing to notify at this time');
}
log('send-notifications.php completed');
log('========================================');

exit(0);
?>
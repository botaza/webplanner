<?php
// php/api.php - WebPlanner Main API Backend
// PATCHED: Complete event management with completion toggle, notification cache clearing, and date change handling

// Error reporting for debugging (disable in production)
error_reporting(E_ALL);
ini_set('display_errors', 0); // Set to 1 for debugging, 0 for production

// Set JSON response header
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ==================== CONFIGURATION ====================

// Data directory paths
$baseDir = __DIR__ . '/..';
$dataDir = $baseDir . '/data';
$snapDir = $baseDir . '/snapshots';

// Create directories if they don't exist
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0755, true);
}
if (!is_dir($snapDir)) {
    mkdir($snapDir, 0755, true);
}

// File paths
$files = [
    'events' => $dataDir . '/events.json',      // Active events
    'done' => $dataDir . '/done.json',          // Completed events
    'expenses' => $dataDir . '/expenses.json',
    'income' => $dataDir . '/income.json',
    'tokens' => $dataDir . '/tokens.json',      // FCM tokens
    'notified' => $dataDir . '/notified.json'   // ✅ Notification cache for deduplication
];

// Token file for FCM
define('TOKENS_FILE', $files['tokens']);
define('EVENTS_FILE', $files['events']);
define('DONE_FILE', $files['done']);
define('NOTIFIED_FILE', $files['notified']);

// ==================== HELPER FUNCTIONS ====================

/**
 * Read JSON file and return array
 * @param string $file - File path
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
 * @param string $file - File path
 * @param array $data - Data to write
 * @return bool
 */
function write($file, $data) {
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    return file_put_contents($file, $json) !== false;
}

/**
 * Generate unique ID
 * @return string
 */
function generateId() {
    return time() . '_' . bin2hex(random_bytes(4));
}

/**
 * Get current datetime string
 * @return string
 */
function nowDatetime() {
    return date('Y-m-d H:i:s');
}

/**
 * Get today's date
 * @return string
 */
function todayDate() {
    return date('Y-m-d');
}

/**
 * Get tomorrow's date
 * @return string
 */
function tomorrowDate() {
    return date('Y-m-d', strtotime('+1 day'));
}

/**
 * Clean old entries from notified cache (older than 7 days)
 * @param array $notified - Reference to notified array
 */
function cleanNotified(&$notified) {
    $cutoff = time() - (7 * 24 * 60 * 60); // 7 days ago
    $notified = array_values(array_filter($notified, function($entry) use ($cutoff) {
        // Entry format: "timestamp:key" or just "key"
        $parts = explode(':', $entry);
        if (count($parts) >= 2 && is_numeric($parts[0])) {
            return (int)$parts[0] > $cutoff;
        }
        return true; // Keep entries without timestamp
    }));
}

/**
 * Check if notification was already sent
 * @param array $notified - Notified cache array
 * @param string $key - Notification key (e.g., "1h:event123")
 * @return bool
 */
function alreadyNotified($notified, $key) {
    return in_array($key, $notified);
}

/**
 * Mark notification as sent
 * @param array $notified - Reference to notified array
 * @param string $key - Notification key
 */
function markNotified(&$notified, $key) {
    $notified[] = time() . ':' . $key;
}

/**
 * ✅ PATCH: Clear notification cache entries for a specific event ID
 * This ensures that when an event date changes or status resets,
 * the notification rules will re-evaluate for that event
 * @param string $eventId - Event ID
 */
function clearNotifiedCacheForEvent($eventId) {
    global $files;
    
    if (!file_exists($files['notified'])) {
        return;
    }
    
    $notified = read($files['notified']);
    $originalCount = count($notified);
    
    // Filter out any entries matching this event ID
    // Entry keys are like "1h:1234567890" or "rule2:1234567890:2024-01-15"
    $notified = array_values(array_filter($notified, function($entry) use ($eventId) {
        // Check if event ID appears in the entry (after the rule prefix)
        return strpos($entry, ":{$eventId}:") === false && 
               strpos($entry, ":{$eventId}") !== strlen($entry) - strlen(":{$eventId}");
    }));
    
    // Only write if something changed
    if (count($notified) !== $originalCount) {
        write($files['notified'], $notified);
        error_log("[API] Cleared " . ($originalCount - count($notified)) . " notification cache entries for event {$eventId}");
    }
}

/**
 * Format event line for notification
 * @param array $ev - Event data
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
 * ✅ PATCH: Check if event should be skipped for notifications
 * Completed events should NOT receive notifications
 * @param array $ev - Event data
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
    // Skip if date is in the past (for certain rules)
    return false;
}

/**
 * Get OAuth access token for FCM
 * @return string|null
 */
function getToken() {
    global $accessToken;
    static $accessToken = null;
    static $tokenTime = null;
    
    // Token valid for 1 hour
    if ($accessToken && $tokenTime && (time() - $tokenTime) < 3500) {
        return $accessToken;
    }
    
    // Get service account credentials
    $credentialsFile = __DIR__ . '/firebase-credentials.json';
    if (!file_exists($credentialsFile)) {
        error_log('[API] Firebase credentials file not found');
        return null;
    }
    
    $credentials = json_decode(file_get_contents($credentialsFile), true);
    if (!$credentials) {
        error_log('[API] Invalid Firebase credentials');
        return null;
    }
    
    // Create JWT
    $header = json_encode(['alg' => 'RS256', 'typ' => 'JWT']);
    $now = time();
    $payload = json_encode([
        'iss' => $credentials['client_email'],
        'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
        'aud' => 'https://oauth2.googleapis.com/token',
        'exp' => $now + 3600,
        'iat' => $now
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
    $response = curl_exec($ch);
    curl_close($ch);
    
    $result = json_decode($response, true);
    if (isset($result['access_token'])) {
        $accessToken = $result['access_token'];
        $tokenTime = $now;
        return $accessToken;
    }
    
    error_log('[API] Failed to get access token: ' . ($result['error_description'] ?? 'unknown'));
    return null;
}

/**
 * Send FCM notification
 * @param string $accessToken - OAuth access token
 * @param array $tokens - FCM tokens
 * @param string $title - Notification title
 * @param string $body - Notification body
 * @param string $rule - Rule identifier
 * @param string $eventId - Event ID
 * @param string $eventDesc - Event description
 * @return bool
 */
function notify($accessToken, $tokens, $title, $body, $rule, $eventId, $eventDesc) {
    if (empty($tokens)) {
        return false;
    }
    
    $projectId = 'YOUR_PROJECT_ID'; // ✅ Replace with your Firebase project ID
    $url = "https://fcm.googleapis.com/v1/projects/{$projectId}/messages:send";
    
    $payload = [
        'message' => [
            'token' => $tokens[0], // Send to first token (expand for multiple)
            'notification' => [
                'title' => $title,
                'body' => $body
            ],
             [
                'event_id' => $eventId,
                'rule' => $rule,
                'event_desc' => $eventDesc,
                'url' => '/',
                'timestamp' => time()
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
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode === 200) {
        error_log("[API] Notification sent successfully for event {$eventId}");
        return true;
    }
    
    error_log("[API] Notification failed (HTTP {$httpCode}): " . ($response ?: 'no response'));
    return false;
}

// ==================== API ACTION HANDLERS ====================

/**
 * Handle API request
 */
$action = $_POST['action'] ?? $_GET['action'] ?? '';

switch ($action) {
    // ==================== INITIALIZATION ====================
    
    case 'init':
        // Create all data files if they don't exist
        foreach ($files as $key => $file) {
            if (!file_exists($file)) {
                write($file, []);
            }
        }
        echo json_encode(['success' => true, 'message' => 'Initialized']);
        break;
    
    // ==================== EVENTS ====================
    
    case 'get_events':
        // ✅ PATCH: Merge active and completed events, both stay visible
        $active = read($files['events']);
        $done = read($files['done']);
        
        // Mark done events with completed: true
        foreach ($done as &$e) {
            $e['completed'] = true;
        }
        unset($e);
        
        // Mark active events with completed: false (explicit for consistency)
        foreach ($active as &$e) {
            $e['completed'] = false;
        }
        unset($e);
        
        // Merge and sort by datetime
        $all = array_merge($active, $done);
        usort($all, function($a, $b) {
            return strcmp($a['dt'] ?? '', $b['dt'] ?? '');
        });
        
        echo json_encode($all);
        break;
    
    case 'get_done_events':
        // Get only completed events (optional endpoint)
        $done = read($files['done']);
        foreach ($done as &$e) {
            $e['completed'] = true;
        }
        usort($done, function($a, $b) {
            return strcmp($a['dt'] ?? '', $b['dt'] ?? '');
        });
        echo json_encode($done);
        break;
    
    case 'add_event':
        $data = read($files['events']);
        $newEvent = [
            'id' => generateId(),
            'dt' => $_POST['dt'] ?? '',
            'desc' => $_POST['desc'] ?? '(no description)',
            'hashtag' => $_POST['hashtag'] ?? '',
            'place' => $_POST['place'] ?? '',
            'duration' => $_POST['duration'] ?? '',
            'recurrence' => $_POST['recurrence'] ?? 'none',
            'recurrence_group' => $_POST['recurrence_group'] ?? '',
            'completed' => false  // ✅ Explicit default
        ];
        $data[] = $newEvent;
        write($files['events'], $data);
        echo json_encode(['success' => true, 'event' => $newEvent]);
        break;
    
    case 'update_event':
        // ✅ PATCH: Clear notification cache if date changes
        $data = read($files['events']);
        $eventId = $_POST['id'] ?? null;
        $oldDt = null;
        $found = false;
        
        foreach ($data as &$e) {
            if ($e['id'] == $eventId) {
                $oldDt = $e['dt'] ?? null;  // ✅ Track old date
                $e['dt'] = $_POST['dt'] ?? $e['dt'];
                $e['desc'] = $_POST['desc'] ?? $e['desc'];
                $e['hashtag'] = $_POST['hashtag'] ?? $e['hashtag'];
                $e['place'] = $_POST['place'] ?? $e['place'];
                $e['duration'] = $_POST['duration'] ?? ($e['duration'] ?? '');
                $e['recurrence_group'] = $_POST['recurrence_group'] ?? ($e['recurrence_group'] ?? '');
                $e['recurrence'] = $_POST['recurrence'] ?? $e['recurrence'];
                // Preserve completed flag if present
                if (isset($_POST['completed'])) {
                    $e['completed'] = (bool)$_POST['completed'];
                }
                $found = true;
                break;
            }
        }
        unset($e);
        
        if ($found) {
            write($files['events'], $data);
            
            // ✅ If date changed, clear notification cache so rules re-evaluate
            if ($eventId && $oldDt && ($_POST['dt'] ?? null) !== $oldDt) {
                clearNotifiedCacheForEvent($eventId);
                echo json_encode(['success' => true, 'date_changed' => true, 'cache_cleared' => true]);
            } else {
                echo json_encode(['success' => true, 'date_changed' => false]);
            }
        } else {
            echo json_encode(['success' => false, 'error' => 'Event not found']);
        }
        break;
    
    case 'delete_event':
        $data = read($files['events']);
        $data = array_values(array_filter($data, function($e) {
            return $e['id'] != $_POST['id'];
        }));
        write($files['events'], $data);
        
        // Also clear notification cache for deleted event
        if ($_POST['id']) {
            clearNotifiedCacheForEvent($_POST['id']);
        }
        
        echo json_encode(['success' => true]);
        break;
    
    case 'complete_event':
        // ✅ PATCH: Toggle completion status with notification cache clearing
        $eventId = $_POST['id'] ?? null;
        if (!$eventId) {
            echo json_encode(['success' => false, 'error' => 'missing id']);
            break;
        }
        
        $active = read($files['events']);
        $done = read($files['done']);
        
        // ✅ Check if user wants to toggle to incomplete (completed: 0)
        $forceIncomplete = isset($_POST['completed']) && (int)$_POST['completed'] === 0;
        
        if ($forceIncomplete) {
            // ✅ Move from done.json back to events.json (reset to incomplete)
            $found = false;
            foreach ($done as $k => $e) {
                if ($e['id'] == $eventId) {
                    $e['completed'] = false;  // ✅ Explicit flag
                    $active[] = $e;
                    unset($done[$k]);
                    $found = true;
                    break;
                }
            }
            
            if ($found) {
                write($files['events'], array_values($active));
                write($files['done'], array_values($done));
                
                // ✅ Clear notification cache so event can receive new notifications
                clearNotifiedCacheForEvent($eventId);
                
                echo json_encode([
                    'success' => true, 
                    'action' => 'marked_incomplete',
                    'cache_cleared' => true
                ]);
            } else {
                // Already in active? Just ensure completed flag is false
                foreach ($active as &$e) {
                    if ($e['id'] == $eventId) {
                        $e['completed'] = false;
                        break;
                    }
                }
                write($files['events'], $active);
                clearNotifiedCacheForEvent($eventId);
                echo json_encode([
                    'success' => true, 
                    'action' => 'already_active',
                    'cache_cleared' => true
                ]);
            }
        } else {
            // ✅ Default behavior: mark as complete (move to done.json)
            $found = false;
            foreach ($active as $k => $e) {
                if ($e['id'] == $eventId) {
                    $e['completed'] = true;  // ✅ Add flag before moving
                    $done[] = $e;
                    unset($active[$k]);
                    $found = true;
                    break;
                }
            }
            
            if ($found) {
                write($files['events'], array_values($active));
                write($files['done'], array_values($done));
                echo json_encode(['success' => true, 'action' => 'marked_complete']);
            } else {
                echo json_encode(['success' => false, 'error' => 'Event not found']);
            }
        }
        break;
    
    // ==================== EXPENSES ====================
    
    case 'get_expenses':
        $data = read($files['expenses']);
        usort($data, function($a, $b) {
            return strcmp($b['dt'] ?? '', $a['dt'] ?? '');
        });
        echo json_encode($data);
        break;
    
    case 'add_expense':
        $data = read($files['expenses']);
        $data[] = [
            'id' => generateId(),
            'dt' => $_POST['dt'] ?? todayDate(),
            'amount' => floatval($_POST['amount'] ?? 0),
            'tool' => $_POST['tool'] ?? '',
            'category' => $_POST['category'] ?? '',
            'desc' => $_POST['desc'] ?? ''
        ];
        write($files['expenses'], $data);
        echo json_encode(['success' => true]);
        break;
    
    case 'update_expense':
        $data = read($files['expenses']);
        foreach ($data as &$e) {
            if ($e['id'] == $_POST['id']) {
                $e['dt'] = $_POST['dt'] ?? $e['dt'];
                $e['amount'] = floatval($_POST['amount'] ?? $e['amount']);
                $e['tool'] = $_POST['tool'] ?? $e['tool'];
                $e['category'] = $_POST['category'] ?? $e['category'];
                $e['desc'] = $_POST['desc'] ?? $e['desc'];
                break;
            }
        }
        write($files['expenses'], $data);
        echo json_encode(['success' => true]);
        break;
    
    case 'delete_expense':
        $data = read($files['expenses']);
        $data = array_values(array_filter($data, function($e) {
            return $e['id'] != $_POST['id'];
        }));
        write($files['expenses'], $data);
        echo json_encode(['success' => true]);
        break;
    
    // ==================== INCOME ====================
    
    case 'get_income':
        $data = read($files['income']);
        usort($data, function($a, $b) {
            return strcmp($b['dt'] ?? '', $a['dt'] ?? '');
        });
        echo json_encode($data);
        break;
    
    case 'add_income':
        $data = read($files['income']);
        $data[] = [
            'id' => generateId(),
            'dt' => $_POST['dt'] ?? todayDate(),
            'amount' => floatval($_POST['amount'] ?? 0),
            'desc' => $_POST['desc'] ?? ''
        ];
        write($files['income'], $data);
        echo json_encode(['success' => true]);
        break;
    
    case 'update_income':
        $data = read($files['income']);
        foreach ($data as &$e) {
            if ($e['id'] == $_POST['id']) {
                $e['dt'] = $_POST['dt'] ?? $e['dt'];
                $e['amount'] = floatval($_POST['amount'] ?? $e['amount']);
                $e['desc'] => $_POST['desc'] ?? $e['desc'];
                break;
            }
        }
        write($files['income'], $data);
        echo json_encode(['success' => true]);
        break;
    
    case 'delete_income':
        $data = read($files['income']);
        $data = array_values(array_filter($data, function($e) {
            return $e['id'] != $_POST['id'];
        }));
        write($files['income'], $data);
        echo json_encode(['success' => true]);
        break;
    
    // ==================== SNAPSHOTS ====================
    
    case 'create_snapshot':
        $snapshotData = [
            'events' => read($files['events']),
            'done' => read($files['done']),
            'expenses' => read($files['expenses']),
            'income' => read($files['income']),
            'created_at' => nowDatetime()
        ];
        $snapshotFile = $snapDir . '/snapshot_' . date('Ymd_His') . '.json';
        write($snapshotFile, $snapshotData);
        echo json_encode(['success' => true, 'file' => basename($snapshotFile)]);
        break;
    
    case 'get_snapshots':
        $snapshots = [];
        if (is_dir($snapDir)) {
            $files_list = scandir($snapDir);
            foreach ($files_list as $file) {
                if (strpos($file, 'snapshot_') === 0 && strpos($file, '.json') !== false) {
                    $snapshots[] = [
                        'name' => $file,
                        'created' => filemtime($snapDir . '/' . $file)
                    ];
                }
            }
        }
        usort($snapshots, function($a, $b) {
            return $b['created'] - $a['created'];
        });
        echo json_encode($snapshots);
        break;
    
    // ==================== NOTIFICATIONS ====================
    
    case 'clear_all':
        // Clear all data files (dangerous!)
        foreach ($files as $file) {
            write($file, []);
        }
        echo json_encode(['success' => true, 'message' => 'All data cleared']);
        break;
    
    case 'get_notified_cache':
        // Debug endpoint to view notification cache
        $notified = read($files['notified']);
        echo json_encode(['count' => count($notified), 'entries' => $notified]);
        break;
    
    case 'clear_notified_cache':
        // Clear notification cache (for debugging)
        write($files['notified'], []);
        echo json_encode(['success' => true, 'message' => 'Notification cache cleared']);
        break;
    
    // ==================== DEFAULT ====================
    
    default:
        echo json_encode(['success' => false, 'error' => 'Unknown action: ' . $action]);
        break;
}
?>
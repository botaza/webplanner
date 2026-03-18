<?php
// php/save-subscription.php - WebPlanner FCM Token Subscription Handler
// PATCHED: Complete token management with deduplication, expiration, and cleanup

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

// Data directory
$baseDir = __DIR__ . '/..';
$dataDir = $baseDir . '/data';

// Create directory if it doesn't exist
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0755, true);
}

// Token storage file
$tokensFile = $dataDir . '/tokens.json';

// Token expiration time (30 days in seconds)
define('TOKEN_EXPIRY', 30 * 24 * 60 * 60);

// Maximum number of tokens to store per user
define('MAX_TOKENS_PER_USER', 5);

// ==================== HELPER FUNCTIONS ====================

/**
 * Read JSON file and return array
 * @param string $file - File path
 * @return array
 */
function readTokens($file) {
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
function writeTokens($file, $data) {
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    return file_put_contents($file, $json) !== false;
}

/**
 * Generate unique user ID (for token grouping)
 * @return string
 */
function generateUserId() {
    // Use session ID or generate new one
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    
    if (!empty($_SESSION['user_id'])) {
        return $_SESSION['user_id'];
    }
    
    $userId = 'user_' . bin2hex(random_bytes(8));
    $_SESSION['user_id'] = $userId;
    return $userId;
}

/**
 * Get client identifier (IP + User Agent hash)
 * @return string
 */
function getClientIdentifier() {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
    return hash('sha256', $ip . $ua);
}

/**
 * Clean expired tokens from storage
 * @param array $tokens - Reference to tokens array
 */
function cleanExpiredTokens(&$tokens) {
    $now = time();
    $tokens = array_values(array_filter($tokens, function($token) use ($now) {
        // Keep token if no expiry set or not yet expired
        if (!isset($token['expires_at'])) {
            return true;
        }
        return $token['expires_at'] > $now;
    }));
}

/**
 * Check if token already exists
 * @param array $tokens - Tokens array
 * @param string $token - Token to check
 * @return bool
 */
function tokenExists($tokens, $token) {
    foreach ($tokens as $t) {
        if (isset($t['token']) && $t['token'] === $token) {
            return true;
        }
    }
    return false;
}

/**
 * Remove old token for same device
 * @param array $tokens - Reference to tokens array
 * @param string $clientId - Client identifier
 */
function removeOldTokenForDevice(&$tokens, $clientId) {
    $tokens = array_values(array_filter($tokens, function($token) use ($clientId) {
        return !isset($token['client_id']) || $token['client_id'] !== $clientId;
    }));
}

/**
 * Validate FCM token format
 * @param string $token - Token to validate
 * @return bool
 */
function isValidFcmToken($token) {
    if (empty($token) || !is_string($token)) {
        return false;
    }
    
    // FCM tokens are typically 150-200 characters
    if (strlen($token) < 100 || strlen($token) > 300) {
        return false;
    }
    
    // Should contain only valid characters
    if (!preg_match('/^[A-Za-z0-9\-_:.]+$/', $token)) {
        return false;
    }
    
    return true;
}

/**
 * Get token count by user
 * @param array $tokens - Tokens array
 * @param string $userId - User ID
 * @return int
 */
function getTokenCountByUser($tokens, $userId) {
    $count = 0;
    foreach ($tokens as $token) {
        if (isset($token['user_id']) && $token['user_id'] === $userId) {
            $count++;
        }
    }
    return $count;
}

/**
 * Remove oldest tokens if limit exceeded
 * @param array $tokens - Reference to tokens array
 * @param string $userId - User ID
 * @param int $maxTokens - Maximum tokens allowed
 */
function trimTokensByUser(&$tokens, $userId, $maxTokens) {
    $userTokens = array_filter($tokens, function($token) use ($userId) {
        return isset($token['user_id']) && $token['user_id'] === $userId;
    });
    
    if (count($userTokens) <= $maxTokens) {
        return;
    }
    
    // Sort by created_at descending
    usort($userTokens, function($a, $b) {
        return ($b['created_at'] ?? 0) - ($a['created_at'] ?? 0);
    });
    
    // Keep only maxTokens
    $keepTokens = array_slice($userTokens, 0, $maxTokens);
    $keepTokenValues = array_column($keepTokens, 'token');
    
    // Remove old tokens from main array
    $tokens = array_values(array_filter($tokens, function($token) use ($keepTokenValues) {
        if (!isset($token['user_id']) || $token['user_id'] !== $userId) {
            return true; // Keep tokens from other users
        }
        return in_array($token['token'], $keepTokenValues);
    }));
}

/**
 * Log token operation for debugging
 * @param string $action - Action performed
 * @param string $token - Token (masked)
 * @param string $details - Additional details
 */
function logTokenOperation($action, $token, $details = '') {
    $maskedToken = substr($token, 0, 10) . '...' . substr($token, -10);
    $logEntry = sprintf(
        "[%s] %s: token=%s, %s",
        date('Y-m-d H:i:s'),
        $action,
        $maskedToken,
        $details
    );
    error_log($logEntry);
}

// ==================== MAIN HANDLER ====================

// Get request method
$method = $_SERVER['REQUEST_METHOD'];

// Handle POST request (save token)
if ($method === 'POST') {
    // Get token from request
    $token = $_POST['token'] ?? $_POST['subscription'] ?? '';
    
    // Also check JSON body
    if (empty($token)) {
        $input = file_get_contents('php://input');
        if (!empty($input)) {
            $json = json_decode($input, true);
            $token = $json['token'] ?? $json['subscription'] ?? '';
        }
    }
    
    // Validate token
    if (empty($token)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Token is required'
        ]);
        exit;
    }
    
    if (!isValidFcmToken($token)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Invalid token format'
        ]);
        exit;
    }
    
    // Get or create user ID
    $userId = generateUserId();
    
    // Get client identifier
    $clientId = getClientIdentifier();
    
    // Load existing tokens
    $tokens = readTokens($tokensFile);
    
    // Clean expired tokens
    cleanExpiredTokens($tokens);
    
    // Check if token already exists
    if (tokenExists($tokens, $token)) {
        // Update existing token timestamp
        foreach ($tokens as &$t) {
            if ($t['token'] === $token) {
                $t['updated_at'] = time();
                $t['expires_at'] = time() + TOKEN_EXPIRY;
                break;
            }
        }
        unset($t);
        
        writeTokens($tokensFile, $tokens);
        
        logTokenOperation('UPDATE', $token, "user={$userId}");
        
        echo json_encode([
            'success' => true,
            'action' => 'updated',
            'message' => 'Token updated successfully'
        ]);
        exit;
    }
    
    // Remove old token for same device (one token per device)
    removeOldTokenForDevice($tokens, $clientId);
    
    // Check token limit for user
    if (getTokenCountByUser($tokens, $userId) >= MAX_TOKENS_PER_USER) {
        trimTokensByUser($tokens, $userId, MAX_TOKENS_PER_USER - 1);
    }
    
    // Add new token
    $tokens[] = [
        'token' => $token,
        'user_id' => $userId,
        'client_id' => $clientId,
        'created_at' => time(),
        'updated_at' => time(),
        'expires_at' => time() + TOKEN_EXPIRY,
        'platform' => $_POST['platform'] ?? 'web',
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown'
    ];
    
    // Save tokens
    if (writeTokens($tokensFile, $tokens)) {
        logTokenOperation('SAVE', $token, "user={$userId}, client={$clientId}");
        
        echo json_encode([
            'success' => true,
            'action' => 'saved',
            'message' => 'Token saved successfully',
            'token_count' => count($tokens),
            'user_token_count' => getTokenCountByUser($tokens, $userId)
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Failed to save token'
        ]);
    }
    exit;
}

// Handle GET request (get tokens for sending)
if ($method === 'GET') {
    $action = $_GET['action'] ?? 'list';
    
    if ($action === 'list') {
        // Return all valid tokens (for debugging/admin)
        $tokens = readTokens($tokensFile);
        cleanExpiredTokens($tokens);
        
        // Mask tokens for security
        $maskedTokens = array_map(function($t) {
            return [
                'user_id' => $t['user_id'] ?? 'unknown',
                'client_id' => substr($t['client_id'] ?? '', 0, 16) . '...',
                'platform' => $t['platform'] ?? 'web',
                'created_at' => date('Y-m-d H:i:s', $t['created_at'] ?? 0),
                'expires_at' => date('Y-m-d H:i:s', $t['expires_at'] ?? 0),
                'token_masked' => substr($t['token'], 0, 10) . '...' . substr($t['token'], -10)
            ];
        }, $tokens);
        
        echo json_encode([
            'success' => true,
            'count' => count($tokens),
            'tokens' => $maskedTokens
        ]);
    } elseif ($action === 'count') {
        // Return token count
        $tokens = readTokens($tokensFile);
        cleanExpiredTokens($tokens);
        
        echo json_encode([
            'success' => true,
            'count' => count($tokens),
            'unique_users' => count(array_unique(array_column($tokens, 'user_id')))
        ]);
    } elseif ($action === 'clean') {
        // Clean expired tokens
        $tokens = readTokens($tokensFile);
        $originalCount = count($tokens);
        cleanExpiredTokens($tokens);
        $newCount = count($tokens);
        
        if ($newCount < $originalCount) {
            writeTokens($tokensFile, $tokens);
        }
        
        echo json_encode([
            'success' => true,
            'original_count' => $originalCount,
            'new_count' => $newCount,
            'removed' => $originalCount - $newCount
        ]);
    } else {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Unknown action: ' . $action
        ]);
    }
    exit;
}

// Handle DELETE request (remove token)
if ($method === 'DELETE') {
    $token = $_GET['token'] ?? '';
    
    if (empty($token)) {
        $input = file_get_contents('php://input');
        if (!empty($input)) {
            $json = json_decode($input, true);
            $token = $json['token'] ?? '';
        }
    }
    
    if (empty($token)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Token is required'
        ]);
        exit;
    }
    
    $tokens = readTokens($tokensFile);
    $originalCount = count($tokens);
    
    $tokens = array_values(array_filter($tokens, function($t) use ($token) {
        return $t['token'] !== $token;
    }));
    
    if (count($tokens) < $originalCount) {
        writeTokens($tokensFile, $tokens);
        logTokenOperation('DELETE', $token, "removed from storage");
        
        echo json_encode([
            'success' => true,
            'message' => 'Token removed successfully'
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'error' => 'Token not found'
        ]);
    }
    exit;
}

// Unknown method
http_response_code(405);
echo json_encode([
    'success' => false,
    'error' => 'Method not allowed'
]);
?>
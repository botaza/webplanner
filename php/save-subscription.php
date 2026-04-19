<?php
// php/save-subscription.php
// UPDATED: Stores token objects with username, browser, last_seen, AND preserves prefs on re-registration
// PATCHED: Accepts initial prefs (incl. activeBook) from request body on first registration
// Structure: [ { token, username, browser, registered_at, last_seen, prefs }, ... ]
date_default_timezone_set('Asia/Vladivostok');
header('Content-Type: application/json');
$tokensFile = __DIR__ . '/../data/fcm-tokens.json';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}
$input = file_get_contents('php://input');
$body  = json_decode($input, true);
$token    = $body['token']    ?? null;
$username = $body['username'] ?? '';
// ✅ PATCH: Accept initial prefs from client (e.g. activeBook: 'general')
$incomingPrefs = isset($body['prefs']) && is_array($body['prefs']) ? $body['prefs'] : [];
if (!$token || !is_string($token)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid or missing FCM token']);
    exit;
}
// Detect browser from User-Agent
function detectBrowser(string $ua): string {
    if (stripos($ua, 'YaBrowser') !== false)  return 'Yandex';
    if (stripos($ua, 'Edg/')     !== false)  return 'Edge';
    if (stripos($ua, 'OPR/')     !== false)  return 'Opera';
    if (stripos($ua, 'Chrome/')  !== false)  return 'Chrome';
    if (stripos($ua, 'Firefox/') !== false)  return 'Firefox';
    if (stripos($ua, 'Safari/')  !== false)  return 'Safari';
    return 'Unknown';
}
$ua      = $_SERVER['HTTP_USER_AGENT'] ?? '';
$browser = detectBrowser($ua);
$now     = date('Y-m-d H:i:s');
// Load existing tokens
$tokens = [];
if (file_exists($tokensFile)) {
    $raw    = file_get_contents($tokensFile);
    $tokens = json_decode($raw, true) ?: [];
}
// Migrate flat array of strings → array of objects (one-time migration)
$tokens = array_map(function($t) use ($now) {
    if (is_string($t)) {
        return [
            'token'         => $t,
            'username'      => '',
            'browser'       => 'Unknown',
            'registered_at' => $now,
            'last_seen'     => $now,
            'prefs'         => ['chatOnly' => false, 'activeBook' => 'general']
        ];
    }
    // Ensure prefs exist on legacy objects
    if (!isset($t['prefs']) || !is_array($t['prefs'])) {
        $t['prefs'] = ['chatOnly' => false, 'activeBook' => 'general'];
    }
    // Backfill activeBook on tokens that predate this patch
    if (!isset($t['prefs']['activeBook'])) {
        $t['prefs']['activeBook'] = 'general';
    }
    return $t;
}, $tokens);
// Find existing entry for this token
$found = false;
foreach ($tokens as &$entry) {
    if (($entry['token'] ?? '') === $token) {
        // Update metadata on re-registration
        $entry['last_seen'] = $now;
        if ($username) $entry['username'] = $username;
        if ($browser !== 'Unknown') $entry['browser'] = $browser;
        // ✅ CRITICAL: Preserve existing prefs on re-registration — do NOT overwrite
        if (!isset($entry['prefs']) || !is_array($entry['prefs'])) {
            $entry['prefs'] = ['chatOnly' => false, 'activeBook' => 'general'];
        }
        if (!isset($entry['prefs']['activeBook'])) {
            $entry['prefs']['activeBook'] = 'general';
        }
        $found = true;
        break;
    }
}
unset($entry);
if (!$found) {
    // ✅ PATCH: Merge client-supplied prefs into defaults for new tokens
    $defaultPrefs = ['chatOnly' => false, 'activeBook' => 'general'];
    $mergedPrefs  = array_merge($defaultPrefs, $incomingPrefs);
    $tokens[] = [
        'token'         => $token,
        'username'      => $username,
        'browser'       => $browser,
        'registered_at' => $now,
        'last_seen'     => $now,
        'prefs'         => $mergedPrefs
    ];
}
$dir = dirname($tokensFile);
if (!is_dir($dir)) mkdir($dir, 0755, true);
file_put_contents($tokensFile, json_encode(array_values($tokens), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
echo json_encode(['success' => true]);
?>

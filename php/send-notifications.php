<?php
// php/send-notifications.php
// UPDATED: Added support for chatOnly token preference
// Tokens with chatOnly=true receive ONLY guestbook notifications (Rule 7)
// VERIFIED: Compatible with updated token structure (prefs array) from save-subscription.php
date_default_timezone_set('Asia/Vladivostok');
define('SERVICE_ACCOUNT_DIR', '/var/www/html/');
define('TOKENS_FILE', __DIR__ . '/../data/fcm-tokens.json');
define('EVENTS_FILE', __DIR__ . '/../data/events.json');
define('GUESTBOOKS_FILE', __DIR__ . '/../data/guestbooks.json');
define('NOTIFIED_FILE', __DIR__ . '/../data/notified-cache.json');
define('LOG_FILE', __DIR__ . '/../data/notification-log.json');
define('PROJECT_ID', 'plannernotifications-bd4b1');
define('GUESTBOOK_DEBOUNCE_SECS', 60); // 1 minute

// ── Token helpers ─────────────────────────────────────────────────────────────
function loadTokenData(): array {
    if (!file_exists(TOKENS_FILE)) return [[], []];
    $data = json_decode(file_get_contents(TOKENS_FILE), true) ?: [];
    
    // Normalize tokens to objects with prefs
    $objects = array_map(function($t) {
        if (is_string($t)) {
            // Legacy string token migration
            return [
                'token' => $t, 
                'username' => '', 
                'browser' => 'Unknown', 
                'prefs' => ['chatOnly' => false]
            ];
        }
        // Ensure prefs exist on object tokens
        if (!isset($t['prefs']) || !is_array($t['prefs'])) {
            $t['prefs'] = ['chatOnly' => false];
        }
        return $t;
    }, $data);
    
    $strings = array_column($objects, 'token');
    return [$strings, $objects];
}

// ── New helper: Filter tokens based on rule and chatOnly preference ───────────
function getTokensForRule(array $tokenObjects, string $rule): array {
    $filtered = [];
    foreach ($tokenObjects as $obj) {
        $prefs = $obj['prefs'] ?? ['chatOnly' => false];
        $chatOnly = $prefs['chatOnly'] ?? false;
        
        // If token is chatOnly, allow ONLY Rule 7 (guestbook)
        if ($chatOnly && strpos($rule, 'rule7_guestbook') === false) {
            continue;
        }
        $filtered[] = $obj['token'];
    }
    return $filtered;
}

// ── Core helpers ──────────────────────────────────────────────────────────────
function findServiceAccountFile(string $dir): ?string {
    if (!is_dir($dir)) { 
        echo date('Y-m-d H:i:s') . " Directory not found: $dir\n"; 
        return null; 
    }
    $files = glob($dir . '/*.json');
    if (empty($files)) { 
        echo date('Y-m-d H:i:s') . " No .json files found in $dir\n"; 
        return null; 
    }
    return $files[0];
}

function base64UrlEncode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function getOAuthAccessToken(string $saFile): ?string {
    if (!file_exists($saFile)) { 
        echo date('Y-m-d H:i:s') . " SA file not found: $saFile\n"; 
        return null; 
    }
    $sa = json_decode(file_get_contents($saFile), true);
    if (!$sa || empty($sa['private_key'])) { 
        echo date('Y-m-d H:i:s') . " Invalid SA JSON\n"; 
        return null; 
    }
    
    $now = time();
    $header = base64UrlEncode(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
    $payload = base64UrlEncode(json_encode([
        'iss' => $sa['client_email'], 
        'sub' => $sa['client_email'],
        'aud' => 'https://oauth2.googleapis.com/token',
        'iat' => $now, 
        'exp' => $now + 3600,
        'scope' => 'https://www.googleapis.com/auth/firebase.messaging'
    ]));
    
    $input = "$header.$payload";
    $pkey = openssl_pkey_get_private($sa['private_key']);
    
    if (!$pkey || !openssl_sign($input, $sigRaw, $pkey, OPENSSL_ALGO_SHA256)) {
        // Fallback to shell exec if openssl_sign fails
        $tmpKey = tempnam(sys_get_temp_dir(), 'pkey_');
        $tmpData = tempnam(sys_get_temp_dir(), 'jdata_');
        $tmpSig = tempnam(sys_get_temp_dir(), 'jsig_');
        file_put_contents($tmpKey, $sa['private_key']);
        file_put_contents($tmpData, $input);
        shell_exec("openssl dgst -sha256 -sign " . escapeshellarg($tmpKey) . " -out " . escapeshellarg($tmpSig) . " " . escapeshellarg($tmpData) . " 2>&1");
        $sigRaw = file_get_contents($tmpSig);
        @unlink($tmpKey); @unlink($tmpData); @unlink($tmpSig);
        
        if (!$sigRaw || strlen($sigRaw) < 64) { 
            echo date('Y-m-d H:i:s') . " JWT signing failed.\n"; 
            return null; 
        }
    }
    
    $jwt = $input . '.' . base64UrlEncode($sigRaw);
    
    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt_array($ch, [
        CURLOPT_POST => true, 
        CURLOPT_RETURNTRANSFER => true, 
        CURLOPT_TIMEOUT => 15,
        CURLOPT_POSTFIELDS => http_build_query([
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer', 
            'assertion' => $jwt
        ]),
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) { 
        echo date('Y-m-d H:i:s') . " OAuth failed (HTTP $httpCode): $response\n"; 
        return null; 
    }
    
    $data = json_decode($response, true);
    echo date('Y-m-d H:i:s') . " OAuth token obtained.\n";
    return $data['access_token'] ?? null;
}

function sendFcmV1(string $accessToken, string $deviceToken, string $title, string $body): bool {
    $url = 'https://fcm.googleapis.com/v1/projects/' . PROJECT_ID . '/messages:send';
    $payload = json_encode(['message' => [
        'token' => $deviceToken,
        'notification' => ['title' => $title, 'body' => $body],
        'webpush' => [
            'notification' => [
                'title' => $title, 
                'body' => $body,
                'icon' => '/icon-192.png', 
                'badge' => '/icon-96.png',
                'vibrate' => [200, 100, 200],
                'tag' => 'planner-' . md5($title . $body),
                'renotify' => true,
            ],
            'fcm_options' => ['link' => '/'],
        ],
    ]]);
    
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true, 
        CURLOPT_RETURNTRANSFER => true, 
        CURLOPT_TIMEOUT => 10,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $accessToken, 
            'Content-Type: application/json'
        ],
        CURLOPT_POSTFIELDS => $payload,
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        echo date('Y-m-d H:i:s') . " FCM failed (HTTP $httpCode) for token: " . substr($deviceToken, 0, 20) . "...\n";
        return false;
    }
    return true;
}

function notifyWithTokenSkip(string $accessToken, array $tokens, string $title, string $body,
    string $rule, string $eventId = '', string $eventDesc = ''): bool {
    static $badTokens = [];
    $goodTokens = [];
    $now = time();
    
    foreach ($tokens as $token) {
        if (isset($badTokens[$token]) && $badTokens[$token] > $now - 1800) continue;
        $goodTokens[] = $token;
    }
    
    if (empty($goodTokens)) {
        echo date('Y-m-d H:i:s') . " [{$rule}] All tokens bad — skipping.\n";
        logNotification($title, $body, $rule, 0, $eventId, $eventDesc, 'skipped_all_bad');
        return false;
    }
    
    $allOk = true;
    foreach ($goodTokens as $token) {
        $ok = sendFcmV1($accessToken, $token, $title, $body);
        echo date('Y-m-d H:i:s') . " [{$rule}] " . ($ok ? "OK" : "FAILED") . " → $body\n";
        if (!$ok) { 
            $badTokens[$token] = $now; 
            $allOk = false; 
        }
    }
    
    logNotification($title, $body, $rule, count($goodTokens), $eventId, $eventDesc, $allOk ? 'sent' : 'partial');
    return $allOk;
}

function notifyBatched(string $accessToken, array $tokens, string $title, array $lines,
    string $rule, int $batchSize = 20): bool {
    $batches = array_chunk($lines, $batchSize);
    $total = count($batches);
    $allOk = true;
    
    foreach ($batches as $i => $chunk) {
        $batchTitle = $total > 1 ? $title . ' (' . ($i + 1) . '/' . $total . ')' : $title;
        $ok = notifyWithTokenSkip($accessToken, $tokens, $batchTitle, implode("\n", $chunk), $rule);
        if (!$ok) $allOk = false;
    }
    return $allOk;
}

function logNotification(string $title, string $body, string $rule,
    int $tokensCount, string $eventId, string $eventDesc, string $status): void {
    $entry = [
        'id' => time() . rand(1000, 9999), 
        'dt' => date('Y-m-d H:i:s'),
        'rule' => $rule, 
        'title' => $title, 
        'body' => $body,
        'event_id' => $eventId, 
        'event_desc' => $eventDesc,
        'tokens_count' => $tokensCount, 
        'status' => $status,
    ];
    
    $all = file_exists(LOG_FILE) ? (json_decode(file_get_contents(LOG_FILE), true) ?: []) : [];
    $all[] = $entry;
    if (count($all) > 2000) $all = array_slice($all, -2000);
    
    if (file_put_contents(LOG_FILE, json_encode($all, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) === false) {
        echo date('Y-m-d H:i:s') . " ERROR: Could not write log\n";
    }
}

function alreadyNotified(array &$notified, string $key): bool { 
    return isset($notified[$key]); 
}

function markNotified(array &$notified, string $key): void { 
    $notified[$key] = time(); 
}

function cleanNotified(array &$notified): void {
    $cutoff = time() - (48 * 60 * 60);
    $notified = array_filter($notified, fn($ts) => is_int($ts) && $ts > $cutoff);
}

function isWithinTimeWindow(int $hour, int $minute = 0, int $toleranceMin = 7): bool {
    $now = time();
    $todayBase = strtotime(date('Y-m-d') . " {$hour}:{$minute}:00");
    return $now >= $todayBase && $now < ($todayBase + $toleranceMin * 60);
}

function todayDate(): string { 
    return date('Y-m-d'); 
}

function tomorrowDate(): string { 
    return date('Y-m-d', strtotime('+1 day')); 
}

function daysFromNow(string $dt): float {
    return (strtotime(explode(' ', $dt)[0]) - strtotime(todayDate())) / 86400;
}

function formatEventLine(array $ev): string {
    $time = isset($ev['dt']) ? date('H:i', strtotime($ev['dt'])) : '';
    $place = !empty($ev['place']) && $ev['place'] !== '?' ? ' @ ' . $ev['place'] : '';
    $dur = !empty($ev['duration']) && $ev['duration'] !== '?' ? ' (' . $ev['duration'] . ' min)' : '';
    return $time . ' ' . ($ev['desc'] ?? '') . $place . $dur;
}

function getEventsForNotifications(string $eventsFile): array {
    if (!file_exists($eventsFile)) return [];
    $all = json_decode(file_get_contents($eventsFile), true) ?: [];
    return array_values(array_filter($all, fn($e) => empty($e['completed']) || $e['completed'] === false));
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
echo date('Y-m-d H:i:s') . " send-notifications.php started.\n";

if (!file_exists(TOKENS_FILE)) { 
    echo date('Y-m-d H:i:s') . " No tokens. Exiting.\n"; 
    exit; 
}

[$tokens, $tokenObjects] = loadTokenData();

if (empty($tokens)) { 
    echo date('Y-m-d H:i:s') . " No tokens stored. Exiting.\n"; 
    exit; 
}

echo date('Y-m-d H:i:s') . " Tokens: " . count($tokens) . "\n";

$events = getEventsForNotifications(EVENTS_FILE);
echo date('Y-m-d H:i:s') . " Events (active only): " . count($events) . "\n";

$notified = file_exists(NOTIFIED_FILE) ? (json_decode(file_get_contents(NOTIFIED_FILE), true) ?: []) : [];
cleanNotified($notified);

$now = time();
$today = todayDate();
$tomorrow = tomorrowDate();
$accessToken = null;
$anythingToDo = false;

function getToken(): ?string {
    global $accessToken;
    if (!$accessToken) {
        $saFile = findServiceAccountFile(SERVICE_ACCOUNT_DIR);
        if (!$saFile) return null;
        $accessToken = getOAuthAccessToken($saFile);
    }
    return $accessToken;
}

// ── RULE 1: 1 hour before any event ──────────────────────────────────────────
foreach ($events as $ev) {
    if (empty($ev['dt']) || empty($ev['id'])) continue;
    $eventTime = strtotime($ev['dt']);
    $diff = $eventTime - $now;
    if ($diff <= 0 || $diff > 4020) continue;
    
    $key = '1h:' . $ev['id'];
    if (alreadyNotified($notified, $key)) continue;
    
    $anythingToDo = true;
    $diffMins = max(1, (int)round($diff / 60));
    $title = '⏰ Starting soon';
    $body = formatEventLine($ev) . ' — in ' . $diffMins . ' min';
    
    if (!getToken()) break;
    
    // ✅ RESPECTS chatOnly preference (will skip if token is chatOnly)
    $ruleTokens = getTokensForRule($tokenObjects, 'rule1_1hour');
    if (!empty($ruleTokens)) {
        notifyWithTokenSkip($accessToken, $ruleTokens, $title, $body, 'rule1_1hour', $ev['id'], $ev['desc'] ?? '');
    }
    markNotified($notified, $key);
}

// ── RULE 2: Daily 17:00 — #event hashtag upcoming events ─────────────────────
if (isWithinTimeWindow(17, 0)) {
    $key = 'daily_event:' . $today;
    if (!alreadyNotified($notified, $key)) {
        $upcoming = array_values(array_filter($events, fn($e) =>
            !empty($e['dt']) && ($e['hashtag'] ?? '') === '#event' && strtotime($e['dt']) > $now));
        usort($upcoming, fn($a, $b) => strtotime($a['dt']) - strtotime($b['dt']));
        
        if (!empty($upcoming)) {
            $anythingToDo = true;
            $lines = array_map(fn($e) => '• ' . date('D d M', strtotime($e['dt'])) . ' ' . formatEventLine($e), $upcoming);
            if (!getToken()) goto saveNotified;
            
            // ✅ RESPECTS chatOnly preference
            $ruleTokens = getTokensForRule($tokenObjects, 'rule2_event_hashtag');
            if (!empty($ruleTokens)) {
                notifyBatched($accessToken, $ruleTokens, '📅 Upcoming #event', $lines, 'rule2_event_hashtag');
            }
        } else { 
            echo date('Y-m-d H:i:s') . " [rule2] No #event events upcoming.\n"; 
        }
        markNotified($notified, $key);
    }
}

// ── RULE 3: Daily 19:00 — #control hashtag upcoming events ───────────────────
if (isWithinTimeWindow(19, 0)) {
    $key = 'daily_control:' . $today;
    if (!alreadyNotified($notified, $key)) {
        $upcoming = array_values(array_filter($events, fn($e) =>
            !empty($e['dt']) && ($e['hashtag'] ?? '') === '#control' && strtotime($e['dt']) > $now));
        usort($upcoming, fn($a, $b) => strtotime($a['dt']) - strtotime($b['dt']));
        
        if (!empty($upcoming)) {
            $anythingToDo = true;
            $lines = array_map(fn($e) => '• ' . date('D d M', strtotime($e['dt'])) . ' ' . formatEventLine($e), $upcoming);
            if (!getToken()) goto saveNotified;
            
            // ✅ RESPECTS chatOnly preference
            $ruleTokens = getTokensForRule($tokenObjects, 'rule3_control_hashtag');
            if (!empty($ruleTokens)) {
                notifyBatched($accessToken, $ruleTokens, '🎛 Upcoming #control', $lines, 'rule3_control_hashtag');
            }
        } else { 
            echo date('Y-m-d H:i:s') . " [rule3] No #control events upcoming.\n"; 
        }
        markNotified($notified, $key);
    }
}

// ── RULE 4: Daily 21:00 — #pers hashtag upcoming events ──────────────────────
if (isWithinTimeWindow(21, 0)) {
    $key = 'daily_pers:' . $today;
    if (!alreadyNotified($notified, $key)) {
        $upcoming = array_values(array_filter($events, fn($e) =>
            !empty($e['dt']) && ($e['hashtag'] ?? '') === '#pers' && strtotime($e['dt']) > $now));
        usort($upcoming, fn($a, $b) => strtotime($a['dt']) - strtotime($b['dt']));
        
        if (!empty($upcoming)) {
            $anythingToDo = true;
            $lines = array_map(fn($e) => '• ' . date('D d M', strtotime($e['dt'])) . ' ' . formatEventLine($e), $upcoming);
            if (!getToken()) goto saveNotified;
            
            // ✅ RESPECTS chatOnly preference
            $ruleTokens = getTokensForRule($tokenObjects, 'rule4_pers_hashtag');
            if (!empty($ruleTokens)) {
                notifyBatched($accessToken, $ruleTokens, '👤 Upcoming #pers', $lines, 'rule4_pers_hashtag');
            }
        } else { 
            echo date('Y-m-d H:i:s') . " [rule4] No #pers events upcoming.\n"; 
        }
        markNotified($notified, $key);
    }
}

// ── RULE 5: Daily 23:00 — all events tomorrow ────────────────────────────────
if (isWithinTimeWindow(23, 0)) {
    $key = 'tomorrow:' . $today;
    if (!alreadyNotified($notified, $key)) {
        $tomorrowEvents = array_values(array_filter($events, fn($e) =>
            !empty($e['dt']) && strpos($e['dt'], $tomorrow) === 0));
        usort($tomorrowEvents, fn($a, $b) => strtotime($a['dt']) - strtotime($b['dt']));
        
        if (!empty($tomorrowEvents)) {
            $anythingToDo = true;
            $lines = array_map(fn($e) => '• ' . formatEventLine($e), $tomorrowEvents);
            if (!getToken()) goto saveNotified;
            
            // ✅ RESPECTS chatOnly preference
            $ruleTokens = getTokensForRule($tokenObjects, 'rule5_tomorrow');
            if (!empty($ruleTokens)) {
                notifyBatched($accessToken, $ruleTokens, '📋 Tomorrow\'s events', $lines, 'rule5_tomorrow');
            }
        } else { 
            echo date('Y-m-d H:i:s') . " [rule5] No events tomorrow.\n"; 
        }
        markNotified($notified, $key);
    }
}

// ── RULE 6: Daily 08:00 — events within 3, 7, 14 days ───────────────────────
if (isWithinTimeWindow(8, 0)) {
    $key = 'horizon:' . $today;
    if (!alreadyNotified($notified, $key)) {
        $buckets = [3 => [], 7 => [], 14 => []];
        foreach ($events as $e) {
            if (empty($e['dt'])) continue;
            $days = daysFromNow($e['dt']);
            if ($days <= 0) continue;
            if ($days >= 2.5 && $days < 3.5) $buckets[3][] = $e;
            elseif ($days >= 6.5 && $days < 7.5) $buckets[7][] = $e;
            elseif ($days >= 13.5 && $days < 14.5) $buckets[14][] = $e;
        }
        
        $lines = [];
        foreach ($buckets as $horizon => $evs) {
            if (empty($evs)) continue;
            usort($evs, fn($a, $b) => strtotime($a['dt']) - strtotime($b['dt']));
            $lines[] = "📆 In {$horizon} days:";
            foreach ($evs as $e) $lines[] = ' • ' . date('D d M', strtotime($e['dt'])) . ' ' . formatEventLine($e);
        }
        
        if (!empty($lines)) {
            $anythingToDo = true;
            if (!getToken()) goto saveNotified;
            
            // ✅ RESPECTS chatOnly preference
            $ruleTokens = getTokensForRule($tokenObjects, 'rule6_horizon');
            if (!empty($ruleTokens)) {
                notifyWithTokenSkip($accessToken, $ruleTokens, '📆 Upcoming events', implode("\n", $lines), 'rule6_horizon');
            }
        } else { 
            echo date('Y-m-d H:i:s') . " [rule6] No events on day 3, 7, or 14.\n"; 
        }
        markNotified($notified, $key);
    }
}

// ── RULE 7: Guestbook — 1-min debounce, skip sender's own token ──────────────
if (file_exists(GUESTBOOKS_FILE)) {
    $guestbooks = json_decode(file_get_contents(GUESTBOOKS_FILE), true) ?: [];
    foreach ($guestbooks as $bookKey => $messages) {
        if (empty($messages)) continue;
        
        $notifiedKey   = 'guestbook_last:' . $bookKey;
        $lastNotifiedTs = isset($notified[$notifiedKey]) ? (int)$notified[$notifiedKey] : 0;
        
        $newMessages = array_filter($messages, function($m) use ($lastNotifiedTs) {
            $ts = strtotime(str_replace(' ', 'T', $m['dt'] ?? ''));
            return $ts !== false && $ts > $lastNotifiedTs;
        });
        
        if (empty($newMessages)) {
            echo date('Y-m-d H:i:s') . " [rule7] No new messages in '{$bookKey}'.\n";
            continue;
        }
        
        $newestTs = max(array_map(
            fn($m) => (int)strtotime(str_replace(' ', 'T', $m['dt'] ?? '')),
            $newMessages
        ));
        
        $ageSeconds = $now - $newestTs;
        if ($ageSeconds < GUESTBOOK_DEBOUNCE_SECS) {
            echo date('Y-m-d H:i:s') . " [rule7] '{$bookKey}' active ({$ageSeconds}s < " . GUESTBOOK_DEBOUNCE_SECS . "s). Waiting.\n";
            continue;
        }
        
        $lastSenderUsername = '';
        foreach ($newMessages as $m) {
            $ts = (int)strtotime(str_replace(' ', 'T', $m['dt'] ?? ''));
            if ($ts === $newestTs) {
                $lastSenderUsername = $m['username'] ?? '';
                break;
            }
        }
        
        $recipientTokens = [];
        foreach ($tokenObjects as $obj) {
            $objUsername = trim($obj['username'] ?? '');
            if ($objUsername !== '' && $objUsername === $lastSenderUsername) {
                echo date('Y-m-d H:i:s') . " [rule7] Skipping token for sender '{$lastSenderUsername}' ({$obj['browser']}).\n";
                continue;
            }
            $recipientTokens[] = $obj['token'];
        }
        
        if (empty($recipientTokens)) {
            echo date('Y-m-d H:i:s') . " [rule7] No recipients after sender exclusion for '{$bookKey}'.\n";
            $notified[$notifiedKey] = $newestTs;
            continue;
        }
        
        usort($newMessages, fn($a, $b) =>
            strtotime(str_replace(' ', 'T', $a['dt'])) - strtotime(str_replace(' ', 'T', $b['dt']))
        );
        $newMessages = array_values($newMessages);
        $displayMessages = array_slice($newMessages, -5);
        $hiddenCount = count($newMessages) - count($displayMessages);
        
        $bookLabel = $bookKey === 'general' ? '' : '[' . ucfirst($bookKey) . '] ';
        $lines = array_map(function($m) {
            $who   = $m['username'] ?? 'Someone';
            $emoji = !empty($m['emoji']) ? $m['emoji'] . ' ' : '';
            return $who . ': ' . $emoji . ($m['text'] ?? '');
        }, $displayMessages);
        
        if ($hiddenCount > 0) {
            array_unshift($lines, '+ ' . $hiddenCount . ' earlier message' . ($hiddenCount > 1 ? 's' : ''));
        }
        
        $msgCount = count($newMessages);
        $title    = '💬 ' . $bookLabel . ($msgCount === 1 ? '1 new message' : "{$msgCount} new messages");
        $body     = implode("\n", $lines);
        $anythingToDo = true;
        
        if (!getToken()) goto saveNotified;
        
        // ✅ RULE 7 IS ALLOWED FOR chatOnly TOKENS
        notifyWithTokenSkip($accessToken, $recipientTokens, $title, $body, 'rule7_guestbook');
        $notified[$notifiedKey] = $newestTs;
        echo date('Y-m-d H:i:s') . " [rule7] Notified '{$bookKey}', pointer → " . date('Y-m-d H:i:s', $newestTs) . "\n";
    }
}

if (!$anythingToDo) {
    echo date('Y-m-d H:i:s') . " Nothing to notify.\n";
}

saveNotified:
file_put_contents(NOTIFIED_FILE, json_encode($notified, JSON_PRETTY_PRINT));
echo date('Y-m-d H:i:s') . " Done.\n";
?>
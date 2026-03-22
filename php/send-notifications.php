<?php
// php/send-notifications.php
// PATCHED: 
// 1. Service account path is now a DIRECTORY (auto-discovers .json file)
// 2. Fixed trailing spaces in API URLs
// 3. Filter out completed events from notification logic
// 4. Fixed isWithinTimeWindow() to use real timestamps instead of broken Hi math
// 5. Widened default tolerance to 7 minutes (safe with 1-minute loop)
// 6. Rule 6 now buckets each event into exactly one horizon (no overlaps)
// 7. Rules 2-5 now mark notified unconditionally to prevent repeat fires on FCM failure
// 8. Rules 2-5 now use notifyBatched() (20 events per notification)
// 9. Rule 6 now matches events on EXACTLY day 3, 7, or 14 (not within)
date_default_timezone_set('Asia/Vladivostok'); 
// ✅ CHANGE: Define DIRECTORY only, not the full file path
define('SERVICE_ACCOUNT_DIR', '/var/www/html/'); 
define('TOKENS_FILE', __DIR__ . '/../data/fcm-tokens.json');
define('EVENTS_FILE', __DIR__ . '/../data/events.json');
define('NOTIFIED_FILE', __DIR__ . '/../data/notified-cache.json');
define('LOG_FILE', __DIR__ . '/../data/notification-log.json');
define('PROJECT_ID', 'plannernotifications-bd4b1');

/**
 * ✅ Helper: Auto-discover the service account JSON file in a directory
 */
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
    if (!file_exists($saFile)) { echo date('Y-m-d H:i:s') . " Service account file not found: $saFile\n"; return null; }
    $sa = json_decode(file_get_contents($saFile), true);
    if (!$sa || empty($sa['private_key'])) { echo date('Y-m-d H:i:s') . " Invalid service account JSON\n"; return null; }

    $now = time();
    $header = base64UrlEncode(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
    $payload = base64UrlEncode(json_encode([
        'iss' => $sa['client_email'], 'sub' => $sa['client_email'],
        'aud' => 'https://oauth2.googleapis.com/token',
        'iat' => $now, 'exp' => $now + 3600,
        'scope' => 'https://www.googleapis.com/auth/firebase.messaging'
    ]));
    $input = "$header.$payload";

    $pkey = openssl_pkey_get_private($sa['private_key']);
    if (!$pkey || !openssl_sign($input, $sigRaw, $pkey, OPENSSL_ALGO_SHA256)) {
        $tmpKey = tempnam(sys_get_temp_dir(), 'pkey_');
        $tmpData = tempnam(sys_get_temp_dir(), 'jdata_');
        $tmpSig = tempnam(sys_get_temp_dir(), 'jsig_');
        file_put_contents($tmpKey, $sa['private_key']);
        file_put_contents($tmpData, $input);
        shell_exec("openssl dgst -sha256 -sign " . escapeshellarg($tmpKey) . " -out " . escapeshellarg($tmpSig) . " " . escapeshellarg($tmpData) . " 2>&1");
        $sigRaw = file_get_contents($tmpSig);
        @unlink($tmpKey); @unlink($tmpData); @unlink($tmpSig);
        if (!$sigRaw || strlen($sigRaw) < 64) {
            echo date('Y-m-d H:i:s') . " JWT signing failed.\n"; return null;
        }
    }
    $jwt = $input . '.' . base64UrlEncode($sigRaw);

    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt_array($ch, [
        CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15,
        CURLOPT_POSTFIELDS => http_build_query([
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer', 'assertion' => $jwt,
        ]),
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($httpCode !== 200) {
        echo date('Y-m-d H:i:s') . " OAuth failed (HTTP $httpCode): $response\n"; return null;
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
                'title' => $title, 'body' => $body,
                'icon' => '/icon-192.png', 'badge' => '/icon-96.png',
                'vibrate' => [200, 100, 200], 'tag' => 'planner-' . md5($title . $body),
                'renotify' => true,
            ],
            'fcm_options' => ['link' => '/'],
        ],
    ]]);
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $accessToken, 'Content-Type: application/json'],
        CURLOPT_POSTFIELDS => $payload,
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($httpCode !== 200) {
        echo date('Y-m-d H:i:s') . " FCM failed (HTTP $httpCode): $response\n";
        return false;
    }
    return true;
}

function notify(string $accessToken, array $tokens, string $title, string $body,
    string $rule, string $eventId = '', string $eventDesc = ''): bool {
    $allOk = true;
    foreach ($tokens as $token) {
        $ok = sendFcmV1($accessToken, $token, $title, $body);
        echo date('Y-m-d H:i:s') . " [{$rule}] " . ($ok ? "OK" : "FAILED") . " → $body\n";
        if (!$ok) $allOk = false;
    }
    logNotification($title, $body, $rule, count($tokens), $eventId, $eventDesc, $allOk ? 'sent' : 'partial');
    return $allOk;
}

function notifyBatched(string $accessToken, array $tokens, string $title, array $lines,
    string $rule, int $batchSize = 20): bool {
    $batches = array_chunk($lines, $batchSize);
    $total = count($batches);
    $allOk = true;
    foreach ($batches as $i => $chunk) {
        $batchTitle = $total > 1 ? $title . ' (' . ($i + 1) . '/' . $total . ')' : $title;
        $body = implode("\n", $chunk);
        $ok = notify($accessToken, $tokens, $batchTitle, $body, $rule);
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
    $result = file_put_contents(LOG_FILE, json_encode($all, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    if ($result === false) {
        echo date('Y-m-d H:i:s') . " ERROR: Could not write log to " . LOG_FILE . "\n";
    }
}

function alreadyNotified(array &$notified, string $key): bool { return isset($notified[$key]); }
function markNotified(array &$notified, string $key): void { $notified[$key] = time(); }
function cleanNotified(array &$notified): void {
    $cutoff = time() - (48 * 60 * 60);
    $notified = array_filter($notified, fn($ts) => $ts > $cutoff);
}

// ✅ FIXED: Use real timestamps instead of broken Hi integer math
function isWithinTimeWindow(int $hour, int $minute = 0, int $toleranceMin = 7): bool {
    $now = time();
    $todayBase = strtotime(date('Y-m-d') . " {$hour}:{$minute}:00");
    return $now >= $todayBase && $now < ($todayBase + $toleranceMin * 60);
}

function todayDate(): string { return date('Y-m-d'); }
function tomorrowDate(): string { return date('Y-m-d', strtotime('+1 day')); }
function daysFromNow(string $dt): float {
    return (strtotime(explode(' ', $dt)[0]) - strtotime(todayDate())) / 86400;
}
function formatEventLine(array $ev): string {
    $time = isset($ev['dt']) ? date('H:i', strtotime($ev['dt'])) : '';
    $place = !empty($ev['place']) && $ev['place'] !== '?' ? ' @ ' . $ev['place'] : '';
    $dur = !empty($ev['duration']) && $ev['duration'] !== '?' ? ' (' . $ev['duration'] . ' min)' : '';
    return $time . ' ' . ($ev['desc'] ?? '') . $place . $dur;
}

// ✅ Filter events — exclude completed ones from notifications
function getEventsForNotifications(string $eventsFile): array {
    if (!file_exists($eventsFile)) return [];
    $all = json_decode(file_get_contents($eventsFile), true) ?: [];
    return array_values(array_filter($all, function($e) {
        return empty($e['completed']) || $e['completed'] === false;
    }));
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
echo date('Y-m-d H:i:s') . " send-notifications.php started.\n";

if (!file_exists(TOKENS_FILE)) { echo date('Y-m-d H:i:s') . " No tokens. Exiting.\n"; exit; }
$tokens = json_decode(file_get_contents(TOKENS_FILE), true) ?: [];
if (empty($tokens)) { echo date('Y-m-d H:i:s') . " No tokens stored. Exiting.\n"; exit; }
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
    $diff = strtotime($ev['dt']) - $now;
    if ($diff <= 0 || $diff > 3600) continue;

    $key = '1h:' . $ev['id'];
    if (alreadyNotified($notified, $key)) continue;

    $anythingToDo = true;
    $diffMins = (int)round($diff / 60);
    $title = '⏰ Starting soon';
    $body = formatEventLine($ev) . ' — in ' . $diffMins . ' min';

    if (!getToken()) break;
    if (notify($accessToken, $tokens, $title, $body, 'rule1_1hour', $ev['id'], $ev['desc'] ?? '')) {
        markNotified($notified, $key);
    }
}

// ── RULE 2: Daily 17:00 — #event hashtag upcoming events ─────────────────────
if (isWithinTimeWindow(17, 0)) {
    $key = 'daily_event:' . $today;
    if (!alreadyNotified($notified, $key)) {
        $upcoming = array_filter($events, fn($e) =>
            !empty($e['dt']) && ($e['hashtag'] ?? '') === '#event' && strtotime($e['dt']) > $now
        );
        usort($upcoming, fn($a, $b) => strtotime($a['dt']) - strtotime($b['dt']));
        $upcoming = array_values($upcoming);

        if (!empty($upcoming)) {
            $anythingToDo = true;
            $title = '📅 Upcoming #event';
            $lines = array_map(function($e) {
                return '• ' . date('D d M', strtotime($e['dt'])) . ' ' . formatEventLine($e);
            }, $upcoming);

            if (!getToken()) goto saveNotified;
            notifyBatched($accessToken, $tokens, $title, $lines, 'rule2_event_hashtag');
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
        $upcoming = array_filter($events, fn($e) =>
            !empty($e['dt']) && ($e['hashtag'] ?? '') === '#control' && strtotime($e['dt']) > $now
        );
        usort($upcoming, fn($a, $b) => strtotime($a['dt']) - strtotime($b['dt']));
        $upcoming = array_values($upcoming);

        if (!empty($upcoming)) {
            $anythingToDo = true;
            $title = '🎛 Upcoming #control';
            $lines = array_map(function($e) {
                return '• ' . date('D d M', strtotime($e['dt'])) . ' ' . formatEventLine($e);
            }, $upcoming);

            if (!getToken()) goto saveNotified;
            notifyBatched($accessToken, $tokens, $title, $lines, 'rule3_control_hashtag');
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
        $upcoming = array_filter($events, fn($e) =>
            !empty($e['dt']) && ($e['hashtag'] ?? '') === '#pers' && strtotime($e['dt']) > $now
        );
        usort($upcoming, fn($a, $b) => strtotime($a['dt']) - strtotime($b['dt']));
        $upcoming = array_values($upcoming);

        if (!empty($upcoming)) {
            $anythingToDo = true;
            $title = '👤 Upcoming #pers';
            $lines = array_map(function($e) {
                return '• ' . date('D d M', strtotime($e['dt'])) . ' ' . formatEventLine($e);
            }, $upcoming);

            if (!getToken()) goto saveNotified;
            notifyBatched($accessToken, $tokens, $title, $lines, 'rule4_pers_hashtag');
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
        $tomorrowEvents = array_filter($events, fn($e) =>
            !empty($e['dt']) && strpos($e['dt'], $tomorrow) === 0
        );
        usort($tomorrowEvents, fn($a, $b) => strtotime($a['dt']) - strtotime($b['dt']));
        $tomorrowEvents = array_values($tomorrowEvents);

        if (!empty($tomorrowEvents)) {
            $anythingToDo = true;
            $title = '📋 Tomorrow\'s events';
            $lines = array_map(fn($e) => '• ' . formatEventLine($e), $tomorrowEvents);

            if (!getToken()) goto saveNotified;
            notifyBatched($accessToken, $tokens, $title, $lines, 'rule5_tomorrow');
        } else {
            echo date('Y-m-d H:i:s') . " [rule5] No events tomorrow.\n";
        }
        markNotified($notified, $key);
    }
}

// ── RULE 6: Daily 08:00 — events within 3, 7, 14 days (each event in one bucket only) ──
if (isWithinTimeWindow(8, 0)) {
    $key = 'horizon:' . $today;
    if (!alreadyNotified($notified, $key)) {
        $buckets = [3 => [], 7 => [], 14 => []];

        foreach ($events as $e) {
            if (empty($e['dt'])) continue;
            $days = daysFromNow($e['dt']);
            if ($days <= 0) continue;

            // Each bucket covers a ±0.5 day window around the target
            // so every event lands in at most one bucket
            if ($days >= 2.5 && $days < 3.5)       $buckets[3][]  = $e;
            elseif ($days >= 6.5 && $days < 7.5)   $buckets[7][]  = $e;
            elseif ($days >= 13.5 && $days < 14.5) $buckets[14][] = $e;
        }

        $lines = [];
        foreach ($buckets as $horizon => $evs) {
            if (empty($evs)) continue;
            usort($evs, fn($a, $b) => strtotime($a['dt']) - strtotime($b['dt']));
            $lines[] = "📆 Within {$horizon} days:";
            foreach ($evs as $e) {
                $lines[] = '  • ' . date('D d M', strtotime($e['dt'])) . ' ' . formatEventLine($e);
            }
        }

        if (!empty($lines)) {
            $anythingToDo = true;
            $title = '📆 Upcoming events';
            $body = implode("\n", $lines);

            if (!getToken()) goto saveNotified;
            notify($accessToken, $tokens, $title, $body, 'rule6_horizon');
        } else {
            echo date('Y-m-d H:i:s') . " [rule6] No events on day 3, 7, or 14.\n";
        }
        markNotified($notified, $key);
    }
}

if (!$anythingToDo) {
    echo date('Y-m-d H:i:s') . " Nothing to notify.\n";
}

saveNotified:
file_put_contents(NOTIFIED_FILE, json_encode($notified, JSON_PRETTY_PRINT));
echo date('Y-m-d H:i:s') . " Done.\n";

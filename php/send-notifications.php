<?php
// php/send-notifications.php
//
// Notification rules:
//   1. 1 hour before any event (once per event)
//   2. Daily 17:00 — all #event hashtag events upcoming
//   3. Daily 19:00 — all #control hashtag events upcoming
//   4. Daily 21:00 — all #pers hashtag events upcoming
//   5. Daily 23:00 — all events tomorrow
//   6. Daily 08:00 — events within 3, 7, 14 days (one message each horizon)
//
// Crontab / systemd: runs every 15 minutes
// ─────────────────────────────────────────────────────────────────────────────

date_default_timezone_set('Asia/Vladivostok');

define('SERVICE_ACCOUNT_FILE', '/var/www/html/plannernotifications-bd4b1-d88ec518f480.json');
define('PROJECT_ID',           'plannernotifications-bd4b1');
define('DATA_DIR',             '/var/www/html/testingdomainru.ru/eluvpmf0091/data');
define('TOKENS_FILE',          DATA_DIR . '/fcm-tokens.json');
define('EVENTS_FILE',          DATA_DIR . '/events.json');
define('NOTIFIED_FILE',        DATA_DIR . '/notified.json');
define('LOG_FILE',             DATA_DIR . '/notification-log.json');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function base64UrlEncode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function getOAuthAccessToken(string $serviceAccountFile): ?string
{
    if (!file_exists($serviceAccountFile)) {
        echo date('Y-m-d H:i:s') . " Service account file not found.\n"; return null;
    }
    $sa = json_decode(file_get_contents($serviceAccountFile), true);
    if (!$sa || empty($sa['private_key']) || empty($sa['client_email'])) {
        echo date('Y-m-d H:i:s') . " Invalid service account JSON.\n"; return null;
    }
    $now     = time();
    $header  = base64UrlEncode(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
    $payload = base64UrlEncode(json_encode([
        'iss'   => $sa['client_email'], 'sub' => $sa['client_email'],
        'aud'   => 'https://oauth2.googleapis.com/token',
        'iat'   => $now, 'exp' => $now + 3600,
        'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
    ]));
    $input   = "$header.$payload";
    $tmpKey  = tempnam(sys_get_temp_dir(), 'pkey_');
    $tmpData = tempnam(sys_get_temp_dir(), 'jdata_');
    $tmpSig  = tempnam(sys_get_temp_dir(), 'jsig_');
    file_put_contents($tmpKey, $sa['private_key']);
    file_put_contents($tmpData, $input);
    shell_exec("openssl dgst -sha256 -sign " . escapeshellarg($tmpKey)
        . " -out " . escapeshellarg($tmpSig) . " " . escapeshellarg($tmpData) . " 2>&1");
    $sigRaw = file_get_contents($tmpSig);
    @unlink($tmpKey); @unlink($tmpData); @unlink($tmpSig);
    if (!$sigRaw || strlen($sigRaw) < 64) {
        $pkey = openssl_pkey_get_private($sa['private_key']);
        if (!$pkey || !openssl_sign($input, $sigRaw, $pkey, OPENSSL_ALGO_SHA256)) {
            echo date('Y-m-d H:i:s') . " JWT signing failed.\n"; return null;
        }
    }
    $jwt = $input . '.' . base64UrlEncode($sigRaw);
    $ch  = curl_init('https://oauth2.googleapis.com/token');
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

function sendFcmV1(string $accessToken, string $deviceToken, string $title, string $body): bool
{
    $url     = 'https://fcm.googleapis.com/v1/projects/' . PROJECT_ID . '/messages:send';
    $payload = json_encode(['message' => [
        'token'        => $deviceToken,
        'notification' => ['title' => $title, 'body' => $body],
        'webpush'      => [
            'notification' => [
                'title' => $title, 'body' => $body,
                'icon'  => '/icon-192.png', 'badge' => '/icon-96.png',
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

/**
 * Send a notification to all tokens, log it, return success bool.
 */
function notify(string $accessToken, array $tokens, string $title, string $body,
                string $rule, string $eventId = '', string $eventDesc = ''): bool
{
    $allOk = true;
    foreach ($tokens as $token) {
        $ok = sendFcmV1($accessToken, $token, $title, $body);
        echo date('Y-m-d H:i:s') . " [{$rule}] " . ($ok ? "OK" : "FAILED") . " → $body\n";
        if (!$ok) $allOk = false;
    }
    logNotification($title, $body, $rule, count($tokens), $eventId, $eventDesc, $allOk ? 'sent' : 'partial');
    return $allOk;
}

function logNotification(string $title, string $body, string $rule,
                         int $tokensCount, string $eventId, string $eventDesc, string $status): void
{
    $entry = [
        'id'           => time() . rand(1000, 9999),
        'dt'           => date('Y-m-d H:i:s'),
        'rule'         => $rule,
        'title'        => $title,
        'body'         => $body,
        'event_id'     => $eventId,
        'event_desc'   => $eventDesc,
        'tokens_count' => $tokensCount,
        'status'       => $status,
    ];
    $all = file_exists(LOG_FILE) ? (json_decode(file_get_contents(LOG_FILE), true) ?: []) : [];
    $all[] = $entry;
    if (count($all) > 2000) $all = array_slice($all, -2000);
    $result = file_put_contents(LOG_FILE, json_encode($all, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    if ($result === false) {
        echo date('Y-m-d H:i:s') . " ERROR: Could not write log to " . LOG_FILE . "\n";
    }
}

/**
 * Dedup key check — prevents the same rule+event firing more than once per day
 * (or per occurrence for the 1-hour rule).
 * Key format: "rule:event_id:date" or "rule:event_id:datetime_hour"
 */
function alreadyNotified(array &$notified, string $key): bool
{
    return isset($notified[$key]);
}

function markNotified(array &$notified, string $key): void
{
    $notified[$key] = time();
}

function cleanNotified(array &$notified): void
{
    // Keep entries for 48 hours to safely cover daily rules
    $cutoff  = time() - (48 * 60 * 60);
    $notified = array_filter($notified, fn($ts) => $ts > $cutoff);
}

// ─── Utility date helpers ─────────────────────────────────────────────────────

function isWithinTimeWindow(int $hour, int $minute = 0, int $toleranceMin = 7): bool
{
    $now        = time();
    $todayHhmm  = (int)date('Hi');
    $windowStart = $hour * 100 + $minute;
    $windowEnd   = $windowStart + $toleranceMin;
    // handle hour rollover e.g. 2357-2404
    return $todayHhmm >= $windowStart && $todayHhmm < $windowEnd;
}

function todayDate(): string { return date('Y-m-d'); }
function tomorrowDate(): string { return date('Y-m-d', strtotime('+1 day')); }

function daysFromNow(string $dt): float
{
    return (strtotime(explode(' ', $dt)[0]) - strtotime(todayDate())) / 86400;
}

function formatEventLine(array $ev): string
{
    $time = isset($ev['dt']) ? date('H:i', strtotime($ev['dt'])) : '';
    $place = !empty($ev['place']) && $ev['place'] !== '?' ? ' @ ' . $ev['place'] : '';
    $dur   = !empty($ev['duration']) && $ev['duration'] !== '?' ? ' (' . $ev['duration'] . ' min)' : '';
    return $time . ' ' . ($ev['desc'] ?? '') . $place . $dur;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

echo date('Y-m-d H:i:s') . " send-notifications.php started.\n";

// Load tokens
if (!file_exists(TOKENS_FILE)) { echo date('Y-m-d H:i:s') . " No tokens. Exiting.\n"; exit; }
$tokens = json_decode(file_get_contents(TOKENS_FILE), true) ?: [];
if (empty($tokens)) { echo date('Y-m-d H:i:s') . " No tokens stored. Exiting.\n"; exit; }
echo date('Y-m-d H:i:s') . " Tokens: " . count($tokens) . "\n";

// Load events
if (!file_exists(EVENTS_FILE)) { echo date('Y-m-d H:i:s') . " No events. Exiting.\n"; exit; }
$events = json_decode(file_get_contents(EVENTS_FILE), true) ?: [];
echo date('Y-m-d H:i:s') . " Events: " . count($events) . "\n";

// Load + clean notified cache
$notified = file_exists(NOTIFIED_FILE) ? (json_decode(file_get_contents(NOTIFIED_FILE), true) ?: []) : [];
cleanNotified($notified);

$now     = time();
$today   = todayDate();
$tomorrow = tomorrowDate();
$needsToken = false;
$accessToken = null;

// Helper to lazily get OAuth token only when first needed
function getToken(): ?string {
    global $accessToken, $needsToken;
    if (!$accessToken) {
        $accessToken = getOAuthAccessToken(SERVICE_ACCOUNT_FILE);
    }
    return $accessToken;
}

$anythingToDo = false;

// ── RULE 1: 1 hour before any event ──────────────────────────────────────────
foreach ($events as $ev) {
    if (empty($ev['dt']) || empty($ev['id'])) continue;
    $diff = strtotime($ev['dt']) - $now;
    if ($diff <= 0 || $diff > 3600) continue; // not in the next hour

    $key = '1h:' . $ev['id'];
    if (alreadyNotified($notified, $key)) continue;

    $anythingToDo = true;
    $diffMins = (int)round($diff / 60);
    $title    = '⏰ Starting soon';
    $body     = formatEventLine($ev) . ' — in ' . $diffMins . ' min';

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
        $upcoming = array_slice(array_values($upcoming), 0, 10);

        if (!empty($upcoming)) {
            $anythingToDo = true;
            $title = '📅 Upcoming #event';
            $lines = array_map(fn($e) => '• ' . date('d MMM', strtotime($e['dt'])) . ' ' . formatEventLine($e), $upcoming);
            // Format dates properly
            $lines = array_map(function($e) {
                return '• ' . date('d M', strtotime($e['dt'])) . ' ' . formatEventLine($e);
            }, $upcoming);
            $body  = implode("\n", $lines);

            if (!getToken()) goto saveNotified;
            if (notify($accessToken, $tokens, $title, $body, 'rule2_event_hashtag')) {
                markNotified($notified, $key);
            }
        } else {
            echo date('Y-m-d H:i:s') . " [rule2] No #event events upcoming.\n";
            markNotified($notified, $key); // mark so we don't re-check until tomorrow
        }
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
        $upcoming = array_slice(array_values($upcoming), 0, 10);

        if (!empty($upcoming)) {
            $anythingToDo = true;
            $title = '🎛 Upcoming #control';
            $lines = array_map(function($e) {
                return '• ' . date('d M', strtotime($e['dt'])) . ' ' . formatEventLine($e);
            }, $upcoming);
            $body  = implode("\n", $lines);

            if (!getToken()) goto saveNotified;
            if (notify($accessToken, $tokens, $title, $body, 'rule3_control_hashtag')) {
                markNotified($notified, $key);
            }
        } else {
            echo date('Y-m-d H:i:s') . " [rule3] No #control events upcoming.\n";
            markNotified($notified, $key);
        }
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
        $upcoming = array_slice(array_values($upcoming), 0, 10);

        if (!empty($upcoming)) {
            $anythingToDo = true;
            $title = '👤 Upcoming #pers';
            $lines = array_map(function($e) {
                return '• ' . date('d M', strtotime($e['dt'])) . ' ' . formatEventLine($e);
            }, $upcoming);
            $body  = implode("\n", $lines);

            if (!getToken()) goto saveNotified;
            if (notify($accessToken, $tokens, $title, $body, 'rule4_pers_hashtag')) {
                markNotified($notified, $key);
            }
        } else {
            echo date('Y-m-d H:i:s') . " [rule4] No #pers events upcoming.\n";
            markNotified($notified, $key);
        }
    }
}

// ── RULE 5: Daily 23:00 — all events tomorrow ─────────────────────────────────
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
            $body  = implode("\n", $lines);

            if (!getToken()) goto saveNotified;
            if (notify($accessToken, $tokens, $title, $body, 'rule5_tomorrow')) {
                markNotified($notified, $key);
            }
        } else {
            echo date('Y-m-d H:i:s') . " [rule5] No events tomorrow.\n";
            markNotified($notified, $key);
        }
    }
}

// ── RULE 6: Daily 08:00 — events within 3, 7, 14 days (separate messages) ────
if (isWithinTimeWindow(8, 0)) {
    foreach ([3, 7, 14] as $horizon) {
        $key = "horizon_{$horizon}d:" . $today;
        if (alreadyNotified($notified, $key)) continue;

        $horizonEvents = array_filter($events, function($e) use ($now, $horizon) {
            if (empty($e['dt'])) return false;
            $days = daysFromNow($e['dt']);
            return $days > 0 && $days <= $horizon;
        });
        usort($horizonEvents, fn($a, $b) => strtotime($a['dt']) - strtotime($b['dt']));
        $horizonEvents = array_values($horizonEvents);

        if (!empty($horizonEvents)) {
            $anythingToDo = true;
            $title = "📆 Events in {$horizon} days";
            $lines = array_map(function($e) {
                return '• ' . date('d M', strtotime($e['dt'])) . ' ' . formatEventLine($e);
            }, $horizonEvents);
            $body  = implode("\n", $lines);

            if (!getToken()) break;
            if (notify($accessToken, $tokens, $title, $body, "rule6_horizon_{$horizon}d")) {
                markNotified($notified, $key);
            }
        } else {
            echo date('Y-m-d H:i:s') . " [rule6] No events within {$horizon} days.\n";
            markNotified($notified, $key);
        }
    }
}

if (!$anythingToDo) {
    echo date('Y-m-d H:i:s') . " Nothing to notify.\n";
}

saveNotified:
file_put_contents(NOTIFIED_FILE, json_encode($notified, JSON_PRETTY_PRINT));
echo date('Y-m-d H:i:s') . " Done.\n";

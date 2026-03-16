<?php
// php/send-notifications.php
//
// Sends FCM push notifications using the modern HTTP v1 API + OAuth 2.0.
// Runs via cron every 15 minutes.
//
// Notification logic:
//   - Notifies for any event happening within the next REMIND_MINUTES minutes
//   - Tracks already-notified event IDs so each event only fires once
//   - Cleans up old notified IDs automatically (older than 24h)
//
// Crontab (every 15 min):
//   */15 * * * * php /var/www/html/php/send-notifications.php >> /var/log/planner-notif.log 2>&1
// ─────────────────────────────────────────────────────────────────────────────

date_default_timezone_set('Australia/Brisbane'); // UTC+10, no DST

define('SERVICE_ACCOUNT_FILE', '/home/youruser/secrets/planner-service-account.json');
define('PROJECT_ID',           'plannernotifications-bd4b1');
define('TOKENS_FILE',          __DIR__ . '/../data/fcm-tokens.json');
define('EVENTS_FILE',          __DIR__ . '/../data/events.json');
define('NOTIFIED_FILE',        __DIR__ . '/../data/notified.json'); // tracks sent notifications
define('REMIND_MINUTES',       60);  // notify if event is within this many minutes

// ─── 1. Load FCM tokens ───────────────────────────────────────────────────────
if (!file_exists(TOKENS_FILE)) {
    echo date('Y-m-d H:i:s') . " No tokens file found. Exiting.\n";
    exit;
}
$tokens = json_decode(file_get_contents(TOKENS_FILE), true) ?: [];
if (empty($tokens)) {
    echo date('Y-m-d H:i:s') . " No tokens stored. Exiting.\n";
    exit;
}

// ─── 2. Load already-notified event IDs ──────────────────────────────────────
$notified = file_exists(NOTIFIED_FILE)
    ? (json_decode(file_get_contents(NOTIFIED_FILE), true) ?: [])
    : [];

// Clean up entries older than 24 hours so the file doesn't grow forever
$cutoff  = time() - (24 * 60 * 60);
$notified = array_filter($notified, fn($ts) => $ts > $cutoff);

// ─── 3. Load events and find ones due soon ────────────────────────────────────
if (!file_exists(EVENTS_FILE)) {
    echo date('Y-m-d H:i:s') . " No events file found. Exiting.\n";
    exit;
}

$events = json_decode(file_get_contents(EVENTS_FILE), true) ?: [];
$now    = time();
$window = REMIND_MINUTES * 60;

// Notify for any event that:
//   - is in the future (diff > 0)
//   - is within REMIND_MINUTES from now (diff <= window)
//   - hasn't already been notified
$due = array_filter($events, function ($ev) use ($now, $window, $notified) {
    if (empty($ev['dt']) || empty($ev['id'])) return false;
    if (isset($notified[$ev['id']])) return false; // already sent

    $diff = strtotime($ev['dt']) - $now;
    return $diff > 0 && $diff <= $window;
});

if (empty($due)) {
    echo date('Y-m-d H:i:s') . " No events due for notification.\n";
    // Still save cleaned-up notified list
    file_put_contents(NOTIFIED_FILE, json_encode($notified, JSON_PRETTY_PRINT));
    exit;
}

// ─── 4. Get OAuth 2.0 access token ───────────────────────────────────────────
$accessToken = getOAuthAccessToken(SERVICE_ACCOUNT_FILE);
if (!$accessToken) {
    echo date('Y-m-d H:i:s') . " Failed to obtain OAuth access token. Exiting.\n";
    exit;
}

// ─── 5. Send notifications ────────────────────────────────────────────────────
foreach ($due as $ev) {
    $eventTime = date('H:i', strtotime($ev['dt'])); // e.g. "14:30"
    $diffMins  = (int) round((strtotime($ev['dt']) - $now) / 60);

    $title = 'Planner Reminder';
    $body  = sprintf(
        '%s at %s (in %d min)%s',
        $ev['desc'] ?? 'Upcoming event',
        $eventTime,
        $diffMins,
        !empty($ev['place']) ? ' @ ' . $ev['place'] : ''
    );

    $allOk = true;
    foreach ($tokens as $token) {
        $result = sendFcmV1($accessToken, $token, $title, $body);
        echo date('Y-m-d H:i:s') . " -> " . ($result ? "OK" : "FAILED")
            . " [{$ev['desc']}] in {$diffMins} min\n";
        if (!$result) $allOk = false;
    }

    // Mark as notified only if at least one send succeeded
    if ($allOk) {
        $notified[$ev['id']] = $now;
    }
}

// ─── 6. Save updated notified list ───────────────────────────────────────────
file_put_contents(NOTIFIED_FILE, json_encode($notified, JSON_PRETTY_PRINT));

// ─── FUNCTIONS ────────────────────────────────────────────────────────────────

function getOAuthAccessToken(string $serviceAccountFile): ?string
{
    if (!file_exists($serviceAccountFile)) {
        echo "Service account file not found: $serviceAccountFile\n";
        return null;
    }

    $sa = json_decode(file_get_contents($serviceAccountFile), true);
    if (!$sa || empty($sa['private_key']) || empty($sa['client_email'])) {
        echo "Invalid service account JSON.\n";
        return null;
    }

    $now     = time();
    $header  = base64UrlEncode(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
    $payload = base64UrlEncode(json_encode([
        'iss'   => $sa['client_email'],
        'sub'   => $sa['client_email'],
        'aud'   => 'https://oauth2.googleapis.com/token',
        'iat'   => $now,
        'exp'   => $now + 3600,
        'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
    ]));

    $signingInput = "$header.$payload";
    $privateKey   = openssl_pkey_get_private($sa['private_key']);
    if (!$privateKey) {
        echo "Failed to load private key from service account.\n";
        return null;
    }

    openssl_sign($signingInput, $signature, $privateKey, 'SHA256');
    $jwt = $signingInput . '.' . base64UrlEncode($signature);

    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POSTFIELDS     => http_build_query([
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion'  => $jwt,
        ]),
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
        CURLOPT_TIMEOUT    => 15,
    ]);

    $response = curl_exec($ch);
    $httpCode  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        echo "OAuth token exchange failed (HTTP $httpCode): $response\n";
        return null;
    }

    $data = json_decode($response, true);
    return $data['access_token'] ?? null;
}

function sendFcmV1(string $accessToken, string $deviceToken, string $title, string $body): bool
{
    $url     = 'https://fcm.googleapis.com/v1/projects/' . PROJECT_ID . '/messages:send';
    $payload = json_encode([
        'message' => [
            'token'        => $deviceToken,
            'notification' => ['title' => $title, 'body' => $body],
            'webpush'      => [
                'notification' => [
                    'title'    => $title,
                    'body'     => $body,
                    'icon'     => '/icon-192.png',
                    'badge'    => '/icon-96.png',
                    'vibrate'  => [200, 100, 200],
                    'tag'      => 'planner-notification',
                    'renotify' => true,
                ],
                'fcm_options' => ['link' => '/'],
            ],
        ],
    ]);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . $accessToken,
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_TIMEOUT    => 10,
    ]);

    $response = curl_exec($ch);
    $httpCode  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        echo "FCM send failed (HTTP $httpCode): $response\n";
        return false;
    }

    return true;
}

function base64UrlEncode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

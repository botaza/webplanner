<?php
// php/send-notifications.php
// Crontab: */15 * * * * php /var/www/html/php/send-notifications.php >> /var/log/planner-notif.log 2>&1

date_default_timezone_set('Asia/Vladivostok');

define('SERVICE_ACCOUNT_FILE', '/var/www/html/plannernotifications-bd4b1-d88ec518f480.json');
define('PROJECT_ID',           'plannernotifications-bd4b1');
define('TOKENS_FILE',          __DIR__ . '/../data/fcm-tokens.json');
define('EVENTS_FILE',          __DIR__ . '/../data/events.json');
define('NOTIFIED_FILE',        __DIR__ . '/../data/notified.json');
define('REMIND_MINUTES',       60);

// ─── FUNCTIONS ────────────────────────────────────────────────────────────────

function base64UrlEncode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

/**
 * Builds and signs a JWT using the service account private key.
 * Uses openssl_pkcs7_sign as a fallback path to avoid any openssl_sign issues.
 */
function buildJwt(array $sa): ?string
{
    $now = time();

    $headerJson  = json_encode(['alg' => 'RS256', 'typ' => 'JWT'], JSON_UNESCAPED_SLASHES);
    $payloadJson = json_encode([
        'iss'   => $sa['client_email'],
        'sub'   => $sa['client_email'],
        'aud'   => 'https://oauth2.googleapis.com/token',
        'iat'   => $now,
        'exp'   => $now + 3600,
        'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
    ], JSON_UNESCAPED_SLASHES);

    $header  = base64UrlEncode($headerJson);
    $payload = base64UrlEncode($payloadJson);
    $input   = "$header.$payload";

    // Write private key to a temp file for signing
    $tmpKey = tempnam(sys_get_temp_dir(), 'pkey_');
    file_put_contents($tmpKey, $sa['private_key']);

    // Write data to sign to a temp file
    $tmpData = tempnam(sys_get_temp_dir(), 'jdata_');
    file_put_contents($tmpData, $input);

    // Output file for signature
    $tmpSig = tempnam(sys_get_temp_dir(), 'jsig_');

    // Use openssl CLI directly — completely bypasses PHP openssl extension quirks
    $cmd    = "openssl dgst -sha256 -sign " . escapeshellarg($tmpKey)
            . " -out " . escapeshellarg($tmpSig)
            . " " . escapeshellarg($tmpData)
            . " 2>&1";
    $output = shell_exec($cmd);
    $sigRaw = file_get_contents($tmpSig);

    // Clean up temp files
    @unlink($tmpKey);
    @unlink($tmpData);
    @unlink($tmpSig);

    if (!$sigRaw || strlen($sigRaw) < 64) {
        echo date('Y-m-d H:i:s') . " openssl CLI signing failed: $output\n";
        // Fall back to PHP openssl extension
        $sigRaw = null;
        $pkey   = openssl_pkey_get_private($sa['private_key']);
        if ($pkey && openssl_sign($input, $sig, $pkey, OPENSSL_ALGO_SHA256)) {
            $sigRaw = $sig;
            echo date('Y-m-d H:i:s') . " Used PHP openssl fallback.\n";
        } else {
            echo date('Y-m-d H:i:s') . " Both signing methods failed.\n";
            return null;
        }
    }

    return $input . '.' . base64UrlEncode($sigRaw);
}

function getOAuthAccessToken(string $serviceAccountFile): ?string
{
    if (!file_exists($serviceAccountFile)) {
        echo date('Y-m-d H:i:s') . " Service account file not found: $serviceAccountFile\n";
        return null;
    }

    $sa = json_decode(file_get_contents($serviceAccountFile), true);
    if (!$sa || empty($sa['private_key']) || empty($sa['client_email'])) {
        echo date('Y-m-d H:i:s') . " Invalid service account JSON.\n";
        return null;
    }

    $jwt = buildJwt($sa);
    if (!$jwt) {
        echo date('Y-m-d H:i:s') . " Failed to build JWT.\n";
        return null;
    }

    echo date('Y-m-d H:i:s') . " JWT built. Requesting OAuth token...\n";

    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POSTFIELDS     => http_build_query([
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion'  => $jwt,
        ]),
        CURLOPT_HTTPHEADER     => ['Content-Type: application/x-www-form-urlencoded'],
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);

    $response  = curl_exec($ch);
    $httpCode  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        echo date('Y-m-d H:i:s') . " cURL error: $curlError\n";
        return null;
    }

    if ($httpCode !== 200) {
        echo date('Y-m-d H:i:s') . " OAuth failed (HTTP $httpCode): $response\n";
        return null;
    }

    $data = json_decode($response, true);
    if (empty($data['access_token'])) {
        echo date('Y-m-d H:i:s') . " No access_token in response: $response\n";
        return null;
    }

    echo date('Y-m-d H:i:s') . " OAuth token obtained successfully.\n";
    return $data['access_token'];
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
        echo date('Y-m-d H:i:s') . " FCM send failed (HTTP $httpCode): $response\n";
        return false;
    }

    return true;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

echo date('Y-m-d H:i:s') . " send-notifications.php started.\n";

// 1. Load tokens
if (!file_exists(TOKENS_FILE)) {
    echo date('Y-m-d H:i:s') . " No tokens file found. Exiting.\n";
    exit;
}
$tokens = json_decode(file_get_contents(TOKENS_FILE), true) ?: [];
if (empty($tokens)) {
    echo date('Y-m-d H:i:s') . " No tokens stored. Exiting.\n";
    exit;
}
echo date('Y-m-d H:i:s') . " Tokens loaded: " . count($tokens) . "\n";

// 2. Load notified cache
$notified = file_exists(NOTIFIED_FILE)
    ? (json_decode(file_get_contents(NOTIFIED_FILE), true) ?: [])
    : [];
$cutoff   = time() - (24 * 60 * 60);
$notified = array_filter($notified, fn($ts) => $ts > $cutoff);

// 3. Load events
if (!file_exists(EVENTS_FILE)) {
    echo date('Y-m-d H:i:s') . " No events file found. Exiting.\n";
    exit;
}
$events = json_decode(file_get_contents(EVENTS_FILE), true) ?: [];
echo date('Y-m-d H:i:s') . " Events loaded: " . count($events) . "\n";

$now    = time();
$window = REMIND_MINUTES * 60;

$due = array_filter($events, function ($ev) use ($now, $window, $notified) {
    if (empty($ev['dt']) || empty($ev['id'])) return false;
    if (isset($notified[$ev['id']])) return false;
    $diff = strtotime($ev['dt']) - $now;
    return $diff > 0 && $diff <= $window;
});

echo date('Y-m-d H:i:s') . " Events due: " . count($due) . "\n";

if (empty($due)) {
    echo date('Y-m-d H:i:s') . " No events due for notification.\n";
    file_put_contents(NOTIFIED_FILE, json_encode($notified, JSON_PRETTY_PRINT));
    exit;
}

// 4. Get OAuth token
$accessToken = getOAuthAccessToken(SERVICE_ACCOUNT_FILE);
if (!$accessToken) {
    exit;
}

// 5. Send notifications
foreach ($due as $ev) {
    $diffMins  = (int) round((strtotime($ev['dt']) - $now) / 60);
    $eventTime = date('H:i', strtotime($ev['dt']));
    $title     = 'Planner Reminder';
    $body      = sprintf(
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

    if ($allOk) {
        $notified[$ev['id']] = $now;
    }
}

// 6. Save notified cache
file_put_contents(NOTIFIED_FILE, json_encode($notified, JSON_PRETTY_PRINT));
echo date('Y-m-d H:i:s') . " Done.\n";

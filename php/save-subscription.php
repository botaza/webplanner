<?php
// php/save-subscription.php
// Receives an FCM token from the browser and stores it in data/fcm-tokens.json

header('Content-Type: application/json');

$tokensFile = __DIR__ . '/../data/fcm-tokens.json';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = file_get_contents('php://input');
$body  = json_decode($input, true);
$token = $body['token'] ?? null;

if (!$token || !is_string($token)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid or missing FCM token']);
    exit;
}

// Load existing tokens
$tokens = [];
if (file_exists($tokensFile)) {
    $raw = file_get_contents($tokensFile);
    $tokens = json_decode($raw, true) ?: [];
}

// Add token only if not already stored
if (!in_array($token, $tokens, true)) {
    $tokens[] = $token;
    $dir = dirname($tokensFile);
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    file_put_contents($tokensFile, json_encode($tokens, JSON_PRETTY_PRINT));
}

echo json_encode(['success' => true]);

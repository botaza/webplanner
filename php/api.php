<?php
// php/api.php
date_default_timezone_set('Asia/Vladivostok'); // UTC+10, no DST

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');

$dataDir = __DIR__ . '/../data';
if (!is_dir($dataDir)) mkdir($dataDir, 0777, true);
$snapDir = __DIR__ . '/../snapshots';
if (!is_dir($snapDir)) mkdir($snapDir, 0777, true);

$files = [
    'events'   => $dataDir . '/events.json',
    'done'     => $dataDir . '/done.json',
    'expenses' => $dataDir . '/expenses.json',
    'income'   => $dataDir . '/income.json'
];

function read($f) {
    if (!file_exists($f)) return [];
    $c = file_get_contents($f);
    return json_decode($c, true) ?: [];
}

function write($f, $data) {
    file_put_contents($f, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

$action = $_POST['action'] ?? '';

if ($action === 'init') {
    foreach ($files as $f) if (!file_exists($f)) write($f, []);
    echo json_encode(['success' => true]);
    exit;
}

if ($action === 'get_events') {
    $data = read($files['events']);
    usort($data, fn($a,$b) => strcmp($a['dt'] ?? '', $b['dt'] ?? ''));
    echo json_encode($data);
    exit;
}

if ($action === 'add_event') {
    $data   = read($files['events']);
    $data[] = [
        'id'               => time() . rand(10000, 99999),
        'dt'               => $_POST['dt']               ?? '',
        'desc'             => $_POST['desc']             ?? '',
        'hashtag'          => $_POST['hashtag']          ?? '',
        'place'            => $_POST['place']            ?? '',
        'duration'         => $_POST['duration']         ?? '',
        'recurrence'       => $_POST['recurrence']       ?? 'none',
        'recurrence_group' => $_POST['recurrence_group'] ?? ''
    ];
    write($files['events'], $data);
    echo json_encode(['success' => true]);
    exit;
}

if ($action === 'update_event') {
    $data = read($files['events']);
    foreach ($data as &$e) {
        if ($e['id'] == $_POST['id']) {
            $e['dt']         = $_POST['dt']         ?? $e['dt'];
            $e['desc']       = $_POST['desc']       ?? $e['desc'];
            $e['hashtag']    = $_POST['hashtag']    ?? $e['hashtag'];
            $e['place']      = $_POST['place']      ?? $e['place'];
            $e['duration']         = $_POST['duration']         ?? ($e['duration'] ?? '');
            $e['recurrence_group'] = $_POST['recurrence_group'] ?? ($e['recurrence_group'] ?? '');
            $e['recurrence'] = $_POST['recurrence'] ?? $e['recurrence'];
            break;
        }
    }
    write($files['events'], $data);
    echo json_encode(['success' => true]);
    exit;
}

if ($action === 'delete_event') {
    $data = read($files['events']);
    $data = array_filter($data, fn($e) => $e['id'] != $_POST['id']);
    write($files['events'], array_values($data));
    echo json_encode(['success' => true]);
    exit;
}

if ($action === 'complete_event') {
    $data = read($files['events']);
    $done = read($files['done']);
    foreach ($data as $k => $e) {
        if ($e['id'] == $_POST['id']) {
            $done[] = $e;
            unset($data[$k]);
            break;
        }
    }
    write($files['events'], array_values($data));
    write($files['done'], $done);
    echo json_encode(['success' => true]);
    exit;
}

if ($action === 'get_expenses') {
    echo json_encode(read($files['expenses']));
    exit;
}

if ($action === 'add_expense') {
    $data   = read($files['expenses']);
    $data[] = [
        'id'       => time() . rand(10000, 99999),
        'date'     => $_POST['date']     ?? '',
        'amount'   => (float)($_POST['amount'] ?? 0),
        'tool'     => $_POST['tool']     ?? '',
        'category' => $_POST['category'] ?? '',
        'desc'     => $_POST['desc']     ?? ''
    ];
    write($files['expenses'], $data);
    echo json_encode(['success' => true]);
    exit;
}

if ($action === 'delete_expense') {
    $data = read($files['expenses']);
    $data = array_filter($data, fn($e) => $e['id'] != $_POST['id']);
    write($files['expenses'], array_values($data));
    echo json_encode(['success' => true]);
    exit;
}

if ($action === 'get_income') {
    echo json_encode(read($files['income']));
    exit;
}

if ($action === 'add_income') {
    $data   = read($files['income']);
    $data[] = [
        'id'     => time() . rand(10000, 99999),
        'date'   => $_POST['date']   ?? '',
        'amount' => (float)($_POST['amount'] ?? 0),
        'desc'   => $_POST['desc']   ?? ''
    ];
    write($files['income'], $data);
    echo json_encode(['success' => true]);
    exit;
}

if ($action === 'delete_income') {
    $data = read($files['income']);
    $data = array_filter($data, fn($e) => $e['id'] != $_POST['id']);
    write($files['income'], array_values($data));
    echo json_encode(['success' => true]);
    exit;
}

if ($action === 'snapshot') {
    $ts     = date('Ymd_His');
    $target = $snapDir . '/' . $ts;
    mkdir($target, 0777, true);
    foreach ($files as $name => $path) {
        if (file_exists($path)) copy($path, $target . '/' . basename($path));
    }
    echo json_encode(['success' => true]);
    exit;
}

if ($action === 'clear_all') {
    foreach ($files as $f) if (file_exists($f)) unlink($f);
    echo json_encode(['success' => true]);
    exit;
}

// ── Notification log ─────────────────────────────────────────────────────────
// Each entry: { id, dt, title, body, event_id, event_desc, tokens_count, status }

$notifLog = $dataDir . '/notification-log.json';

if ($action === 'get_notifications') {
    if (!file_exists($notifLog)) { echo json_encode([]); exit; }
    $all    = json_decode(file_get_contents($notifLog), true) ?: [];
    // newest first
    $all    = array_reverse($all);
    $page   = max(1, (int)($_POST['page'] ?? 1));
    $limit  = 50;
    $offset = ($page - 1) * $limit;
    $slice  = array_slice($all, $offset, $limit);
    echo json_encode(['items' => $slice, 'total' => count($all), 'page' => $page, 'pages' => ceil(count($all) / $limit)]);
    exit;
}

if ($action === 'log_notification') {
    $entry = [
        'id'           => time() . rand(1000, 9999),
        'dt'           => date('Y-m-d H:i:s'),
        'title'        => $_POST['title']        ?? '',
        'body'         => $_POST['body']         ?? '',
        'event_id'     => $_POST['event_id']     ?? '',
        'event_desc'   => $_POST['event_desc']   ?? '',
        'tokens_count' => (int)($_POST['tokens_count'] ?? 0),
        'status'       => $_POST['status']       ?? 'sent',
    ];
    $all   = file_exists($notifLog) ? (json_decode(file_get_contents($notifLog), true) ?: []) : [];
    $all[] = $entry;
    // Keep max 2000 entries to avoid the file growing forever
    if (count($all) > 2000) $all = array_slice($all, -2000);
    file_put_contents($notifLog, json_encode($all, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    echo json_encode(['success' => true]);
    exit;
}

if ($action === 'clear_notifications') {
    if (file_exists($notifLog)) unlink($notifLog);
    echo json_encode(['success' => true]);
    exit;
}

echo json_encode(['error' => 'unknown action']);

<?php
// php/api.php
// UPDATED: Added daily recurrence support for events

header('Content-Type: application/json');
$dataDir = __DIR__ . '/../data';
$snapDir = __DIR__ . '/../snapshots';

if (!is_dir($dataDir)) mkdir($dataDir, 0777, true);
if (!is_dir($snapDir)) mkdir($snapDir, 0777, true);

$files = [
    'events' => $dataDir . '/events.json',
    'expenses' => $dataDir . '/expenses.json',
    'income' => $dataDir . '/income.json'
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

// ── System Init ──
if ($action === 'init') {
    foreach ($files as $f) if (!file_exists($f)) write($f, []);
    echo json_encode(['success' => true]);
    exit;
}

// ── Events ──
if ($action === 'get_events') {
    $data = read($files['events']);
    usort($data, fn($a,$b) => strcmp($a['dt'] ?? '', $b['dt'] ?? ''));
    echo json_encode($data);
    exit;
}
if ($action === 'add_event') {
    $data = read($files['events']);
    $data[] = [
        'id' => time() . rand(10000, 99999),
        'dt' => $_POST['dt'] ?? '',
        'desc' => $_POST['desc'] ?? '',
        'hashtag' => $_POST['hashtag'] ?? '',
        'place' => $_POST['place'] ?? '',
        'duration' => $_POST['duration'] ?? '',
        'recurrence' => $_POST['recurrence'] ?? 'none',
        'recurrence_group' => $_POST['recurrence_group'] ?? '',
        'completed' => false
    ];
    write($files['events'], $data);
    echo json_encode(['success' => true]);
    exit;
}
if ($action === 'update_event') {
    $data = read($files['events']);
    foreach ($data as &$e) {
        if ($e['id'] == $_POST['id']) {
            $e['dt'] = $_POST['dt'] ?? $e['dt'];
            $e['desc'] = $_POST['desc'] ?? $e['desc'];   //
            $e['hashtag'] = $_POST['hashtag'] ?? $e['hashtag'];
            $e['place'] = $_POST['place'] ?? $e['place'];
            $e['duration'] = $_POST['duration'] ?? ($e['duration'] ?? '');
            $e['recurrence_group'] = $_POST['recurrence_group'] ?? ($e['recurrence_group'] ?? '');
            $e['recurrence'] = $_POST['recurrence'] ?? $e['recurrence'];
            if (isset($_POST['completed'])) {
                $e['completed'] = $_POST['completed'] === '1' || $_POST['completed'] === true;
            }
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
    $id = $_POST['id'] ?? '';
    $newCompleted = isset($_POST['completed']) ? ($_POST['completed'] === '1' || $_POST['completed'] === true) : true;
    foreach ($data as &$e) {
        if ($e['id'] == $id) {
            $e['completed'] = $newCompleted;
            if (!$newCompleted && !empty($_POST['dt'])) {
                $e['dt'] = $_POST['dt'];
            }
            break;
        }
    }
    write($files['events'], $data);
    echo json_encode(['success' => true]);
    exit;
}

// ── Expenses Basic ──
if ($action === 'get_expenses') {
    echo json_encode(read($files['expenses']));
    exit;
}
if ($action === 'add_expense') {
    $data = read($files['expenses']);
    $data[] = [
        'id' => time() . rand(10000, 99999),
        'date' => $_POST['date'] ?? '',
        'amount' => (float)($_POST['amount'] ?? 0),
        'tool' => $_POST['tool'] ?? '',
        'category' => $_POST['category'] ?? '',
        'desc' => $_POST['desc'] ?? ''
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

// ── Expenses Stats & Aggregation ──
if ($action === 'get_expenses_aggregated') {
    $data = read($files['expenses']);
    $start = $_POST['start_date'] ?? '';
    $end = $_POST['end_date'] ?? '';
    $group = $_POST['group_by'] ?? 'category';
    
    $result = [];
    $total = 0;
    
    foreach ($data as $exp) {
        if ($start && $exp['date'] < $start) continue;
        if ($end && $exp['date'] > $end) continue;
        
        $key = $exp[$group] ?? 'unknown';
        $amt = (float)($exp['amount'] ?? 0);
        
        if (!isset($result[$key])) {
            $result[$key] = ['label' => $key, 'amount' => 0, 'count' => 0];
        }
        $result[$key]['amount'] += $amt;
        $result[$key]['count'] += 1;
        $total += $amt;
    }
    
    echo json_encode(['groups' => $result, 'total' => $total]);
    exit;
}

if ($action === 'get_expenses_filtered') {
    $data = read($files['expenses']);
    $start = $_POST['start_date'] ?? '';
    $end = $_POST['end_date'] ?? '';
    $min = (float)($_POST['min_amount'] ?? 0);
    
    $filtered = array_filter($data, function($e) use ($start, $end, $min) {
        if ($start && $e['date'] < $start) return false;
        if ($end && $e['date'] > $end) return false;
        if ($min && (float)($e['amount'] ?? 0) < $min) return false;
        return true;
    });
    
    echo json_encode(array_values($filtered));
    exit;
}

if ($action === 'get_expenses_metadata') {
    $data = read($files['expenses']);
    $dates = array_column($data, 'date');
    sort($dates);
    $size = filesize($files['expenses']);
    
    echo json_encode([
        'record_count' => count($data),
        'min_date' => $dates[0] ?? null,
        'max_date' => $dates[count($dates)-1] ?? null,
        'file_size_kb' => round($size / 1024, 2)
    ]);
    exit;
}

if ($action === 'archive_expenses_old') {
    $before = $_POST['before_date'] ?? '';
    if (!$before) {
        echo json_encode(['error' => 'Missing date']);
        exit;
    }
    
    $data = read($files['expenses']);
    $keep = [];
    $archive = [];
    
    foreach ($data as $e) {
        if ($e['date'] < $before) {
            $archive[] = $e;
        } else {
            $keep[] = $e;
        }
    }
    
    // Write back kept data
    write($files['expenses'], $keep);
    
    // Append to archive file
    $archiveFile = $dataDir . '/expenses-archive.json';
    $existingArchive = read($archiveFile);
    write($archiveFile, array_merge($existingArchive, $archive));
    
    echo json_encode(['success' => true, 'archived_count' => count($archive)]);
    exit;
}

// ── Income ──
if ($action === 'get_income') {
    echo json_encode(read($files['income']));
    exit;
}
if ($action === 'add_income') {
    $data = read($files['income']);
    $data[] = [
        'id' => time() . rand(10000, 99999),
        'date' => $_POST['date'] ?? '',
        'amount' => (float)($_POST['amount'] ?? 0),
        'desc' => $_POST['desc'] ?? ''
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

// ── System ──
if ($action === 'snapshot') {
    $ts = date('Ymd_His');
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

// ── Notifications ──
$notifLog = $dataDir . '/notification-log.json';
if ($action === 'get_notifications') {
    if (!file_exists($notifLog)) { echo json_encode([]); exit; }
    $all = json_decode(file_get_contents($notifLog), true) ?: [];
    $all = array_reverse($all);
    $page = max(1, (int)($_POST['page'] ?? 1));
    $limit = 50;
    $offset = ($page - 1) * $limit;
    $slice = array_slice($all, $offset, $limit);
    echo json_encode(['items' => $slice, 'total' => count($all), 'page' => $page, 'pages' => ceil(count($all) / $limit)]);
    exit;
}
if ($action === 'log_notification') {
    $entry = [
        'id' => time() . rand(1000, 9999),
        'dt' => date('Y-m-d H:i:s'),
        'rule' => $_POST['rule'] ?? '',
        'title' => $_POST['title'] ?? '',
        'body' => $_POST['body'] ?? '',
        'event_id' => $_POST['event_id'] ?? '',
        'event_desc' => $_POST['event_desc'] ?? '',
        'tokens_count' => (int)($_POST['tokens_count'] ?? 0),
        'status' => $_POST['status'] ?? 'sent',
    ];
    $all = file_exists($notifLog) ? (json_decode(file_get_contents($notifLog), true) ?: []) : [];
    $all[] = $entry;
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
?>
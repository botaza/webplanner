<?php
// php/api.php
// UPDATED: Added full multi-guestbook support
// UPDATED: Hardcoded UTC+10 (Asia/Vladivostok)
// UPDATED: Added token preferences (chatOnly toggle) - one user can receive ONLY chat notifications
// PATCHED: update_token_prefs now preserves existing prefs if not explicitly sent (fixes persistence)
date_default_timezone_set('Asia/Vladivostok');
header('Content-Type: application/json');
$dataDir = __DIR__ . '/../data';
$snapDir = __DIR__ . '/../snapshots';
if (!is_dir($dataDir)) mkdir($dataDir, 0777, true);
if (!is_dir($snapDir)) mkdir($snapDir, 0777, true);
$files = [
'events'        => $dataDir . '/events.json',
'expenses'      => $dataDir . '/expenses.json',
'income'        => $dataDir . '/income.json',
'compensations' => $dataDir . '/compensations.json',
'shopping'      => $dataDir . '/shopping.json',
'guestbooks'    => $dataDir . '/guestbooks.json'
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
foreach ($files as $key => $f) {
if (!file_exists($f)) {
if ($key === 'guestbooks') {
write($f, ['general' => []]);
} else {
write($f, []);
}
}
}
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
'original_hashtag' => $_POST['original_hashtag'] ?? '',
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
$e['desc'] = $_POST['desc'] ?? $e['desc'];
$e['hashtag'] = $_POST['hashtag'] ?? $e['hashtag'];
$e['original_hashtag'] = $_POST['original_hashtag'] ?? ($e['original_hashtag'] ?? '');
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
if ($action === 'update_expense') {
$data = read($files['expenses']);
$updated = false;
foreach ($data as &$e) {
if ($e['id'] == $_POST['id']) {
if (isset($_POST['date'])) $e['date'] = $_POST['date'];
if (isset($_POST['amount'])) $e['amount'] = (float)$_POST['amount'];
if (isset($_POST['tool'])) $e['tool'] = $_POST['tool'];
if (isset($_POST['category'])) $e['category'] = $_POST['category'];
if (isset($_POST['desc'])) $e['desc'] = $_POST['desc'];
$updated = true;
break;
}
}
if (!$updated) {
echo json_encode(['error' => 'Expense not found']);
exit;
}
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
$size = file_exists($files['expenses']) ? filesize($files['expenses']) : 0;
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
write($files['expenses'], $keep);
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
'id'     => time() . rand(10000, 99999),
'date'   => $_POST['date'] ?? '',
'amount' => (float)($_POST['amount'] ?? 0),
'tool'   => $_POST['tool'] ?? '',
'desc'   => $_POST['desc'] ?? ''
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
if ($action === 'get_income_aggregated') {
$data = read($files['income']);
$start = $_POST['start_date'] ?? '';
$end   = $_POST['end_date'] ?? '';
$result = [];
$total  = 0;
foreach ($data as $inc) {
if ($start && $inc['date'] < $start) continue;
if ($end   && $inc['date'] > $end)   continue;
$key = $inc['tool'] ?? 'unknown';
if (!$key) $key = 'unknown';
$amt = (float)($inc['amount'] ?? 0);
if (!isset($result[$key])) {
$result[$key] = ['label' => $key, 'amount' => 0, 'count' => 0];
}
$result[$key]['amount'] += $amt;
$result[$key]['count']  += 1;
$total += $amt;
}
echo json_encode(['groups' => $result, 'total' => $total]);
exit;
}
// ── Compensations ──
if ($action === 'get_compensations') {
echo json_encode(read($files['compensations']));
exit;
}
if ($action === 'add_compensation') {
$data = read($files['compensations']);
$data[] = [
'id'     => time() . rand(10000, 99999),
'date'   => $_POST['date'] ?? '',
'amount' => (float)($_POST['amount'] ?? 0),
'tool'   => $_POST['tool'] ?? '',
'desc'   => $_POST['desc'] ?? ''
];
write($files['compensations'], $data);
echo json_encode(['success' => true]);
exit;
}
if ($action === 'delete_compensation') {
$data = read($files['compensations']);
$data = array_filter($data, fn($e) => $e['id'] != $_POST['id']);
write($files['compensations'], array_values($data));
echo json_encode(['success' => true]);
exit;
}
if ($action === 'get_compensations_aggregated') {
$data  = read($files['compensations']);
$start = $_POST['start_date'] ?? '';
$end   = $_POST['end_date'] ?? '';
$result = [];
$total  = 0;
foreach ($data as $comp) {
if ($start && $comp['date'] < $start) continue;
if ($end   && $comp['date'] > $end)   continue;
$key = $comp['tool'] ?? 'unknown';
if (!$key) $key = 'unknown';
$amt = (float)($comp['amount'] ?? 0);
if (!isset($result[$key])) {
$result[$key] = ['label' => $key, 'amount' => 0, 'count' => 0];
}
$result[$key]['amount'] += $amt;
$result[$key]['count']  += 1;
$total += $amt;
}
echo json_encode(['groups' => $result, 'total' => $total]);
exit;
}
// ── Shopping List ──
if ($action === 'get_shopping') {
$data = read($files['shopping']);
usort($data, function($a, $b) {
$prioA = (int)($a['priority'] ?? 0);
$prioB = (int)($b['priority'] ?? 0);
if ($prioA !== $prioB) return $prioB - $prioA;
return strcmp($a['date_purchase'] ?? '', $b['date_purchase'] ?? '');
});
echo json_encode($data);
exit;
}
if ($action === 'add_shopping') {
$data = read($files['shopping']);
$data[] = [
'id' => time() . rand(10000, 99999),
'name' => $_POST['name'] ?? '',
'quantity' => (int)($_POST['quantity'] ?? 0),
'place' => $_POST['place'] ?? '',
'date_purchase' => $_POST['date_purchase'] ?? '',
'comment1' => $_POST['comment1'] ?? '',
'comment2' => $_POST['comment2'] ?? '',
'priority' => (int)($_POST['priority'] ?? 5),
'is_wishlist' => isset($_POST['is_wishlist']) && $_POST['is_wishlist'] === 'true',
'created_at' => date('Y-m-d H:i:s')
];
write($files['shopping'], $data);
echo json_encode(['success' => true]);
exit;
}
if ($action === 'update_shopping') {
$data = read($files['shopping']);
$updated = false;
foreach ($data as &$item) {
if ($item['id'] == $_POST['id']) {
if (isset($_POST['name'])) $item['name'] = $_POST['name'];
if (isset($_POST['quantity'])) $item['quantity'] = (int)$_POST['quantity'];
if (isset($_POST['place'])) $item['place'] = $_POST['place'];
if (isset($_POST['date_purchase'])) $item['date_purchase'] = $_POST['date_purchase'];
if (isset($_POST['comment1'])) $item['comment1'] = $_POST['comment1'];
if (isset($_POST['comment2'])) $item['comment2'] = $_POST['comment2'];
if (isset($_POST['priority'])) $item['priority'] = (int)$_POST['priority'];
if (isset($_POST['is_wishlist'])) $item['is_wishlist'] = $_POST['is_wishlist'] === 'true';
$updated = true;
break;
}
}
if (!$updated) {
echo json_encode(['error' => 'Shopping item not found']);
exit;
}
usort($data, function($a, $b) {
$prioA = (int)($a['priority'] ?? 0);
$prioB = (int)($b['priority'] ?? 0);
if ($prioA !== $prioB) return $prioB - $prioA;
return strcmp($a['date_purchase'] ?? '', $b['date_purchase'] ?? '');
});
write($files['shopping'], $data);
echo json_encode(['success' => true]);
exit;
}
if ($action === 'delete_shopping') {
$data = read($files['shopping']);
$data = array_filter($data, fn($item) => $item['id'] != $_POST['id']);
write($files['shopping'], array_values($data));
echo json_encode(['success' => true]);
exit;
}
// ── Guestbook Module ──
if ($action === 'get_guestbooks') {
$data = read($files['guestbooks']);
if (empty($data)) $data = ['general' => []];
echo json_encode($data);
exit;
}
if ($action === 'add_guestbook_message') {
$data = read($files['guestbooks']);
$book = $_POST['book'] ?? 'general';
if (!isset($data[$book])) $data[$book] = [];
$data[$book][] = [
'id'       => time() . rand(10000, 99999),
'username' => $_POST['username'] ?? 'Guest',
'text'     => $_POST['text'] ?? '',
'emoji'    => $_POST['emoji'] ?? '',
'dt'       => date('Y-m-d H:i:s')
];
if (count($data[$book]) > 2000) {
$data[$book] = array_slice($data[$book], -2000);
}
write($files['guestbooks'], $data);
echo json_encode(['success' => true]);
exit;
}
if ($action === 'create_guestbook') {
$data = read($files['guestbooks']);
$name = trim($_POST['name'] ?? '');
if (!$name) {
echo json_encode(['error' => 'Name required']);
exit;
}
$key = strtolower(preg_replace('/[^a-z0-9]+/', '-', $name));
if (isset($data[$key])) {
echo json_encode(['error' => 'Already exists']);
exit;
}
$data[$key] = [];
write($files['guestbooks'], $data);
echo json_encode(['success' => true, 'key' => $key, 'name' => $name]);
exit;
}
if ($action === 'delete_guestbook_message') {
$data = read($files['guestbooks']);
$book = $_POST['book'] ?? 'general';
$id   = $_POST['id'] ?? '';
if (isset($data[$book])) {
$data[$book] = array_filter($data[$book], fn($m) => $m['id'] != $id);
$data[$book] = array_values($data[$book]);
write($files['guestbooks'], $data);
}
echo json_encode(['success' => true]);
exit;
}
if ($action === 'delete_guestbook') {
$data = read($files['guestbooks']);
$book = trim($_POST['book'] ?? '');
if (!$book || $book === 'general') {
echo json_encode(['error' => 'Cannot delete the general guestbook']);
exit;
}
if (!isset($data[$book])) {
echo json_encode(['error' => 'Guestbook not found']);
exit;
}
unset($data[$book]);
write($files['guestbooks'], $data);
echo json_encode(['success' => true]);
exit;
}
if ($action === 'clear_guestbook') {
$data = read($files['guestbooks']);
$book = trim($_POST['book'] ?? '');
if (!$book || !isset($data[$book])) {
echo json_encode(['error' => 'Guestbook not found']);
exit;
}
$data[$book] = [];
write($files['guestbooks'], $data);
echo json_encode(['success' => true]);
exit;
}
// ── Token Management with chatOnly preference ──
$tokensFile = $dataDir . '/fcm-tokens.json';
function readTokensWithPrefs(string $file): array {
if (!file_exists($file)) return [];
$data = json_decode(file_get_contents($file), true) ?: [];
return array_map(function($t) {
if (is_string($t)) {
return [
'token' => $t,
'username' => '',
'browser' => 'Unknown',
'registered_at' => date('Y-m-d H:i:s'),
'last_seen' => date('Y-m-d H:i:s'),
'prefs' => ['chatOnly' => false, 'activeBook' => 'general']
];
}
if (!isset($t['prefs']) || !is_array($t['prefs'])) {
$t['prefs'] = ['chatOnly' => false, 'activeBook' => 'general'];
}
// Backfill activeBook on tokens that predate this patch
if (!isset($t['prefs']['activeBook'])) {
$t['prefs']['activeBook'] = 'general';
}
return $t;
}, $data);
}
function writeTokensWithPrefs(string $file, array $tokens): void {
file_put_contents($file, json_encode(array_values($tokens), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}
if ($action === 'get_tokens') {
$tokens = readTokensWithPrefs($tokensFile);
echo json_encode($tokens);
exit;
}
if ($action === 'update_token_prefs') {
$tokenStr = $_POST['token'] ?? '';
// PATCHED: Default to null so we can detect if prefs were sent
$prefsJson = $_POST['prefs'] ?? null; 
if (!$tokenStr) {
echo json_encode(['error' => 'Token required']);
exit;
}
$tokens = readTokensWithPrefs($tokensFile);
$updated = false;
foreach ($tokens as &$t) {
if ($t['token'] === $tokenStr) {
// PATCHED: Merge incoming prefs into existing so individual keys
// don't overwrite each other (e.g. activeBook won't wipe chatOnly)
if ($prefsJson !== null) {
$incomingPrefs = json_decode($prefsJson, true) ?: [];
$existingPrefs = $t['prefs'] ?? ['chatOnly' => false, 'activeBook' => 'general'];
$t['prefs'] = array_merge($existingPrefs, $incomingPrefs);
}
if (isset($_POST['username'])) {
$t['username'] = $_POST['username'];
}
$t['last_seen'] = date('Y-m-d H:i:s');
$updated = true;
break;
}
}
if (!$updated) {
$defaultPrefs = ['chatOnly' => false, 'activeBook' => 'general'];
$incomingPrefs = $prefsJson !== null ? (json_decode($prefsJson, true) ?: []) : [];
$tokens[] = [
'token' => $tokenStr,
'username' => $_POST['username'] ?? 'Guest',
'browser' => $_POST['browser'] ?? 'Unknown',
'registered_at' => date('Y-m-d H:i:s'),
'last_seen' => date('Y-m-d H:i:s'),
'prefs' => array_merge($defaultPrefs, $incomingPrefs)
];
}
writeTokensWithPrefs($tokensFile, $tokens);
echo json_encode(['success' => true]);
exit;
}
// ── Legacy token actions (kept for compatibility) ──
function readTokens(string $file): array {
if (!file_exists($file)) return [];
return json_decode(file_get_contents($file), true) ?: [];
}
function writeTokens(string $file, array $tokens): void {
file_put_contents($file, json_encode(array_values($tokens), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}
if ($action === 'delete_token') {
$target = trim($_POST['token'] ?? '');
if (!$target) { echo json_encode(['error' => 'No token provided']); exit; }
$tokens = readTokens($tokensFile);
$tokens = array_filter($tokens, function($t) use ($target) {
$tok = is_string($t) ? $t : ($t['token'] ?? '');
return $tok !== $target;
});
writeTokens($tokensFile, $tokens);
echo json_encode(['success' => true]);
exit;
}
if ($action === 'delete_all_tokens') {
writeTokens($tokensFile, []);
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
// (catch-all for original actions — new actions below)

// ── Scratch Notes ──
$scratchFile = $dataDir . '/scratch.json';
$scratchMedia = $dataDir . '/scratch-media';
if (!is_dir($scratchMedia)) mkdir($scratchMedia, 0777, true);

// Max upload size in bytes (8 MB default — change as needed)
define('SCRATCH_MAX_BYTES', 8 * 1024 * 1024);

if ($action === 'get_scratch') {
    $notes = file_exists($scratchFile) ? (json_decode(file_get_contents($scratchFile), true) ?: []) : [];
    echo json_encode($notes);
    exit;
}

if ($action === 'add_scratch') {
    $notes = file_exists($scratchFile) ? (json_decode(file_get_contents($scratchFile), true) ?: []) : [];
    $id  = (string)(time() . rand(10000, 99999));
    $note = [
        'id'    => $id,
        'ts'    => time() * 1000,
        'text'  => trim($_POST['text'] ?? ''),
        'media' => []   // will be filled by upload_scratch_media separately
    ];
    array_unshift($notes, $note);
    file_put_contents($scratchFile, json_encode($notes, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    echo json_encode(['success' => true, 'id' => $id]);
    exit;
}

if ($action === 'upload_scratch_media') {
    $noteId = trim($_POST['note_id'] ?? '');
    $kind   = trim($_POST['kind'] ?? '');   // 'image' or 'audio'
    if (!$noteId || !in_array($kind, ['image','audio'])) {
        echo json_encode(['error' => 'bad params']); exit;
    }
    if (empty($_FILES['file']['tmp_name'])) {
        echo json_encode(['error' => 'no file']); exit;
    }
    $size = $_FILES['file']['size'];
    if ($size > SCRATCH_MAX_BYTES) {
        echo json_encode(['error' => 'File too large. Max ' . (SCRATCH_MAX_BYTES / 1024 / 1024) . ' MB.']); exit;
    }
    // Validate mime
    $mime = mime_content_type($_FILES['file']['tmp_name']);
    $allowed = $kind === 'image'
        ? ['image/jpeg','image/png','image/gif','image/webp']
        : ['audio/webm','audio/ogg','audio/mpeg','audio/mp4','audio/wav','video/webm'];
    if (!in_array($mime, $allowed)) {
        echo json_encode(['error' => 'File type not allowed: ' . $mime]); exit;
    }
    $ext = pathinfo($_FILES['file']['name'], PATHINFO_EXTENSION) ?: ($kind === 'image' ? 'jpg' : 'webm');
    $filename = $noteId . '_' . $kind . '_' . time() . '.' . $ext;
    $dest = $scratchMedia . '/' . $filename;
    if (!move_uploaded_file($_FILES['file']['tmp_name'], $dest)) {
        echo json_encode(['error' => 'Upload failed']); exit;
    }
    // Attach to note record
    $notes = file_exists($scratchFile) ? (json_decode(file_get_contents($scratchFile), true) ?: []) : [];
    foreach ($notes as &$n) {
        if ($n['id'] === $noteId) {
            $n['media'][] = ['kind' => $kind, 'file' => $filename];
            break;
        }
    }
    file_put_contents($scratchFile, json_encode($notes, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    echo json_encode(['success' => true, 'file' => $filename]);
    exit;
}

if ($action === 'delete_scratch') {
    $noteId = trim($_POST['id'] ?? '');
    if (!$noteId) { echo json_encode(['error' => 'no id']); exit; }
    $notes = file_exists($scratchFile) ? (json_decode(file_get_contents($scratchFile), true) ?: []) : [];
    // Delete media files for this note
    foreach ($notes as $n) {
        if ($n['id'] === $noteId) {
            foreach ($n['media'] ?? [] as $m) {
                $path = $scratchMedia . '/' . $m['file'];
                if (file_exists($path)) unlink($path);
            }
            break;
        }
    }
    $notes = array_values(array_filter($notes, fn($n) => $n['id'] !== $noteId));
    file_put_contents($scratchFile, json_encode($notes, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    echo json_encode(['success' => true]);
    exit;
}

if ($action === 'serve_scratch_media') {
    // Serve a media file safely (no directory traversal)
    $filename = basename($_POST['file'] ?? '');
    if (!$filename) { http_response_code(400); echo 'bad request'; exit; }
    $path = $scratchMedia . '/' . $filename;
    if (!file_exists($path)) { http_response_code(404); echo 'not found'; exit; }
    $mime = mime_content_type($path);
    header('Content-Type: ' . $mime);
    header('Content-Length: ' . filesize($path));
    header('Cache-Control: private, max-age=86400');
    readfile($path);
    exit;
}

// ── Pinned Event IDs ──
$pinnedFile = $dataDir . '/pinned.json';

if ($action === 'get_pinned') {
    $ids = file_exists($pinnedFile) ? (json_decode(file_get_contents($pinnedFile), true) ?: []) : [];
    echo json_encode($ids);
    exit;
}

if ($action === 'set_pinned') {
    // Accepts a JSON-encoded array of IDs
    $raw = $_POST['ids'] ?? '[]';
    $ids = json_decode($raw, true);
    if (!is_array($ids)) $ids = [];
    file_put_contents($pinnedFile, json_encode(array_values($ids), JSON_PRETTY_PRINT));
    echo json_encode(['success' => true]);
    exit;
}

echo json_encode(['error' => 'unknown action']);
?>

// ... [Previous code for OAuth and FCM sending remains unchanged] ...

/**
 * PATCH: Filter events for notification rules
 * Only send notifications for events that are NOT completed
 * OR events that were reset to incomplete (completed=false)
 */
function getEventsForNotifications(): array {
 $eventsFile = __DIR__ . '/../data/events.json';
 if (!file_exists($eventsFile)) return [];
 
 $all = json_decode(file_get_contents($eventsFile), true) ?: [];
 
 // PATCH: Filter out completed events from notification logic
 // Events with completed=true won't receive notifications
 // When reset to incomplete, they automatically re-enter notification pool
 return array_filter($all, function($e) {
  return empty($e['completed']) || $e['completed'] === false;
 });
}

/**
 * PATCH: Updated rule1_1hour to use filtered events
 */
function rule1_1hour_before(string $accessToken, array $tokens): int {
 $events = getEventsForNotifications(); // PATCH: Use filtered list
 $now = time();
 $sent = 0;
 
 foreach ($events as $ev) {
  $eventTime = strtotime($ev['dt']);
  if (!$eventTime) continue;
  
  // 1 hour before (±5 min window)
  $targetStart = $eventTime - 3600 - 300;
  $targetEnd = $eventTime - 3600 + 300;
  
  if ($now >= $targetStart && $now <= $targetEnd) {
   $title = '⏰ 1 hour reminder';
   $body = $ev['desc'] ?? 'Upcoming event';
   if ($ev['place'] ?? '') $body .= ' @ ' . $ev['place'];
   if ($ev['duration'] ?? '') $body .= ' (' . $ev['duration'] . ' min)';
   
   if (notify($accessToken, $tokens, $title, $body, 'rule1_1hour', $ev['id'], $ev['desc'])) {
    $sent++;
   }
  }
 }
 return $sent;
}

// ... [Other rules (rule2, rule3, etc.) should similarly use getEventsForNotifications()] ...

/**
 * PATCH: Ensure all notification rules use the filtered event list
 * This guarantees:
 * - Completed events don't get notifications
 * - Reset (incomplete) events DO get notifications if they match rules
 * - Date changes are automatically respected (events are re-evaluated by dt field)
 */

// Example for rule2 (hashtag-based daily):
function rule2_event_hashtag(string $accessToken, array $tokens): int {
 $events = getEventsForNotifications(); // PATCH: Critical filter
 $today = date('Y-m-d');
 $sent = 0;
 
 foreach ($events as $ev) {
  if (($ev['hashtag'] ?? '') !== '#event') continue;
  if (strpos($ev['dt'] ?? '', $today) !== 0) continue;
  
  $title = '📅 Today: #event';
  $body = $ev['desc'] ?? 'Scheduled event';
  
  if (notify($accessToken, $tokens, $title, $body, 'rule2_event_hashtag', $ev['id'], $ev['desc'])) {
   $sent++;
  }
 }
 return $sent;
}

// ... [Continue patching other rules similarly] ...

/**
 * Main execution
 */
$tokensFile = __DIR__ . '/../data/fcm-tokens.json';
$tokens = file_exists($tokensFile) ? (json_decode(file_get_contents($tokensFile), true) ?: []) : [];

if (empty($tokens)) {
 echo date('Y-m-d H:i:s') . " No tokens to send to\n";
 exit(0);
}

$accessToken = getOAuthAccessToken(__DIR__ . '/../service-account.json');
if (!$accessToken) {
 echo date('Y-m-d H:i:s') . " Failed to obtain OAuth token\n";
 exit(1);
}

// PATCH: All rules now use filtered events (completed=false only)
$sent = 0;
$sent += rule1_1hour_before($accessToken, $tokens);
$sent += rule2_event_hashtag($accessToken, $tokens);
$sent += rule3_control_hashtag($accessToken, $tokens);
$sent += rule4_pers_hashtag($accessToken, $tokens);
$sent += rule5_tomorrow($accessToken, $tokens);
$sent += rule6_horizon($accessToken, $tokens, 3);
$sent += rule6_horizon($accessToken, $tokens, 7);
$sent += rule6_horizon($accessToken, $tokens, 14);

echo date('Y-m-d H:i:s') . " Notifications sent: $sent\n";
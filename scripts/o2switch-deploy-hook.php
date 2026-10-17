<?php
// Installed in ~/lumen-private; the public wrapper contains no credential.
declare(strict_types=1);
ini_set('display_errors', '0');
header('Content-Type: application/json');
header('Cache-Control: no-store');
function reply(int $code, array $body): void {
    http_response_code($code);
    echo json_encode($body), "\n";
    exit;
}
umask(0077);
$private = __DIR__;
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') reply(405, ['error' => 'POST required']);
if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 1024) reply(413, ['error' => 'Body too large']);
$body = file_get_contents('php://input', false, null, 0, 1025);
if ($body === false || strlen($body) > 1024) reply(413, ['error' => 'Body too large']);
$secret = trim((string)@file_get_contents($private . '/deploy-webhook-secret'));
if (!preg_match('/\A[0-9a-f]{64}\z/', $secret)) reply(503, ['error' => 'Receiver not configured']);
$timestamp = $_SERVER['HTTP_X_LUMEN_TIMESTAMP'] ?? '';
$signature = $_SERVER['HTTP_X_LUMEN_SIGNATURE'] ?? '';
if (!preg_match('/\A[0-9]{10}\z/', $timestamp) || abs(time() - (int)$timestamp) > 300 ||
    !hash_equals('sha256=' . hash_hmac('sha256', $timestamp . "\n" . $body, $secret), $signature)) {
    reply(401, ['error' => 'Invalid signature or expired request']);
}
$data = json_decode($body, true);
if (!is_array($data) || !is_string($data['sha'] ?? null) ||
    !preg_match('/\A[0-9a-f]{40}\z/', $data['sha']) ||
    !in_array($data['action'] ?? '', ['deploy', 'status'], true)) reply(400, ['error' => 'Invalid request']);
$sha = $data['sha'];
$jobs = $private . '/deploy-jobs';
if (!is_dir($jobs) && !mkdir($jobs, 0700)) reply(503, ['error' => 'Job storage unavailable']);
$statePath = $jobs . '/' . $sha . '.json';
if ($data['action'] === 'status') {
    $state = json_decode((string)@file_get_contents($statePath), true);
    reply(200, $state ?: ['sha' => $sha, 'state' => 'unknown']);
}
if (!function_exists('exec')) reply(503, ['error' => 'PHP exec unavailable']);
$lock = fopen($jobs . '/request.lock', 'c');
if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) reply(503, ['error' => 'Receiver busy; retry']);
// Persist accepted signatures before launching: a replay never starts a second job.
$receipt = $jobs . '/request-' . hash('sha256', $timestamp . $signature);
if (file_exists($receipt)) reply(202, ['sha' => $sha, 'state' => 'accepted']);
$state = json_decode((string)@file_get_contents($statePath), true);
if (($state['state'] ?? '') === 'pending' && time() - ($state['started'] ?? 0) < 600) {
    reply(202, ['sha' => $sha, 'state' => 'pending']);
}
if (file_put_contents($receipt, (string)time()) === false ||
    file_put_contents($statePath, json_encode(['sha' => $sha, 'state' => 'pending', 'started' => time()])) === false) {
    reply(503, ['error' => 'Cannot persist job']);
}
// Only a fixed private worker and a validated full SHA enter this command.
$command = 'nohup /bin/bash ' . escapeshellarg($private . '/lumen-webhook-worker.sh') . ' ' . escapeshellarg($sha) .
    ' </dev/null >>' . escapeshellarg($jobs . '/' . $sha . '.log') . ' 2>&1 & echo $!';
$output = [];
$result = 1;
exec($command, $output, $result);
flock($lock, LOCK_UN);
fclose($lock);
if ($result !== 0 || !ctype_digit(trim(implode('', $output)))) {
    file_put_contents($statePath, json_encode(['sha' => $sha, 'state' => 'failed']));
    reply(503, ['error' => 'Cannot start publisher']);
}
// Old replay receipts have no value beyond the five-minute signature window.
foreach (glob($jobs . '/request-*') ?: [] as $old) {
    if (filemtime($old) < time() - 600) @unlink($old);
}
reply(202, ['sha' => $sha, 'state' => 'accepted']);

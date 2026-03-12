<?php
require __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET' && isset($_GET['token'])) {
    $token = trim((string)$_GET['token']);
    if (!preg_match('/^[a-f0-9]{64}$/', $token)) {
        respond(array('ok' => false, 'error' => 'Некорректный токен'), 400);
    }

    $stmt = dbPrepare($mysqli, 'SELECT p.state_json FROM user_share_tokens t JOIN user_profiles p ON p.user_id = t.user_id WHERE t.share_token = ? LIMIT 1');
    $stmt->bind_param('s', $token);
    $stmt->execute();
    $stmt->bind_result($stateJson);
    if (!$stmt->fetch()) {
        $stmt->close();
        respond(array('ok' => false, 'error' => 'Ссылка не найдена'), 404);
    }
    $stmt->close();

    respond(array(
        'ok' => true,
        'profile' => json_decode($stateJson, true)
    ), 200);
}

if ($method === 'GET') {
    $userId = requireAuth();

    $stmt = dbPrepare($mysqli, 'SELECT share_token FROM user_share_tokens WHERE user_id = ? LIMIT 1');
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $stmt->bind_result($shareToken);

    if ($stmt->fetch()) {
        $stmt->close();
        respond(array('ok' => true, 'shareToken' => $shareToken), 200);
    }
    $stmt->close();

    $shareToken = bin2hex(random_bytes(32));
    $now = date('Y-m-d H:i:s');
    $insert = dbPrepare($mysqli, 'INSERT INTO user_share_tokens (user_id, share_token, created_at, updated_at) VALUES (?, ?, ?, ?)');
    $insert->bind_param('isss', $userId, $shareToken, $now, $now);
    $insert->execute();
    $insert->close();

    respond(array('ok' => true, 'shareToken' => $shareToken), 200);
}

respond(array('ok' => false, 'error' => 'Method not allowed'), 405);

<?php
require __DIR__ . '/bootstrap.php';

$userId = requireAuth();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $mysqli->prepare('SELECT state_json, updated_at FROM user_profiles WHERE user_id = ? LIMIT 1');
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $stmt->bind_result($stateJson, $updatedAt);

    if ($stmt->fetch()) {
        $stmt->close();
        respond(array(
            'ok' => true,
            'profile' => array(
                'state' => json_decode($stateJson, true),
                'updatedAt' => $updatedAt,
            ),
        ), 200);
    }

    $stmt->close();
    respond(array('ok' => true, 'profile' => null), 200);
}

if ($method === 'POST') {
    $data = jsonInput();
    $state = isset($data['state']) && is_array($data['state']) ? $data['state'] : null;
    if ($state === null) {
        respond(array('ok' => false, 'error' => 'state должен быть объектом'), 400);
    }

    $stateJson = json_encode($state, JSON_UNESCAPED_UNICODE);
    if ($stateJson === false) {
        respond(array('ok' => false, 'error' => 'Некорректные данные профиля'), 400);
    }

    $now = date('Y-m-d H:i:s');

    $exists = $mysqli->prepare('SELECT user_id FROM user_profiles WHERE user_id = ? LIMIT 1');
    $exists->bind_param('i', $userId);
    $exists->execute();
    $exists->store_result();
    $hasRow = $exists->num_rows > 0;
    $exists->close();

    if ($hasRow) {
        $update = $mysqli->prepare('UPDATE user_profiles SET state_json = ?, updated_at = ? WHERE user_id = ?');
        $update->bind_param('ssi', $stateJson, $now, $userId);
        $update->execute();
        $update->close();
    } else {
        $insert = $mysqli->prepare('INSERT INTO user_profiles (user_id, state_json, updated_at) VALUES (?, ?, ?)');
        $insert->bind_param('iss', $userId, $stateJson, $now);
        $insert->execute();
        $insert->close();
    }

    respond(array('ok' => true, 'updatedAt' => $now), 200);
}

respond(array('ok' => false, 'error' => 'Method not allowed'), 405);

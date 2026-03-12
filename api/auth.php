<?php
require __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? $_GET['action'] : 'me';

if ($method === 'GET' && $action === 'me') {
    if (!isset($_SESSION['user_id'])) {
        respond(array('ok' => true, 'authenticated' => false), 200);
    }

    $userId = (int)$_SESSION['user_id'];
    $stmt = dbPrepare($mysqli, 'SELECT email FROM users WHERE id = ? LIMIT 1');
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $stmt->bind_result($email);
    if (!$stmt->fetch()) {
        session_destroy();
        respond(array('ok' => true, 'authenticated' => false), 200);
    }
    $stmt->close();

    respond(array('ok' => true, 'authenticated' => true, 'user' => array('id' => $userId, 'email' => $email)), 200);
}

if ($method === 'POST' && $action === 'logout') {
    $_SESSION = array();
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $params['path'], $params['domain'],
            $params['secure'], $params['httponly']
        );
    }
    session_destroy();
    respond(array('ok' => true), 200);
}

if ($method !== 'POST') {
    respond(array('ok' => false, 'error' => 'Method not allowed'), 405);
}

$data = jsonInput();
$email = isset($data['email']) ? normalizeEmail($data['email']) : '';
$password = isset($data['password']) ? (string)$data['password'] : '';

if (!$email || strlen($password) < 4) {
    respond(array('ok' => false, 'error' => 'Некорректный email или пароль (минимум 4 символа)'), 400);
}

if ($action === 'register') {
    $check = dbPrepare($mysqli, 'SELECT id FROM users WHERE email = ? LIMIT 1');
    $check->bind_param('s', $email);
    $check->execute();
    $check->store_result();
    if ($check->num_rows > 0) {
        $check->close();
        respond(array('ok' => false, 'error' => 'Пользователь уже существует'), 409);
    }
    $check->close();

    $hash = password_hash($password, PASSWORD_BCRYPT);
    $now = date('Y-m-d H:i:s');
    $insert = dbPrepare($mysqli, 'INSERT INTO users (email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?)');
    $insert->bind_param('ssss', $email, $hash, $now, $now);
    if (!$insert->execute()) {
        $insert->close();
        respond(array('ok' => false, 'error' => 'Не удалось создать пользователя'), 500);
    }
    $userId = (int)$insert->insert_id;
    $insert->close();

    $_SESSION['user_id'] = $userId;
    respond(array('ok' => true, 'user' => array('id' => $userId, 'email' => $email)), 200);
}

if ($action === 'login') {
    $stmt = dbPrepare($mysqli, 'SELECT id, password_hash FROM users WHERE email = ? LIMIT 1');
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $stmt->bind_result($userId, $passwordHash);
    if (!$stmt->fetch()) {
        $stmt->close();
        respond(array('ok' => false, 'error' => 'Неверный email или пароль'), 401);
    }
    $stmt->close();

    if (!password_verify($password, $passwordHash)) {
        respond(array('ok' => false, 'error' => 'Неверный email или пароль'), 401);
    }

    $_SESSION['user_id'] = (int)$userId;
    respond(array('ok' => true, 'user' => array('id' => (int)$userId, 'email' => $email)), 200);
}

respond(array('ok' => false, 'error' => 'Unknown action'), 400);

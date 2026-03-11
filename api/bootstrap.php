<?php
header('Content-Type: application/json; charset=utf-8');

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$config = require __DIR__ . '/config.php';

$mysqli = new mysqli(
    $config['db_host'],
    $config['db_user'],
    $config['db_pass'],
    $config['db_name'],
    (int)$config['db_port']
);

if ($mysqli->connect_errno) {
    http_response_code(500);
    echo json_encode(array(
        'ok' => false,
        'error' => 'DB connection failed',
    ));
    exit;
}

$mysqli->set_charset('utf8mb4');

ensureSchema($mysqli);

function ensureSchema($mysqli) {
    $usersSql = "CREATE TABLE IF NOT EXISTS users (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

    $profilesSql = "CREATE TABLE IF NOT EXISTS user_profiles (
        user_id INT UNSIGNED NOT NULL PRIMARY KEY,
        state_json MEDIUMTEXT NOT NULL,
        updated_at DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

    $mysqli->query($usersSql);
    $mysqli->query($profilesSql);
}

function jsonInput() {
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return array();
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : array();
}

function respond($payload, $statusCode) {
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function requireAuth() {
    if (!isset($_SESSION['user_id'])) {
        respond(array('ok' => false, 'error' => 'Не авторизован'), 401);
    }
    return (int)$_SESSION['user_id'];
}

function normalizeEmail($email) {
    $normalized = trim(mb_strtolower($email, 'UTF-8'));
    if (!filter_var($normalized, FILTER_VALIDATE_EMAIL)) {
        return '';
    }
    return $normalized;
}

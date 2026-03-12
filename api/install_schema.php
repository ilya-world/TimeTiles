<?php
// One-time helper page to import api/schema.sql through browser and show detailed diagnostics.

header('Content-Type: text/html; charset=utf-8');

$config = require __DIR__ . '/config.php';
$schemaPath = __DIR__ . '/schema.sql';

$errors = array();
$messages = array();
$executed = array();

if (!file_exists($schemaPath)) {
    $errors[] = 'Файл schema.sql не найден: ' . htmlspecialchars($schemaPath, ENT_QUOTES, 'UTF-8');
}

$mysqli = @new mysqli(
    $config['db_host'],
    $config['db_user'],
    $config['db_pass'],
    $config['db_name'],
    (int)$config['db_port']
);

if ($mysqli->connect_errno) {
    $errors[] = 'Ошибка подключения к БД: [' . $mysqli->connect_errno . '] ' . htmlspecialchars($mysqli->connect_error, ENT_QUOTES, 'UTF-8');
}

if (!$errors) {
    if (!$mysqli->set_charset('utf8mb4')) {
        $errors[] = 'Не удалось установить utf8mb4: [' . $mysqli->errno . '] ' . htmlspecialchars($mysqli->error, ENT_QUOTES, 'UTF-8');
    }
}

if (!$errors) {
    $sql = file_get_contents($schemaPath);
    if ($sql === false) {
        $errors[] = 'Не удалось прочитать файл schema.sql';
    } else {
        $statements = array();
        $chunks = explode(';', $sql);
        foreach ($chunks as $chunk) {
            $stmt = trim($chunk);
            if ($stmt === '') {
                continue;
            }
            $statements[] = $stmt . ';';
        }

        if (count($statements) === 0) {
            $errors[] = 'В schema.sql не найдено SQL-команд для выполнения.';
        } else {
            foreach ($statements as $index => $statement) {
                $ok = $mysqli->query($statement);
                $executed[] = array(
                    'n' => $index + 1,
                    'sql' => $statement,
                    'ok' => (bool)$ok,
                    'errno' => (int)$mysqli->errno,
                    'error' => (string)$mysqli->error,
                );

                if (!$ok) {
                    $errors[] = 'SQL #' . ($index + 1) . ' завершился ошибкой: [' . $mysqli->errno . '] ' . htmlspecialchars($mysqli->error, ENT_QUOTES, 'UTF-8');
                }
            }

            if (!$errors) {
                $messages[] = 'Импорт схемы завершен успешно. Выполнено SQL-команд: ' . count($statements);
            }
        }
    }
}

if ($mysqli && !$mysqli->connect_errno) {
    $mysqli->close();
}

function h($value) {
    return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
}
?>
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TimeTiles — Импорт схемы БД</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; line-height: 1.4; }
    .ok { color: #0b7a26; }
    .err { color: #b00020; }
    pre { background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 6px; padding: 10px; white-space: pre-wrap; }
    .card { margin: 14px 0; padding: 12px; border: 1px solid #d0d7de; border-radius: 6px; }
  </style>
</head>
<body>
  <h1>Импорт схемы TimeTiles</h1>
  <p>Страница выполняет SQL из <code>api/schema.sql</code> и показывает подробный результат по каждой команде.</p>

  <?php foreach ($messages as $message): ?>
    <div class="card ok">✅ <?= h($message) ?></div>
  <?php endforeach; ?>

  <?php if ($errors): ?>
    <div class="card err">
      <h2>Ошибки</h2>
      <ul>
        <?php foreach ($errors as $error): ?>
          <li><?= $error ?></li>
        <?php endforeach; ?>
      </ul>
    </div>
  <?php endif; ?>

  <h2>Детальный журнал SQL</h2>
  <?php if (!$executed): ?>
    <div class="card">Нет выполненных SQL-команд.</div>
  <?php else: ?>
    <?php foreach ($executed as $row): ?>
      <div class="card">
        <strong>SQL #<?= h($row['n']) ?> — <?= $row['ok'] ? 'OK' : 'Ошибка' ?></strong>
        <?php if (!$row['ok']): ?>
          <div class="err">[<?= h($row['errno']) ?>] <?= h($row['error']) ?></div>
        <?php endif; ?>
        <pre><?= h($row['sql']) ?></pre>
      </div>
    <?php endforeach; ?>
  <?php endif; ?>

  <p><strong>Важно:</strong> после успешного импорта удалите эту страницу с сервера (или ограничьте доступ).</p>
</body>
</html>

<?php

declare(strict_types=1);

require __DIR__ . '/lib.php';

$name = sanitize_name((string)($_POST['name'] ?? ''));
$password = (string)($_POST['password'] ?? '');

if ($name === '' || $password === '') {
    json_response(['ok' => false, 'error' => 'Введите имя и пароль'], 422);
}
if (strlen($password) < 4) {
    json_response(['ok' => false, 'error' => 'Пароль должен быть не короче 4 символов'], 422);
}

$avatarUrl = '';
if (isset($_FILES['avatar']) && is_array($_FILES['avatar']) && (int)($_FILES['avatar']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
    $avatar = $_FILES['avatar'];
    if ((int)($avatar['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        json_response(['ok' => false, 'error' => 'Ошибка загрузки аватара'], 422);
    }

    $tmpName = (string)($avatar['tmp_name'] ?? '');
    $size = (int)($avatar['size'] ?? 0);
    if ($size <= 0 || $size > 5 * 1024 * 1024) {
        json_response(['ok' => false, 'error' => 'Аватар должен быть до 5MB'], 422);
    }

    $mime = mime_content_type($tmpName) ?: '';
    $extMap = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
    ];
    $ext = $extMap[$mime] ?? null;
    if ($ext === null) {
        json_response(['ok' => false, 'error' => 'Неподдерживаемый формат аватара'], 422);
    }

    ensure_media_dir();
    $filename = sprintf('avatar_%s_%s.%s', date('Ymd_His'), bin2hex(random_bytes(4)), $ext);
    $path = MEDIA_DIR . '/' . $filename;
    if (!move_uploaded_file($tmpName, $path)) {
        json_response(['ok' => false, 'error' => 'Не удалось сохранить аватар'], 500);
    }
    $avatarUrl = 'media/' . $filename;
}

$user = with_store(function (&$store) use ($name, $password, $avatarUrl) {
    if (find_user($store, $name)) {
        json_response(['ok' => false, 'error' => 'Такое имя уже занято'], 409);
    }

    $passwordHash = password_hash($password, PASSWORD_DEFAULT);
    $created = upsert_user($store, $name, $passwordHash, $avatarUrl);
    ensure_personal_chat($store, $name);

    return $created;
});

$_SESSION['username'] = $name;
json_response([
    'ok' => true,
    'user' => $name,
    'profile' => [
        'username' => $name,
        'avatar' => (string)($user['avatar'] ?? ''),
    ],
]);

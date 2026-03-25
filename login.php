<?php

declare(strict_types=1);

require __DIR__ . '/lib.php';

$body = read_json_body();
$name = sanitize_name((string)($body['name'] ?? ''));
$password = (string)($body['password'] ?? '');

if ($name === '' || $password === '') {
    json_response(['ok' => false, 'error' => 'Введите имя и пароль'], 422);
}
 
$user = with_store(function (&$store) use ($name, $password) {
    $existing = find_user($store, $name);
    if (!$existing) {
        json_response(['ok' => false, 'error' => 'Аккаунт не найден. Сначала зарегистрируйтесь.'], 404);
    }

    $passwordHash = (string)($existing['passwordHash'] ?? '');
    if (!empty($existing['blocked'])) {
        json_response(['ok' => false, 'error' => 'Аккаунт заблокирован администратором'], 403);
    }
    if ($passwordHash === '') {
        json_response(['ok' => false, 'error' => 'Для этого аккаунта не задан пароль. Создайте новый аккаунт.'], 422);
    }
    if (!password_verify($password, $passwordHash)) {
        json_response(['ok' => false, 'error' => 'Неверный пароль'], 401);
    }

    ensure_personal_chat($store, $name);
    return $existing;
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

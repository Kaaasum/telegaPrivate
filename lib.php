<?php

declare(strict_types=1);

session_start();

const DATA_FILE = __DIR__ . '/../data/store.json';
const MEDIA_DIR = __DIR__ . '/../media';

function json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return [];
    }

    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function ensure_store(): void
{
    if (file_exists(DATA_FILE)) {
        return;
    }

    $initial = [
        'users' => [],
        'chats' => [
            [
                'id' => 'general',
                'title' => 'Общий чат',
                'participants' => [],
                'updatedAt' => time(),
            ],
        ],
        'messages' => [
            'general' => [
                [
                    'id' => 'msg-' . bin2hex(random_bytes(6)),
                    'author' => 'System',
                    'text' => 'Добро пожаловать в личный мессенджер.',
                    'createdAt' => time(),
                ],
            ],
        ],
    ];

    file_put_contents(DATA_FILE, json_encode($initial, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function normalize_store_users(array &$store): void
{
    $users = $store['users'] ?? [];
    $normalized = [];
    $seen = [];

    if (!is_array($users)) {
        $users = [];
    }

    foreach ($users as $item) {
        if (is_string($item)) {
            $username = sanitize_name($item);
            if ($username === '') {
                continue;
            }
            $key = username_key($username);
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $normalized[] = [
                'username' => $username,
                'passwordHash' => '',
                'avatar' => '',
                'blocked' => false,
                'createdAt' => time(),
            ];
            continue;
        }

        if (!is_array($item)) {
            continue;
        }

        $username = sanitize_name((string)($item['username'] ?? ''));
        if ($username === '') {
            continue;
        }

        $key = username_key($username);
        if (isset($seen[$key])) {
            continue;
        }
        $seen[$key] = true;

        $normalized[] = [
            'username' => $username,
            'passwordHash' => (string)($item['passwordHash'] ?? ''),
            'avatar' => (string)($item['avatar'] ?? ''),
            'blocked' => !empty($item['blocked']),
            'createdAt' => (int)($item['createdAt'] ?? time()),
        ];
    }

    $store['users'] = $normalized;
}

function migrate_legacy_general_chat(array &$store): void
{
    $meta = $store['meta'] ?? [];
    if (is_array($meta) && !empty($meta['personalHistoryMigrationDone'])) {
        return;
    }

    if (!isset($store['chats']) || !is_array($store['chats'])) {
        $store['meta']['personalHistoryMigrationDone'] = true;
        return;
    }

    $generalIndex = null;
    foreach ($store['chats'] as $i => $chat) {
        if (($chat['id'] ?? '') === 'general') {
            $generalIndex = $i;
            break;
        }
    }

    if ($generalIndex === null) {
        $store['meta']['personalHistoryMigrationDone'] = true;
        return;
    }

    $generalMessages = $store['messages']['general'] ?? [];
    if (!is_array($generalMessages)) {
        $generalMessages = [];
    }

    foreach ($generalMessages as $message) {
        if (!is_array($message)) {
            continue;
        }
        $author = sanitize_name((string)($message['author'] ?? ''));
        if ($author === '' || $author === 'System') {
            continue;
        }

        upsert_user($store, $author, null, null);
        $personalChat = ensure_personal_chat($store, $author);
        $chatId = (string)($personalChat['id'] ?? '');
        if ($chatId === '') {
            continue;
        }

        if (!isset($store['messages'][$chatId]) || !is_array($store['messages'][$chatId])) {
            $store['messages'][$chatId] = [];
        }
        $store['messages'][$chatId][] = $message;
    }

    $store['messages']['general'] = [];
    $store['chats'][$generalIndex]['participants'] = [];
    $store['chats'][$generalIndex]['updatedAt'] = time();
    $store['meta']['personalHistoryMigrationDone'] = true;
}

function with_store(callable $callback)
{
    ensure_store();
    $fp = fopen(DATA_FILE, 'c+');
    if (!$fp) {
        json_response(['ok' => false, 'error' => 'Не удалось открыть хранилище'], 500);
    }

    flock($fp, LOCK_EX);
    $raw = stream_get_contents($fp);
    $store = json_decode($raw ?: '{}', true);
    if (!is_array($store)) {
        $store = ['users' => [], 'chats' => [], 'messages' => []];
    }
    normalize_store_users($store);
    migrate_legacy_general_chat($store);

    $result = $callback($store);

    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);

    return $result;
}

function current_user(): ?string
{
    $name = $_SESSION['username'] ?? null;
    return is_string($name) && $name !== '' ? $name : null;
}

function require_user(): string
{
    $name = current_user();
    if ($name === null) {
        json_response(['ok' => false, 'error' => 'Требуется вход'], 401);
    }

    $status = with_store(function (&$store) use ($name) {
        $user = find_user($store, $name);
        if (!$user) {
            return 'missing';
        }
        if (!empty($user['blocked'])) {
            return 'blocked';
        }
        return 'ok';
    });

    if ($status !== 'ok') {
        unset($_SESSION['username']);
        if ($status === 'blocked') {
            json_response(['ok' => false, 'error' => 'Ваш аккаунт заблокирован'], 403);
        }
        json_response(['ok' => false, 'error' => 'Аккаунт не найден'], 401);
    }

    return $name;
}

function sanitize_name(string $name): string
{
    $name = trim($name);
    $name = preg_replace('/\s+/', ' ', $name ?? '');
    return text_slice($name, 40);
}

function sanitize_text(string $text): string
{
    $text = trim($text);
    return text_slice($text, 2000);
}

function personal_chat_id(string $username): string
{
    return 'saved-' . substr(hash('sha256', username_key($username)), 0, 16);
}

function ensure_personal_chat(array &$store, string $username): array
{
    $chatId = personal_chat_id($username);

    foreach (($store['chats'] ?? []) as $chat) {
        if (($chat['id'] ?? '') === $chatId) {
            return $chat;
        }
    }

    $chat = [
        'id' => $chatId,
        'title' => 'Избранное',
        'participants' => [$username],
        'isPersonal' => true,
        'updatedAt' => time(),
    ];

    $store['chats'][] = $chat;
    if (!isset($store['messages'][$chatId]) || !is_array($store['messages'][$chatId])) {
        $store['messages'][$chatId] = [];
    }

    return $chat;
}

function chat_visible_for_user(array $chat, string $username): bool
{
    $participants = $chat['participants'] ?? [];
    if (!is_array($participants)) {
        return false;
    }

    return in_array($username, $participants, true);
}

function ensure_media_dir(): void
{
    if (is_dir(MEDIA_DIR)) {
        return;
    }

    mkdir(MEDIA_DIR, 0775, true);
}

function find_chat_index_for_user(array $store, string $chatId, string $user): int
{
    foreach ($store['chats'] as $i => $chat) {
        if (($chat['id'] ?? '') !== $chatId) {
            continue;
        }

        if (!chat_visible_for_user($chat, $user)) {
            json_response(['ok' => false, 'error' => 'Нет доступа к чату'], 403);
        }

        return $i;
    }

    json_response(['ok' => false, 'error' => 'Чат не найден'], 404);
}

function append_message(array &$store, int $chatIndex, array $message): void
{
    $chatId = $store['chats'][$chatIndex]['id'] ?? '';
    if ($chatId === '') {
        json_response(['ok' => false, 'error' => 'Некорректный чат'], 500);
    }

    if (!isset($store['messages'][$chatId]) || !is_array($store['messages'][$chatId])) {
        $store['messages'][$chatId] = [];
    }

    $store['messages'][$chatId][] = $message;
    $store['chats'][$chatIndex]['updatedAt'] = time();
}

function delete_media_for_message(array $message): void
{
    $url = (string)($message['media']['url'] ?? '');
    if ($url === '' || str_contains($url, '..')) {
        return;
    }

    if (!str_starts_with($url, 'media/')) {
        return;
    }

    $basename = basename($url);
    $path = MEDIA_DIR . '/' . $basename;
    if (is_file($path)) {
        @unlink($path);
    }
}

function text_slice(string $value, int $length): string
{
    if ($length <= 0) {
        return '';
    }

    if (function_exists('mb_substr')) {
        return mb_substr($value, 0, $length);
    }

    return substr($value, 0, $length);
}

function username_key(string $username): string
{
    $username = trim($username);
    if (function_exists('mb_strtolower')) {
        return mb_strtolower($username);
    }
    return strtolower($username);
}

function find_user_index(array $store, string $username): ?int
{
    $target = username_key($username);
    foreach (($store['users'] ?? []) as $i => $user) {
        if (!is_array($user)) {
            continue;
        }
        $name = (string)($user['username'] ?? '');
        if (username_key($name) === $target) {
            return $i;
        }
    }
    return null;
}

function find_user(array $store, string $username): ?array
{
    $i = find_user_index($store, $username);
    if ($i === null) {
        return null;
    }
    return is_array($store['users'][$i]) ? $store['users'][$i] : null;
}

function upsert_user(
    array &$store,
    string $username,
    ?string $passwordHash = null,
    ?string $avatar = null,
    ?bool $blocked = null,
    ?int $createdAt = null
): array
{
    $i = find_user_index($store, $username);
    if ($i === null) {
        $user = [
            'username' => $username,
            'passwordHash' => $passwordHash ?? '',
            'avatar' => $avatar ?? '',
            'blocked' => $blocked ?? false,
            'createdAt' => $createdAt ?? time(),
        ];
        $store['users'][] = $user;
        return $user;
    }

    if (!is_array($store['users'][$i])) {
        $store['users'][$i] = [
            'username' => $username,
            'passwordHash' => '',
            'avatar' => '',
            'blocked' => false,
            'createdAt' => time(),
        ];
    }

    if ($passwordHash !== null) {
        $store['users'][$i]['passwordHash'] = $passwordHash;
    }
    if ($avatar !== null) {
        $store['users'][$i]['avatar'] = $avatar;
    }
    if ($blocked !== null) {
        $store['users'][$i]['blocked'] = $blocked;
    }
    if ($createdAt !== null) {
        $store['users'][$i]['createdAt'] = $createdAt;
    }

    return $store['users'][$i];
}

function user_avatar_url(array $store, string $username): string
{
    $user = find_user($store, $username);
    return is_array($user) ? (string)($user['avatar'] ?? '') : '';
}

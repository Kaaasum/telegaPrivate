<?php

declare(strict_types=1);

require __DIR__ . '/lib.php';

$user = require_user();
$chatId = (string)($_GET['chat'] ?? '');

if ($chatId === '') {
    json_response(['ok' => false, 'error' => 'Чат не указан'], 422);
}

$messages = with_store(function (&$store) use ($chatId, $user) {
    $chat = null;
    foreach ($store['chats'] as $item) {
        if (($item['id'] ?? '') === $chatId) {
            $chat = $item;
            break;
        }
    }

    if (!$chat || !chat_visible_for_user($chat, $user)) {
        json_response(['ok' => false, 'error' => 'Нет доступа к чату'], 403);
    }

    $messages = $store['messages'][$chatId] ?? [];
    if (!is_array($messages)) {
        return [];
    }

    foreach ($messages as &$m) {
        if (!is_array($m)) {
            continue;
        }
        $author = (string)($m['author'] ?? '');
        $m['authorAvatar'] = $author !== '' ? user_avatar_url($store, $author) : '';
    }

    return $messages;
});

json_response(['ok' => true, 'items' => $messages]);

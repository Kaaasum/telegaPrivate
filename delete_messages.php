<?php

declare(strict_types=1);

require __DIR__ . '/lib.php';

$user = require_user();
$body = read_json_body();
$chatId = (string)($body['chat'] ?? '');
$ids = $body['ids'] ?? [];

if ($chatId === '' || !is_array($ids) || $ids === []) {
    json_response(['ok' => false, 'error' => 'Нужны chat и ids'], 422);
}

$idsSet = [];
foreach ($ids as $id) {
    if (!is_string($id) || $id === '') {
        continue;
    }
    $idsSet[$id] = true;
}

if ($idsSet === []) {
    json_response(['ok' => false, 'error' => 'Некорректные ids'], 422);
}

$result = with_store(function (&$store) use ($user, $chatId, $idsSet) {
    $chatIndex = find_chat_index_for_user($store, $chatId, $user);
    $chatMessages = $store['messages'][$chatId] ?? [];

    if (!is_array($chatMessages)) {
        $chatMessages = [];
    }

    $remaining = [];
    $deleted = 0;

    foreach ($chatMessages as $message) {
        $id = (string)($message['id'] ?? '');
        $author = (string)($message['author'] ?? '');

        if ($id !== '' && isset($idsSet[$id]) && $author === $user) {
            delete_media_for_message($message);
            $deleted++;
            continue;
        }

        $remaining[] = $message;
    }

    $store['messages'][$chatId] = $remaining;
    $last = end($remaining);
    $store['chats'][$chatIndex]['updatedAt'] = is_array($last)
        ? (int)($last['createdAt'] ?? time())
        : time();

    return ['deleted' => $deleted];
});

json_response(['ok' => true, 'deleted' => $result['deleted'] ?? 0]);

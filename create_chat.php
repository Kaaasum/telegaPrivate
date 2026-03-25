<?php

declare(strict_types=1);

require __DIR__ . '/lib.php';

$user = require_user();
$body = read_json_body();
$peer = sanitize_name((string)($body['peer'] ?? ''));

if ($peer === '') {
    json_response(['ok' => false, 'error' => 'Укажите имя собеседника'], 422);
}

if ($peer === $user) {
    json_response(['ok' => false, 'error' => 'Нельзя создать чат с самим собой'], 422);
}

$chat = with_store(function (&$store) use ($user, $peer) {
    $peerUser = find_user($store, $peer);
    if (!$peerUser) {
        json_response(['ok' => false, 'error' => 'Пользователь не найден'], 404);
    }
    if (!empty($peerUser['blocked'])) {
        json_response(['ok' => false, 'error' => 'Пользователь заблокирован'], 403);
    }

    foreach ($store['chats'] as $item) {
        if (($item['id'] ?? '') === 'general') {
            continue;
        }

        $participants = $item['participants'] ?? [];
        if (count($participants) === 2 && in_array($user, $participants, true) && in_array($peer, $participants, true)) {
            return $item;
        }
    }

    $id = 'chat-' . bin2hex(random_bytes(6));
    $title = "$user / $peer";

    $chat = [
        'id' => $id,
        'title' => $title,
        'participants' => [$user, $peer],
        'updatedAt' => time(),
    ];

    $store['chats'][] = $chat;
    $store['messages'][$id] = [
        [
            'id' => 'msg-' . bin2hex(random_bytes(6)),
            'author' => 'System',
            'text' => "Чат между $user и $peer создан.",
            'createdAt' => time(),
        ],
    ];

    return $chat;
});

json_response(['ok' => true, 'chat' => $chat]);

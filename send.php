<?php

declare(strict_types=1);

require __DIR__ . '/lib.php';

$user = require_user();
$body = read_json_body();
$chatId = (string)($body['chat'] ?? '');
$text = sanitize_text((string)($body['text'] ?? ''));
$replyRaw = $body['reply'] ?? null;

if ($chatId === '' || $text === '') {
    json_response(['ok' => false, 'error' => 'Заполните чат и текст'], 422);
}

$reply = null;
if (is_array($replyRaw)) {
    $replyAuthor = sanitize_name((string)($replyRaw['author'] ?? ''));
    $replyText = sanitize_text((string)($replyRaw['text'] ?? ''));
    $replyId = trim((string)($replyRaw['id'] ?? ''));
    if ($replyAuthor !== '' && $replyText !== '') {
        $reply = [
            'id' => text_slice($replyId, 80),
            'author' => $replyAuthor,
            'text' => text_slice($replyText, 200),
        ];
    }
}

$message = with_store(function (&$store) use ($chatId, $text, $user, $reply) {
    $chatIndex = find_chat_index_for_user($store, $chatId, $user);

    $message = [
        'id' => 'msg-' . bin2hex(random_bytes(6)),
        'author' => $user,
        'authorAvatar' => user_avatar_url($store, $user),
        'type' => 'text',
        'text' => $text,
        'createdAt' => time(),
    ];
    if ($reply !== null) {
        $message['reply'] = $reply;
    }
    append_message($store, $chatIndex, $message);

    return $message;
});

json_response(['ok' => true, 'item' => $message]);

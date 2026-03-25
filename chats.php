<?php

declare(strict_types=1);

require __DIR__ . '/lib.php';

$user = require_user();

$chats = with_store(function (&$store) use ($user) {
    $result = [];

    foreach ($store['chats'] as $chat) {
        if (!chat_visible_for_user($chat, $user)) {
            continue;
        }

        $messages = $store['messages'][$chat['id']] ?? [];
        $last = end($messages);
        $lastText = '';
        if (is_array($last)) {
            $lastText = (string)($last['text'] ?? '');
            if ($lastText === '') {
                $type = (string)($last['type'] ?? 'text');
                $lastText = match ($type) {
                    'image' => '[Фото]',
                    'audio' => '[Голосовое сообщение]',
                    'video' => '[Видео-кружок]',
                    default => '',
                };
            }
        }
        $chatTitle = (string)($chat['title'] ?? 'Чат');
        $avatar = '';
        $participants = $chat['participants'] ?? [];
        $isPersonal = !empty($chat['isPersonal']);
        if ($isPersonal) {
            $chatTitle = 'Избранное';
            $avatar = '';
        } elseif (is_array($participants)) {
            foreach ($participants as $p) {
                if ((string)$p === $user) {
                    continue;
                }
                $peerName = (string)$p;
                if ($peerName !== '') {
                    $chatTitle = $peerName;
                }
                $avatar = user_avatar_url($store, $peerName);
                break;
            }
        }

        $result[] = [
            'id' => $chat['id'],
            'title' => $chatTitle,
            'lastMessage' => $lastText,
            'updatedAt' => $chat['updatedAt'] ?? 0,
            'avatar' => $avatar,
        ];
    }

    usort($result, fn($a, $b) => ($b['updatedAt'] <=> $a['updatedAt']));
    return $result;
});

json_response(['ok' => true, 'items' => $chats]);

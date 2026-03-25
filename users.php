<?php

declare(strict_types=1);

require __DIR__ . '/lib.php';

$user = require_user();
$q = sanitize_name((string)($_GET['q'] ?? ''));
$qKey = username_key($q);

$items = with_store(function (&$store) use ($user, $qKey) {
    $result = [];

    foreach (($store['users'] ?? []) as $u) {
        if (!is_array($u)) {
            continue;
        }

        $username = sanitize_name((string)($u['username'] ?? ''));
        if ($username === '' || username_key($username) === username_key($user)) {
            continue;
        }
        if (!empty($u['blocked'])) {
            continue;
        }

        if ($qKey !== '' && !str_contains(username_key($username), $qKey)) {
            continue;
        }

        $chatId = null;
        foreach (($store['chats'] ?? []) as $chat) {
            if (!is_array($chat) || !empty($chat['isPersonal'])) {
                continue;
            }
            $participants = $chat['participants'] ?? [];
            if (!is_array($participants) || count($participants) !== 2) {
                continue;
            }
            if (in_array($user, $participants, true) && in_array($username, $participants, true)) {
                $chatId = (string)($chat['id'] ?? '');
                break;
            }
        }

        $result[] = [
            'username' => $username,
            'avatar' => (string)($u['avatar'] ?? ''),
            'chatId' => $chatId,
        ];
    }

    usort($result, fn($a, $b) => strcmp(username_key((string)$a['username']), username_key((string)$b['username'])));
    return array_slice($result, 0, 40);
});

json_response(['ok' => true, 'items' => $items]);

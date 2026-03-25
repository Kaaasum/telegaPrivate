<?php

declare(strict_types=1);

require __DIR__ . '/lib.php';

$name = current_user();
$profile = null;
if ($name !== null) {
    $profile = with_store(function (&$store) use ($name) {
        $u = find_user($store, $name);
        return [
            'username' => $name,
            'avatar' => is_array($u) ? (string)($u['avatar'] ?? '') : '',
        ];
    });
}

json_response(['ok' => true, 'user' => $name, 'profile' => $profile]);

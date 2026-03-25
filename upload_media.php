<?php

declare(strict_types=1);

require __DIR__ . '/lib.php';

$user = require_user();
$chatId = (string)($_POST['chat'] ?? '');
$kind = (string)($_POST['kind'] ?? '');

if ($chatId === '' || $kind === '') {
    json_response(['ok' => false, 'error' => 'Нужны chat и kind'], 422);
}

$allowedKinds = ['image', 'audio', 'video'];
if (!in_array($kind, $allowedKinds, true)) {
    json_response(['ok' => false, 'error' => 'Неподдерживаемый тип медиа'], 422);
}

if (!isset($_FILES['file']) || !is_array($_FILES['file'])) {
    json_response(['ok' => false, 'error' => 'Файл не передан'], 422);
}

$file = $_FILES['file'];
if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    $errorCode = (int)($file['error'] ?? UPLOAD_ERR_NO_FILE);
    $knownErrors = [
        UPLOAD_ERR_INI_SIZE => 'Файл больше лимита PHP (upload_max_filesize).',
        UPLOAD_ERR_FORM_SIZE => 'Файл больше лимита формы.',
        UPLOAD_ERR_PARTIAL => 'Файл загружен частично.',
        UPLOAD_ERR_NO_FILE => 'Файл не был загружен.',
        UPLOAD_ERR_NO_TMP_DIR => 'На сервере нет временной папки для загрузки.',
        UPLOAD_ERR_CANT_WRITE => 'Не удалось записать файл на диск.',
        UPLOAD_ERR_EXTENSION => 'Загрузка остановлена PHP-расширением.',
    ];
    $phpLimits = sprintf(
        'Текущие лимиты: upload_max_filesize=%s, post_max_size=%s.',
        (string)ini_get('upload_max_filesize'),
        (string)ini_get('post_max_size')
    );
    $details = $knownErrors[$errorCode] ?? ('Неизвестная ошибка загрузки (код ' . $errorCode . ').');
    json_response(['ok' => false, 'error' => $details . ' ' . $phpLimits], 422);
}

$tmpName = (string)($file['tmp_name'] ?? '');
$size = (int)($file['size'] ?? 0);
$maxSize = 100 * 1024 * 1024;
if ($size <= 0 || $size > $maxSize) {
    json_response(['ok' => false, 'error' => 'Файл пустой или слишком большой (до 100MB)'], 422);
}

$mime = mime_content_type($tmpName) ?: 'application/octet-stream';

$mimeMap = [
    'image' => [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
    ],
    'audio' => [
        'audio/webm' => 'webm',
        'audio/ogg' => 'ogg',
        'audio/mp4' => 'm4a',
        'audio/mpeg' => 'mp3',
        'audio/wav' => 'wav',
    ],
    'video' => [
        'video/webm' => 'webm',
        'video/mp4' => 'mp4',
        'video/ogg' => 'ogv',
    ],
];

$extension = $mimeMap[$kind][$mime] ?? null;
if ($extension === null) {
    json_response(['ok' => false, 'error' => 'Неподдерживаемый формат файла'], 422);
}

ensure_media_dir();
$filename = sprintf('%s_%s_%s.%s', $kind, date('Ymd_His'), bin2hex(random_bytes(5)), $extension);
$destination = MEDIA_DIR . '/' . $filename;

if (!move_uploaded_file($tmpName, $destination)) {
    json_response(['ok' => false, 'error' => 'Не удалось сохранить файл'], 500);
}

$message = with_store(function (&$store) use ($chatId, $user, $kind, $filename, $mime, $size) {
    $chatIndex = find_chat_index_for_user($store, $chatId, $user);

    $labels = [
        'image' => '[Фото]',
        'audio' => '[Голосовое сообщение]',
        'video' => '[Видео-кружок]',
    ];

    $message = [
        'id' => 'msg-' . bin2hex(random_bytes(6)),
        'author' => $user,
        'authorAvatar' => user_avatar_url($store, $user),
        'type' => $kind,
        'text' => $labels[$kind] ?? '[Медиа]',
        'media' => [
            'url' => 'media/' . $filename,
            'mime' => $mime,
            'size' => $size,
        ],
        'createdAt' => time(),
    ];

    append_message($store, $chatIndex, $message);
    return $message;
});

json_response(['ok' => true, 'item' => $message]);

<?php

declare(strict_types=1);

require __DIR__ . '/lib.php';

session_destroy();
json_response(['ok' => true]);

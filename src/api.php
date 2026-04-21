<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/mvc/NodeController.php';

(new NodeController())->handle($_GET['action'] ?? '');

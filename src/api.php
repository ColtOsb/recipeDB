<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

require_once __DIR__ . "/controllers/NodeController.php";

$controller = new NodeController();
$controller->handle($_GET["action"] ?? "");

<?php
// ─── DB CREDENTIALS ─── swap these to match  setup ----───────────────────────
define("DB_HOST", "localhost");
define("DB_USER", "root");
define("DB_PASS", "");
define("DB_NAME", "recipe");
// ─────────────────────────────────────────────────────────────────────────────

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode([
        "error" => "DB connection failed: " . $conn->connect_error,
    ]);
    exit();
}

$action = $_GET["action"] ?? "";

switch ($action) {
    // GET /api.php?action=nodes
    // Optional filters: ?type=Recipe  &search=pasta
    case "nodes":
        $type = $_GET["type"] ?? "";
        $search = $_GET["search"] ?? "";

        $sql = "SELECT node_id, node_type, node_name FROM node WHERE 1=1";
        $params = [];
        $types = "";

        if ($type !== "") {
            $sql .= " AND node_type = ?";
            $params[] = $type;
            $types .= "s";
        }
        if ($search !== "") {
            $sql .= " AND node_name LIKE ?";
            $params[] = "%" . $search . "%";
            $types .= "s";
        }

        $sql .= " ORDER BY node_type, node_name LIMIT 200";

        $stmt = $conn->prepare($sql);
        if ($params) {
            $stmt->bind_param($types, ...$params);
        }
        $stmt->execute();
        $result = $stmt->get_result();

        $nodes = [];
        while ($row = $result->fetch_assoc()) {
            $nodes[] = $row;
        }
        echo json_encode($nodes);
        break;

    // GET /api.php?action=node_types
    // Returns distinct node_type values for the filter dropdown
    case "node_types":
        $result = $conn->query(
            "SELECT DISTINCT node_type FROM node ORDER BY node_type",
        );
        $types = [];
        while ($row = $result->fetch_assoc()) {
            $types[] = $row["node_type"];
        }
        echo json_encode($types);
        break;

    // GET /api.php?action=edges&id=42
    // Returns all edges connected to a node (incoming + outgoing)
    case "edges":
        $id = intval($_GET["id"] ?? 0);
        if ($id <= 0) {
            echo json_encode(["error" => "Invalid node id"]);
            break;
        }

        $sql = '
            SELECT
                e.edge_id,
                e.edge_type,
                e.source_id,
                src.node_name AS source_name,
                src.node_type AS source_type,
                e.target_id,
                tgt.node_name AS target_name,
                tgt.node_type AS target_type
            FROM edge e
            JOIN node src ON e.source_id = src.node_id
            JOIN node tgt ON e.target_id = tgt.node_id
            WHERE e.source_id = ? OR e.target_id = ?
            ORDER BY e.edge_type
        ';

        $stmt = $conn->prepare($sql);
        $stmt->bind_param("ii", $id, $id);
        $stmt->execute();
        $result = $stmt->get_result();

        $edges = [];
        while ($row = $result->fetch_assoc()) {
            $edges[] = $row;
        }
        echo json_encode($edges);
        break;

    default:
        http_response_code(400);
        echo json_encode(["error" => "Unknown action"]);
        break;
}

$conn->close();

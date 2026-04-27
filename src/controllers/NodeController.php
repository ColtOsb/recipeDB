<?php
require_once __DIR__ . "/../models/NodeModel.php";

class NodeController
{
    private NodeModel $model;

    public function __construct()
    {
        $this->model = new NodeModel();
    }

    public function handle(string $action): void
    {
        switch ($action) {
            case "node_types":
                echo json_encode($this->model->getTypes());
                break;

            case "nodes":
                $type = $_GET["type"] ?? "";
                $search = $_GET["search"] ?? "";
                $nodes = $this->model->getNodes($type, $search);
                // 👇 debug added
                error_log(
                    "NodeController::handle nodes count for type='$type', search='$search': " .
                        count($nodes),
                );
                $json = json_encode($nodes);
                error_log(
                    "NodeController::handle -> type='$type', nodes count: " .
                        count($nodes) .
                        ", json length: " .
                        strlen($json),
                );
                echo $json;
                break;

            case "edges":
                $id = intval($_GET["id"] ?? 0);
                if ($id <= 0) {
                    echo json_encode(["error" => "Invalid node id"]);
                    break;
                }
                echo json_encode($this->model->getEdges($id));
                break;

            default:
                http_response_code(400);
                echo json_encode(["error" => "Unknown action"]);
        }
    }
}

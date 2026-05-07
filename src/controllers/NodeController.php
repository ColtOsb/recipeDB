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

            case "recipe_search":
                $q = trim($_GET["q"] ?? "");
                if (strlen($q) < 2) {
                    echo json_encode([]);
                    break;
                }
                echo json_encode($this->model->searchRecipes($q));
                break;

            case "influence_network":
                $recipeId = intval($_GET["recipe_id"] ?? 0);
                if ($recipeId <= 0) {
                    echo json_encode(["error" => "Invalid recipe_id"]);
                    break;
                }
                echo json_encode($this->model->getInfluenceNetwork($recipeId));
                break;

            case "accessibility_index":
                echo json_encode($this->model->getAccessibilityIndex());
                break;

            case "ingredient_search":
                $q = trim($_GET["q"] ?? "");
                if (strlen($q) < 2) {
                    echo json_encode([]);
                    break;
                }
                echo json_encode($this->model->searchIngredients($q));
                break;

            case "ingredient_cooccurrence":
                $ingredientId = intval($_GET["ingredient_id"] ?? 0);
                $minCount     = max(1, intval($_GET["min_count"] ?? 2));
                $limit        = min(100, max(1, intval($_GET["limit"] ?? 60)));
                if ($ingredientId <= 0) {
                    echo json_encode(["error" => "Invalid ingredient_id"]);
                    break;
                }
                echo json_encode($this->model->getCooccurrence($ingredientId, $minCount, $limit));
                break;

            default:
                http_response_code(400);
                echo json_encode(["error" => "Unknown action"]);
        }
    }
}

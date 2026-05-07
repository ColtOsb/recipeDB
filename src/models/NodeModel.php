<?php
require_once __DIR__ . "/Database.php";

class NodeModel
{
    private mysqli $db;

    public function __construct()
    {
        $this->db = Database::get();
    }

    public function getTypes(): array
    {
        $result = $this->db->query(
            "SELECT DISTINCT node_type FROM node ORDER BY node_type",
        );
        return array_column($result->fetch_all(MYSQLI_ASSOC), "node_type");
    }

    public function getNodes(string $type = "", string $search = ""): array
    {
        $sql = "SELECT n.node_id, n.node_type,
                        COALESCE(r.title, i.name, ci.name, cuis.name, 'Unknown') AS node_name
                    FROM node n
                    LEFT JOIN recipe_details              r    ON n.node_id = r.node_id
                    LEFT JOIN ingredient_details          i    ON n.node_id = i.node_id
                    LEFT JOIN compound_ingredient_details ci   ON n.node_id = ci.node_id
                    LEFT JOIN cuisine_details             cuis ON n.node_id = cuis.node_id
                    WHERE 1=1";

        $params = [];
        $types = "";

        if ($type) {
            $sql .= " AND n.node_type = ?";
            $params[] = $type;
            $types .= "s";
        }
        if ($search) {
            $sql .=
                " AND COALESCE(r.title, i.name, ci.name, cuis.name, '') LIKE ?";
            $params[] = "%$search%";
            $types .= "s";
        }
        $sql .= " ORDER BY n.node_type, node_name LIMIT 200";

        // Debug: print the SQL
        error_log(
            "NodeModel::getNodes SQL: " .
                $sql .
                " | type='$type' | search='$search'",
        );

        $stmt = $this->db->prepare($sql);
        if (!$stmt) {
            error_log("NodeModel::getNodes prepare error: " . $this->db->error);
            return [];
        }

        if ($params) {
            $stmt->bind_param($types, ...$params);
        }

        $stmt->execute();
        if ($stmt->error) {
            error_log("NodeModel::getNodes execute error: " . $stmt->error);
            return [];
        }

        $result = $stmt->get_result();

        // Log how many rows we actually got
        $num_rows = $result ? $result->num_rows : 0;
        error_log("NodeModel::getNodes num_rows: " . $num_rows);

        return $result ? $result->fetch_all(MYSQLI_ASSOC) : [];
    }

    public function searchRecipes(string $query): array
    {
        $sql = "SELECT r.node_id, r.title
                FROM recipe_details r
                JOIN node n ON r.node_id = n.node_id
                WHERE n.node_type = 'recipe'
                  AND r.title LIKE ?
                ORDER BY r.title
                LIMIT 20";

        $stmt = $this->db->prepare($sql);
        if (!$stmt) {
            error_log("NodeModel::searchRecipes prepare error: " . $this->db->error);
            return [];
        }
        $like = "%$query%";
        $stmt->bind_param("s", $like);
        $stmt->execute();
        return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    }

    public function getInfluenceNetwork(int $recipeId): array
    {
        $sql = "WITH ingredient_counts AS (
                    SELECT source_id AS recipe_id,
                           COUNT(*) AS ing_count
                    FROM edge
                    WHERE edge_type = 'contains'
                    GROUP BY source_id
                ),
                complex_recipes AS (
                    SELECT recipe_id
                    FROM (
                        SELECT recipe_id,
                               NTILE(4) OVER (ORDER BY ing_count) AS quartile
                        FROM ingredient_counts
                    ) ranked
                    WHERE quartile = 4
                )
                SELECT rd.title AS influenced_recipe,
                       cr.recipe_id,
                       COUNT(*) AS shared_ingredients
                FROM complex_recipes cr
                JOIN edge e1 ON e1.source_id = cr.recipe_id
                             AND e1.edge_type = 'contains'
                JOIN edge e2 ON e2.target_id = e1.target_id
                             AND e2.edge_type = 'contains'
                             AND e2.source_id != cr.recipe_id
                JOIN recipe_details rd ON rd.node_id = cr.recipe_id
                WHERE e2.source_id = ?
                GROUP BY cr.recipe_id, rd.title
                HAVING COUNT(*) >= 2
                ORDER BY shared_ingredients DESC
                LIMIT 15";

        $stmt = $this->db->prepare($sql);
        if (!$stmt) {
            error_log("NodeModel::getInfluenceNetwork prepare error: " . $this->db->error);
            return [];
        }
        $stmt->bind_param("i", $recipeId);
        $stmt->execute();
        if ($stmt->error) {
            error_log("NodeModel::getInfluenceNetwork execute error: " . $stmt->error);
            return [];
        }
        return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    }

    public function getAccessibilityIndex(): array
    {
        $sql = "WITH popular AS (
                    SELECT target_id
                    FROM edge
                    WHERE edge_type = 'contains'
                    GROUP BY target_id
                    HAVING COUNT(*) >= 10
                ),
                recipe_popular_counts AS (
                    SELECT e.source_id AS recipe_id,
                           e.target_id AS ingredient_id,
                           COUNT(*) OVER (
                               PARTITION BY e.source_id
                           ) AS popular_count
                    FROM edge e
                    JOIN popular p ON p.target_id = e.target_id
                    WHERE e.edge_type = 'contains'
                )
                SELECT i.name,
                       COUNT(*) AS accessibility_index
                FROM recipe_popular_counts rpc
                JOIN ingredient_details i ON i.node_id = rpc.ingredient_id
                WHERE rpc.popular_count >= 5
                GROUP BY rpc.ingredient_id, i.name
                HAVING COUNT(*) >= 5
                ORDER BY accessibility_index DESC
                LIMIT 100";

        $result = $this->db->query($sql);
        if (!$result) {
            error_log("NodeModel::getAccessibilityIndex error: " . $this->db->error);
            return [];
        }
        return $result->fetch_all(MYSQLI_ASSOC);
    }

    public function searchIngredients(string $query): array
    {
        $sql = "SELECT i.node_id, i.name, COALESCE(i.category, '') AS category
                FROM ingredient_details i
                JOIN node n ON i.node_id = n.node_id
                WHERE n.node_type = 'ingredient'
                  AND i.name LIKE ?
                ORDER BY i.name
                LIMIT 20";

        $stmt = $this->db->prepare($sql);
        if (!$stmt) {
            error_log("NodeModel::searchIngredients prepare error: " . $this->db->error);
            return [];
        }
        $like = "%$query%";
        $stmt->bind_param("s", $like);
        $stmt->execute();
        return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    }

    public function getCooccurrence(int $ingredientId, int $minCount, int $limit): array
    {
        $sql = "SELECT
                    i2.node_id      AS partner_id,
                    i2.name         AS partner_name,
                    COALESCE(i2.category, '') AS partner_category,
                    COUNT(DISTINCT e1.source_id) AS co_occurrence_count
                FROM edge e1
                INNER JOIN node n_recipe ON e1.source_id = n_recipe.node_id
                                        AND n_recipe.node_type = 'recipe'
                INNER JOIN edge e2       ON e1.source_id = e2.source_id
                                        AND e2.edge_type = 'contains'
                                        AND e2.target_id != e1.target_id
                INNER JOIN node n2       ON e2.target_id = n2.node_id
                                        AND n2.node_type = 'ingredient'
                INNER JOIN ingredient_details i2 ON e2.target_id = i2.node_id
                WHERE e1.edge_type = 'contains'
                  AND e1.target_id = ?
                GROUP BY i2.node_id, i2.name, i2.category
                HAVING COUNT(DISTINCT e1.source_id) >= ?
                ORDER BY co_occurrence_count DESC
                LIMIT ?";

        $stmt = $this->db->prepare($sql);
        if (!$stmt) {
            error_log("NodeModel::getCooccurrence prepare error: " . $this->db->error);
            return [];
        }
        $stmt->bind_param("iii", $ingredientId, $minCount, $limit);
        $stmt->execute();
        if ($stmt->error) {
            error_log("NodeModel::getCooccurrence execute error: " . $stmt->error);
            return [];
        }
        return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    }

    public function getEdges(int $id): array
    {
        $sql = "SELECT e.edge_id, e.edge_type, e.source_id,
                    COALESCE(rs.title, ri.name, rci.name, cuis_s.name, CONCAT('ID:', src.node_id)) AS source_name,
                    src.node_type AS source_type,
                    e.target_id,
                    COALESCE(rt.title, it.name, ct.name, cuis_t.name, CONCAT('ID:', tgt.node_id)) AS target_name,
                    tgt.node_type AS target_type
                FROM edge e
                JOIN node src ON e.source_id = src.node_id
                JOIN node tgt ON e.target_id = tgt.node_id
                LEFT JOIN recipe_details              rs     ON e.source_id = rs.node_id
                LEFT JOIN ingredient_details          ri     ON e.source_id = ri.node_id
                LEFT JOIN compound_ingredient_details rci    ON e.source_id = rci.node_id
                LEFT JOIN cuisine_details             cuis_s ON e.source_id = cuis_s.node_id
                LEFT JOIN recipe_details              rt     ON e.target_id = rt.node_id
                LEFT JOIN ingredient_details          it     ON e.target_id = it.node_id
                LEFT JOIN compound_ingredient_details ct     ON e.target_id = ct.node_id
                LEFT JOIN cuisine_details             cuis_t ON e.target_id = cuis_t.node_id
                WHERE e.source_id = ? OR e.target_id = ?
                ORDER BY e.edge_type";

        $stmt = $this->db->prepare($sql);
        $stmt->bind_param("ii", $id, $id);
        $stmt->execute();
        return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    }
}

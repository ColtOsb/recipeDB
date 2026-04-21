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

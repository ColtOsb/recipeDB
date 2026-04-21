<?php
class Database
{
    private static ?mysqli $conn = null;

    public static function get(): mysqli
    {
        if (self::$conn === null) {
            self::$conn = new mysqli("db", "root", "", "recipedb");
            if (self::$conn->connect_error) {
                http_response_code(500);
                echo json_encode([
                    "error" =>
                        "DB connection failed: " . self::$conn->connect_error,
                ]);
                exit();
            }
            self::$conn->set_charset("utf8mb4");
        }
        return self::$conn;
    }
}

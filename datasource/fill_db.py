import mysql.connector
import pandas as pd

conn = mysql.connector.connect(
            host='localhost',
            user='root',
            password='db',
            database='recipe'
        )

cursor = conn.cursor()

def insert_node(node_type,node_name,category=None):
    cursor.execute(
                "INSERT IGNORE INTO node (node_type,node_name,category) Values (%s, %s, %s)",
                (node_type,node_name,category)
            )
    cursor.execute(
                "SELECT node_id FROM node WHERE node_type = %s AND node_name = %s",
                (node_type, node_name)
            )
    return cursor.fetchone()[0]

def insert_edge(source_id, target_id, edge_type):
    cursor.execute(
                "INSERT IGNORE INTO edge (source_id, target_id, edge_type) VALUES (%s, %s, %s)",
                (source_id, target_id, edge_type)
            )

recipes_df = pd.read_csv("CulinaryDBFull(01_Recipe_Details).csv")
ingredients_df = pd.read_csv("CulinaryDBFull(02_Ingredients).csv")
compound_df = pd.read_csv("CulinaryDBFull(03_Compound_Ingredients).csv")
aliases_df = pd.read_csv("CulinaryDBFull(04_Recipe-Ingredients_Aliases).csv")


entity_to_node = {}


# INSERT INGREDIENTS
for _, row in ingredients_df.iterrows():
    node_id = insert_node("ingredient", row["Aliased Ingredient Name"], row["Category"])
    entity_to_node[row["Entity ID"]] = node_id

# INSERT COMPOUND INGREDIENTS
for _, row in compound_df.iterrows():
    node_id = insert_node("compound_ingredient", row["Compound Ingredient Name"], row["Category"])
    entity_to_node[row["entity_id"]] = node_id

# INSERT COMPOUND -> INGREDIENT EDGES
for _, row in compound_df.iterrows():
    compound_node_id = entity_to_node[row["entity_id"]]
    constituents = [c.strip() for c in str(row["Contituent Ingredients"]).split(",")]
    for constituent in constituents:
        cursor.execute(
                    "SELECT node_id FROM node WHERE node_type = 'ingredient' AND node_name = %s",
                    (constituent,)
                )
        result = cursor.fetchone()
        if result:
            insert_edge(compound_node_id, result[0], "made_of")

#INSERT RECPIES and CUISINE
recipe_to_node = {}

for _, row in recipes_df.iterrows():
    recipe_node_id = insert_node("recipe", row["Title"])
    cuisine_node_id = insert_node("cuisine",row["Cuisine"])
    insert_edge(recipe_node_id, cuisine_node_id,"belongs_to")
    recipe_to_node[row["Recipe ID"]] = recipe_node_id

#INSERT RECIPE -> INGREDIENT EDGES
for _, row in aliases_df.iterrows():
    recipe_node_id = recipe_to_node.get(row["Recipe ID"])
    ingredient_node_id = entity_to_node.get(row["Entity ID"])

    if recipe_node_id and ingredient_node_id:
        insert_edge(recipe_node_id, ingredient_node_id, "contains")

conn.commit()
cursor.close()
conn.close()
print("Database Populated")

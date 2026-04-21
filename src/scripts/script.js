const API = "api.php";

const NODE_COLORS = {
  recipe: "#2c5f2d",
  ingredient: "#c0782a",
  compound_ingredient: "#7b4fa6",
  chef: "#1a6b8a",
  default: "#555",
};

function nodeColor(type) {
  return NODE_COLORS[(type || "").toLowerCase()] || NODE_COLORS.default;
}

async function apiFetch(params) {
  const url = API + "?" + new URLSearchParams(params);
  console.log("apiFetch ->", url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  console.log("apiFetch <-", data);
  return data;
}

// ── State ─────────────────────────────────────────────────────────────────
let simulation, svg, linkGroup, labelGroup, nodeGroup, zoomGroup;

// ── Init SVG ──────────────────────────────────────────────────────────────
function initSVG() {
  svg = d3.select("#graph");
  const zoom = d3
    .zoom()
    .scaleExtent([0.1, 4])
    .on("zoom", (e) => {
      zoomGroup.attr("transform", e.transform);
    });
  svg.call(zoom);
  zoomGroup = svg.append("g");
  linkGroup = zoomGroup.append("g").attr("class", "links");
  labelGroup = zoomGroup.append("g").attr("class", "edge-labels");
  nodeGroup = zoomGroup.append("g").attr("class", "nodes");
}

// ── Clear graph ────────────────────────────────────────────────────────────
function clearGraph() {
  linkGroup.selectAll("*").remove();
  labelGroup.selectAll("*").remove();
  nodeGroup.selectAll("*").remove();
}

// ── Draw nodes and edges ───────────────────────────────────────────────────
function drawGraph(nodes, edges) {
  clearGraph();

  const width = document.getElementById("graph-container").clientWidth;
  const height = document.getElementById("graph-container").clientHeight;

  if (edges.length === 0) {
    // Search results — arrange in a grid, no edges
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const spacingX = Math.min(width / (cols + 1), 150);
    const spacingY = Math.min(
      height / (Math.ceil(nodes.length / cols) + 1),
      150,
    );
    nodes.forEach((n, i) => {
      n.x = spacingX * ((i % cols) + 1);
      n.y = spacingY * (Math.floor(i / cols) + 1);
    });

    const node = nodeGroup
      .selectAll(".node")
      .data(nodes, (d) => d.node_id)
      .join("g")
      .attr("class", "node")
      .attr("transform", (d) => `translate(${d.x},${d.y})`)
      .on("click", (event, d) => expandNode(d))
      .on("mouseover", (event, d) => showTooltip(event, d))
      .on("mouseout", hideTooltip);

    node
      .append("circle")
      .attr("r", (d) =>
        (d.node_type || "").toLowerCase() === "recipe" ? 18 : 12,
      )
      .attr("fill", (d) => nodeColor(d.node_type))
      .attr("stroke", (d) => d3.color(nodeColor(d.node_type)).brighter(1));

    node
      .append("text")
      .text((d) =>
        d.node_name.length > 14 ? d.node_name.slice(0, 14) + "…" : d.node_name,
      )
      .attr("dy", 28);

    return;
  }

  // ── Build tree structure from nodes and edges ──────────────────────────
  const root = nodes[0];

  // Build a parent->children map from edges
  const childrenMap = new Map();
  nodes.forEach((n) => childrenMap.set(n.node_id, []));

  edges.forEach((e) => {
    const source = nodes.find((n) => n.node_id === e.source_id);
    const target = nodes.find((n) => n.node_id === e.target_id);

    // If root is the source, target is the child
    if (e.source_id === root.node_id && target) {
      childrenMap
        .get(e.source_id)
        .push({ node: target, edge_type: e.edge_type });
    }
    // If root is the target, source is the child
    else if (e.target_id === root.node_id && source) {
      childrenMap
        .get(e.target_id)
        .push({ node: source, edge_type: e.edge_type });
    }
    // For deeper levels, source points to target
    else if (source && target && childrenMap.has(e.source_id)) {
      childrenMap
        .get(e.source_id)
        .push({ node: target, edge_type: e.edge_type });
    }
  });

  // Build D3 hierarchy
  function buildHierarchy(nodeData, visited = new Set()) {
    visited.add(nodeData.node_id);
    const children = (childrenMap.get(nodeData.node_id) || [])
      .filter((c) => !visited.has(c.node.node_id))
      .map((c) => ({
        ...c.node,
        edge_type: c.edge_type,
        children: buildHierarchy(c.node, new Set(visited)).children,
      }));
    return { ...nodeData, children };
  }

  const hierarchy = d3.hierarchy(buildHierarchy(root));

  // ── D3 tree layout ─────────────────────────────────────────────────────
  const treeLayout = d3.tree().size([width - 100, height - 150]);

  treeLayout(hierarchy);

  // ── Draw edges ──
  linkGroup
    .selectAll(".link")
    .data(hierarchy.links())
    .join("path")
    .attr("class", "link")
    .attr("fill", "none")
    .attr(
      "d",
      d3
        .linkVertical()
        .x((d) => d.x + 50)
        .y((d) => d.y + 60),
    );

  // ── Draw edge labels ──
  labelGroup
    .selectAll(".edge-label")
    .data(hierarchy.links())
    .join("text")
    .attr("class", "edge-label")
    .text((d) => d.target.data.edge_type || "")
    .attr("x", (d) => (d.source.x + d.target.x) / 2 + 50)
    .attr("y", (d) => (d.source.y + d.target.y) / 2 + 60);

  // ── Draw nodes ──
  const node = nodeGroup
    .selectAll(".node")
    .data(hierarchy.descendants(), (d) => d.data.node_id)
    .join("g")
    .attr("class", "node")
    .attr("transform", (d) => `translate(${d.x + 50},${d.y + 60})`)
    .on("click", (event, d) => expandNode(d.data))
    .on("mouseover", (event, d) => showTooltip(event, d.data))
    .on("mouseout", hideTooltip);

  node
    .append("circle")
    .attr("r", (d) =>
      (d.data.node_type || "").toLowerCase() === "recipe" ? 18 : 12,
    )
    .attr("fill", (d) => nodeColor(d.data.node_type))
    .attr("stroke", (d) => d3.color(nodeColor(d.data.node_type)).brighter(1));

  node
    .append("text")
    .text((d) =>
      d.data.node_name.length > 14
        ? d.data.node_name.slice(0, 14) + "…"
        : d.data.node_name,
    )
    .attr("dy", 28);
}

// ── Load search results (no edges) ────────────────────────────────────────
async function loadNodes() {
  const search = document.getElementById("search-input").value.trim();
  const type = document.getElementById("type-filter").value;

  if (!search && !type) {
    clearGraph();
    document.getElementById("node-count").textContent =
      "Search for nodes above";
    return;
  }

  const params = { action: "nodes" };
  if (search) params.search = search;
  if (type) params.type = type;

  try {
    const nodes = await apiFetch(params);
    document.getElementById("node-count").textContent =
      `${nodes.length} result${nodes.length !== 1 ? "s" : ""} — click a node to expand`;

    drawGraph(nodes, []);
  } catch (e) {
    console.error("loadNodes failed", e);
  }
}

// ── Click node → show it and all its connections ──────────────────────────
async function expandNode(d) {
  document.getElementById("node-count").textContent =
    `Loading connections for "${d.node_name}"…`;

  try {
    const edges = await apiFetch({ action: "edges", id: d.node_id });

    // Collect all connected node IDs
    const connectedIds = new Set([d.node_id]);
    edges.forEach((e) => {
      connectedIds.add(e.source_id);
      connectedIds.add(e.target_id);
    });

    // Build node list from edge data — no extra fetch needed
    const nodeMap = new Map();
    nodeMap.set(d.node_id, d);
    edges.forEach((e) => {
      if (!nodeMap.has(e.source_id)) {
        nodeMap.set(e.source_id, {
          node_id: e.source_id,
          node_name: e.source_name,
          node_type: e.source_type,
        });
      }
      if (!nodeMap.has(e.target_id)) {
        nodeMap.set(e.target_id, {
          node_id: e.target_id,
          node_name: e.target_name,
          node_type: e.target_type,
        });
      }
    });

    // Find any compound ingredient nodes and fetch their edges too
    const compoundNodes = [...nodeMap.values()].filter(
      (n) => (n.node_type || "").toLowerCase() === "compound_ingredient",
    );

    const extraEdgeArrays = await Promise.all(
      compoundNodes.map((n) => apiFetch({ action: "edges", id: n.node_id })),
    );

    // Merge extra edges and their nodes into our maps
    const allEdges = [...edges];
    extraEdgeArrays
      .flat()
      .filter((e) => e.edge_type === "made_of")
      .forEach((e) => {
        allEdges.push(e);
        if (!nodeMap.has(e.source_id)) {
          nodeMap.set(e.source_id, {
            node_id: e.source_id,
            node_name: e.source_name,
            node_type: e.source_type,
          });
        }
        if (!nodeMap.has(e.target_id)) {
          nodeMap.set(e.target_id, {
            node_id: e.target_id,
            node_name: e.target_name,
            node_type: e.target_type,
          });
        }
      });

    // Deduplicate edges by edge_id
    const edgeMap = new Map(allEdges.map((e) => [e.edge_id, e]));
    const finalEdges = [...edgeMap.values()];
    const finalNodes = [...nodeMap.values()];

    document.getElementById("node-count").textContent =
      `"${d.node_name}" — ${finalNodes.length} node${finalNodes.length !== 1 ? "s" : ""}, ${finalEdges.length} connection${finalEdges.length !== 1 ? "s" : ""}`;

    drawGraph(finalNodes, finalEdges);
  } catch (e) {
    console.error("expandNode failed", e);
  }
}

// ── Tooltip ───────────────────────────────────────────────────────────────
const tooltip = document.getElementById("tooltip");

// Safer show/hide, guard against null
function showTooltip(event, d) {
  if (!tooltip) return;
  tooltip.style.display = "block";
  tooltip.style.left = event.offsetX + 14 + "px";
  tooltip.style.top = event.offsetY + 14 + "px";
  tooltip.innerHTML = `<strong>${d.node_name}</strong><br>Type: ${d.node_type}<br>ID: ${d.node_id}`;
}

function hideTooltip() {
  if (!tooltip) return;
  tooltip.style.display = "none";
}

// Safe event listener
document
  .getElementById("graph-container")
  ?.addEventListener("mousemove", (e) => {
    if (!tooltip) return;
    tooltip.style.left = e.offsetX + 14 + "px";
    tooltip.style.top = e.offsetY + 14 + "px";
  });

// ── Load types for dropdown ───────────────────────────────────────────────
async function loadTypes() {
  try {
    const types = await apiFetch({ action: "node_types" });
    const sel = document.getElementById("type-filter");
    if (!sel) {
      console.error("type-filter element not found");
      return;
    }
    types.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      sel.appendChild(opt);
    });
  } catch (e) {
    console.error("Could not load node types", e);
  }
}

// ── Event listeners ───────────────────────────────────────────────────────
let debounceTimer;
document.getElementById("search-input")?.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(loadNodes, 300);
});
document.getElementById("type-filter")?.addEventListener("change", loadNodes);

// ── Init ──────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initSVG();
  loadTypes();
});

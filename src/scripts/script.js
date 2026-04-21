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

function drawGraph(nodes, edges) {
  clearGraph();

  const container = document.getElementById("graph-container");
  const width = container.clientWidth;
  const height = container.clientHeight;

  if (nodes.length === 0) return;

  // ── Grid Layout for Search Results (No Edges) ──
  if (edges.length === 0) {
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const spacingX = Math.min(width / (cols + 1), 180);
    const spacingY = 120;

    const node = nodeGroup
      .selectAll(".node")
      .data(nodes, (d) => d.node_id)
      .join("g")
      .attr("class", "node")
      .attr("transform", (d, i) => {
        const x = spacingX * ((i % cols) + 1);
        const y = spacingY * (Math.floor(i / cols) + 1);
        return `translate(${x},${y})`;
      })
      .on("click", (event, d) => expandNode(d))
      .on("mouseover", showTooltip)
      .on("mouseout", hideTooltip);

    renderNodeCircles(node);
    return;
  }

  // ── Tree Layout for Connections ──
  // We treat the first node (the one clicked) as the root
  const rootNode = nodes[0];

  // Build an adjacency list
  const adj = new Map();
  nodes.forEach((n) => adj.set(n.node_id, []));
  edges.forEach((e) => {
    // Ensure we only map edges between nodes we actually have in our list
    if (adj.has(e.source_id) && adj.has(e.target_id)) {
      adj.get(e.source_id).push({ to: e.target_id, label: e.edge_type });
    }
  });

  // Convert flat data to D3 hierarchy
  function getChildren(id, visited = new Set()) {
    visited.add(id);
    const children = [];
    (adj.get(id) || []).forEach((edge) => {
      if (!visited.has(edge.to)) {
        const childNode = nodes.find((n) => n.node_id === edge.to);
        if (childNode) {
          children.push({
            ...childNode,
            edge_type: edge.label,
            children: getChildren(edge.to, new Set(visited)),
          });
        }
      }
    });
    return children;
  }

  const hierarchyData = {
    ...rootNode,
    children: getChildren(rootNode.node_id),
  };

  const root = d3.hierarchy(hierarchyData);
  const treeLayout = d3.tree().size([width - 200, height - 200]);
  treeLayout(root);

  // Center the tree in the view
  const offsetX = 100;
  const offsetY = 50;

  // Links
  linkGroup
    .selectAll(".link")
    .data(root.links())
    .join("path")
    .attr("class", "link")
    .attr("fill", "none")
    .attr("stroke", "#ccc")
    .attr(
      "d",
      d3
        .linkVertical()
        .x((d) => d.x + offsetX)
        .y((d) => d.y + offsetY),
    );

  // Edge Labels
  labelGroup
    .selectAll(".edge-label")
    .data(root.links())
    .join("text")
    .attr("class", "edge-label")
    .attr("text-anchor", "middle")
    .attr("x", (d) => (d.source.x + d.target.x) / 2 + offsetX)
    .attr("y", (d) => (d.source.y + d.target.y) / 2 + offsetY)
    .text((d) => d.target.data.edge_type || "");

  // Nodes
  const node = nodeGroup
    .selectAll(".node")
    .data(root.descendants(), (d) => d.data.node_id)
    .join("g")
    .attr("class", "node")
    .attr("transform", (d) => `translate(${d.x + offsetX},${d.y + offsetY})`)
    .on("click", (event, d) => expandNode(d.data))
    .on("mouseover", (event, d) => showTooltip(event, d.data))
    .on("mouseout", hideTooltip);

  renderNodeCircles(node, true);
}

// Helper to keep styling consistent
function renderNodeCircles(nodeSelection, isHierarchy = false) {
  nodeSelection
    .append("circle")
    .attr("r", (d) => {
      const data = isHierarchy ? d.data : d;
      return (data.node_type || "").toLowerCase() === "recipe" ? 20 : 14;
    })
    .attr("fill", (d) =>
      nodeColor(isHierarchy ? d.data.node_type : d.node_type),
    )
    .attr("stroke", "#fff")
    .attr("stroke-width", 2);

  nodeSelection
    .append("text")
    .attr("dy", 35)
    .attr("text-anchor", "middle")
    .text((d) => {
      const name = isHierarchy ? d.data.node_name : d.node_name;
      return name.length > 15 ? name.slice(0, 12) + "..." : name;
    })
    .style("font-size", "12px")
    .style("fill", "#333");
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

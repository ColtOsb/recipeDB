const API = "api.php";

let currentRecipe = null;
let simulation = null;

async function apiFetch(params) {
  const url = API + "?" + new URLSearchParams(params);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Autocomplete ──────────────────────────────────────────────────────────────
const searchInput = document.getElementById("recipe-search");
const suggestionsList = document.getElementById("search-suggestions");

let debounceTimer;
searchInput.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(fetchSuggestions, 300);
});

async function fetchSuggestions() {
  const q = searchInput.value.trim();
  if (q.length < 2) { closeSuggestions(); return; }
  try {
    const results = await apiFetch({ action: "recipe_search", q });
    suggestionsList.innerHTML = "";
    if (results.length === 0) { closeSuggestions(); return; }
    const exact = results.find((r) => r.title.toLowerCase() === q.toLowerCase());
    if (exact) { selectRecipe(exact); return; }
    results.forEach((r) => {
      const li = document.createElement("li");
      li.textContent = r.title;
      li.addEventListener("click", () => selectRecipe(r));
      suggestionsList.appendChild(li);
    });
    suggestionsList.style.display = "block";
  } catch (e) {
    console.error("Recipe search failed", e);
  }
}

function closeSuggestions() {
  suggestionsList.innerHTML = "";
  suggestionsList.style.display = "none";
}

function selectRecipe(recipe) {
  currentRecipe = recipe;
  searchInput.value = recipe.title;
  closeSuggestions();
  loadNetwork();
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-wrapper") && !e.target.closest(".controls"))
    closeSuggestions();
});

// ── Load influence network ────────────────────────────────────────────────────
async function loadNetwork() {
  if (!currentRecipe) return;
  document.getElementById("status").textContent =
    `Loading influence network for "${currentRecipe.title}"…`;
  try {
    const influenced = await apiFetch({
      action: "influence_network",
      recipe_id: currentRecipe.node_id,
    });
    drawNetwork(currentRecipe, influenced);
    const msg = influenced.length > 0
      ? `"${currentRecipe.title}" influences ${influenced.length} high-complexity recipe${influenced.length !== 1 ? "s" : ""}`
      : `"${currentRecipe.title}" influences no high-complexity recipes (try a recipe with more ingredients)`;
    document.getElementById("status").textContent = msg;
  } catch (e) {
    console.error("Influence network load failed", e);
    document.getElementById("status").textContent = "Error loading data";
  }
}

// ── SVG / D3 setup ────────────────────────────────────────────────────────────
let svg, zoomGroup, linkGroup, labelGroup, nodeGroup;

function initSVG() {
  svg = d3.select("#graph");
  const zoom = d3
    .zoom()
    .scaleExtent([0.1, 4])
    .on("zoom", (e) => zoomGroup.attr("transform", e.transform));
  svg.call(zoom);
  zoomGroup = svg.append("g");
  linkGroup = zoomGroup.append("g").attr("class", "links");
  labelGroup = zoomGroup.append("g").attr("class", "edge-labels");
  nodeGroup = zoomGroup.append("g").attr("class", "nodes");
}

// ── Draw force-directed network ───────────────────────────────────────────────
function drawNetwork(seed, influenced) {
  linkGroup.selectAll("*").remove();
  labelGroup.selectAll("*").remove();
  nodeGroup.selectAll("*").remove();
  if (simulation) simulation.stop();

  if (influenced.length === 0) return;

  const maxShared = +influenced[0].shared_ingredients;
  const strokeScale = d3.scaleLinear().domain([2, maxShared]).range([1.5, 6]);

  const seedNode = { node_id: seed.node_id, title: seed.title, isCenter: true };
  const influencedNodes = influenced.map((r) => ({
    node_id: r.recipe_id,
    title: r.influenced_recipe,
    shared: +r.shared_ingredients,
    isCenter: false,
  }));
  const nodes = [seedNode, ...influencedNodes];

  const links = influencedNodes.map((r) => ({
    source: seed.node_id,
    target: r.node_id,
    shared: r.shared,
  }));

  const width = document.getElementById("graph-container").clientWidth;
  const height = document.getElementById("graph-container").clientHeight;

  seedNode.x = width / 2;
  seedNode.y = height / 2;
  influencedNodes.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / influencedNodes.length;
    n.x = width / 2 + 230 * Math.cos(angle);
    n.y = height / 2 + 230 * Math.sin(angle);
  });

  simulation = d3
    .forceSimulation(nodes)
    .force(
      "link",
      d3.forceLink(links).id((d) => d.node_id).distance(160).strength(0.5),
    )
    .force("charge", d3.forceManyBody().strength(-200))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide().radius(30));

  seedNode.fx = width / 2;
  seedNode.fy = height / 2;

  // Links
  const link = linkGroup
    .selectAll(".link")
    .data(links)
    .join("line")
    .attr("class", "link")
    .attr("stroke-width", (d) => strokeScale(d.shared))
    .attr("stroke-opacity", 0.5);

  // Edge labels (shared ingredient count)
  const edgeLabel = labelGroup
    .selectAll(".edge-label")
    .data(links)
    .join("text")
    .attr("class", "edge-label")
    .text((d) => d.shared);

  // Nodes
  const node = nodeGroup
    .selectAll(".node")
    .data(nodes, (d) => d.node_id)
    .join("g")
    .attr("class", "node")
    .on("click", (event, d) => {
      if (!d.isCenter) selectRecipe({ node_id: d.node_id, title: d.title });
    })
    .on("mouseover", (event, d) => showTooltip(event, d))
    .on("mouseout", hideTooltip)
    .call(
      d3.drag()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          if (!d.isCenter) { d.fx = null; d.fy = null; }
        }),
    );

  node.append("circle")
    .attr("r", (d) => d.isCenter ? 26 : 16)
    .attr("fill", "#2c5f2d")
    .attr("stroke", (d) => d3.color("#2c5f2d").brighter(d.isCenter ? 1.5 : 0.8))
    .attr("stroke-width", (d) => d.isCenter ? 3 : 1.5);

  node.append("text")
    .text((d) => d.title.length > 14 ? d.title.slice(0, 14) + "…" : d.title)
    .attr("dy", (d) => (d.isCenter ? 26 : 16) + 13)
    .attr("text-anchor", "middle")
    .attr("font-size", (d) => d.isCenter ? "12px" : "10px")
    .attr("fill", "#111")
    .attr("pointer-events", "none");

  simulation.on("tick", () => {
    link
      .attr("x1", (d) => d.source.x).attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x).attr("y2", (d) => d.target.y);
    edgeLabel
      .attr("x", (d) => (d.source.x + d.target.x) / 2)
      .attr("y", (d) => (d.source.y + d.target.y) / 2);
    node.attr("transform", (d) => `translate(${d.x},${d.y})`);
  });
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
const tooltip = document.getElementById("tooltip");

function showTooltip(event, d) {
  if (!tooltip) return;
  tooltip.style.display = "block";
  const detail = d.isCenter
    ? "(seed recipe)"
    : `${d.shared} shared ingredient${d.shared !== 1 ? "s" : ""}`;
  tooltip.innerHTML = `<strong>${d.title}</strong><br>${detail}`;
}

function hideTooltip() {
  if (tooltip) tooltip.style.display = "none";
}

document.getElementById("graph-container")?.addEventListener("mousemove", (e) => {
  if (tooltip) {
    tooltip.style.left = e.offsetX + 14 + "px";
    tooltip.style.top = e.offsetY + 14 + "px";
  }
});

document.addEventListener("DOMContentLoaded", initSVG);

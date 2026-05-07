const API = "api.php";

// Categorical color scale for ingredient categories
const categoryColor = d3.scaleOrdinal(d3.schemeTableau10);

let currentIngredient = null;
let simulation = null;

async function apiFetch(params) {
  const url = API + "?" + new URLSearchParams(params);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Autocomplete ──────────────────────────────────────────────────────────────
const searchInput = document.getElementById("ingredient-search");
const suggestionsList = document.getElementById("search-suggestions");

let debounceTimer;
searchInput.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(fetchSuggestions, 300);
});

async function fetchSuggestions() {
  const q = searchInput.value.trim();
  if (q.length < 2) {
    closeSuggestions();
    return;
  }
  try {
    const results = await apiFetch({ action: "ingredient_search", q });
    suggestionsList.innerHTML = "";
    if (results.length === 0) { closeSuggestions(); return; }
    // Auto-select when the query is an exact match
    const exact = results.find((r) => r.name.toLowerCase() === q.toLowerCase());
    if (exact) { selectIngredient(exact); return; }
    results.forEach((r) => {
      const li = document.createElement("li");
      li.textContent = r.name + (r.category ? ` (${r.category})` : "");
      li.addEventListener("click", () => selectIngredient(r));
      suggestionsList.appendChild(li);
    });
    suggestionsList.style.display = "block";
  } catch (e) {
    console.error("Suggestion fetch failed", e);
  }
}

function closeSuggestions() {
  suggestionsList.innerHTML = "";
  suggestionsList.style.display = "none";
}

function selectIngredient(ingredient) {
  currentIngredient = ingredient;
  searchInput.value = ingredient.name;
  closeSuggestions();
  loadCooccurrence();
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-wrapper") && !e.target.closest(".controls")) closeSuggestions();
});

// ── Load co-occurrence data ───────────────────────────────────────────────────
async function loadCooccurrence() {
  if (!currentIngredient) return;
  const minCount = parseInt(document.getElementById("min-count").value);
  document.getElementById("status").textContent =
    `Loading co-occurrences for "${currentIngredient.name}"…`;

  try {
    const partners = await apiFetch({
      action: "ingredient_cooccurrence",
      ingredient_id: currentIngredient.node_id,
      min_count: minCount,
      limit: 60,
    });
    drawNetwork(currentIngredient, partners);
    document.getElementById("status").textContent =
      `"${currentIngredient.name}" — ${partners.length} co-occurring ingredient${partners.length !== 1 ? "s" : ""} (min ${minCount} shared recipe${minCount !== 1 ? "s" : ""})`;
  } catch (e) {
    console.error("Co-occurrence load failed", e);
    document.getElementById("status").textContent = "Error loading data";
  }
}

document.getElementById("min-count").addEventListener("change", () => {
  if (currentIngredient) loadCooccurrence();
});

// ── SVG / D3 setup ────────────────────────────────────────────────────────────
let svg, zoomGroup, linkGroup, nodeGroup;

function initSVG() {
  svg = d3.select("#graph");
  const zoom = d3
    .zoom()
    .scaleExtent([0.1, 4])
    .on("zoom", (e) => zoomGroup.attr("transform", e.transform));
  svg.call(zoom);
  zoomGroup = svg.append("g");
  linkGroup = zoomGroup.append("g").attr("class", "links");
  nodeGroup = zoomGroup.append("g").attr("class", "nodes");
}

// ── Draw force-directed network ───────────────────────────────────────────────
function drawNetwork(center, partners) {
  linkGroup.selectAll("*").remove();
  nodeGroup.selectAll("*").remove();
  if (simulation) simulation.stop();

  if (partners.length === 0) {
    document.getElementById("status").textContent =
      `No co-occurring ingredients found for "${center.name}" at the current threshold.`;
    return;
  }

  const maxCount = partners[0].co_occurrence_count;
  const rScale = d3.scaleSqrt().domain([1, maxCount]).range([6, 22]);
  const strokeScale = d3.scaleLinear().domain([1, maxCount]).range([1, 7]);

  // Nodes: center first, then partners
  const centerNode = {
    node_id: center.node_id,
    name: center.name,
    category: center.category || "",
    isCenter: true,
  };
  const partnerNodes = partners.map((p) => ({
    node_id: p.partner_id,
    name: p.partner_name,
    category: p.partner_category || "",
    co_occurrence_count: p.co_occurrence_count,
    isCenter: false,
  }));
  const nodes = [centerNode, ...partnerNodes];

  const links = partnerNodes.map((p) => ({
    source: center.node_id,
    target: p.node_id,
    count: p.co_occurrence_count,
  }));

  const width = document.getElementById("graph-container").clientWidth;
  const height = document.getElementById("graph-container").clientHeight;

  // Spread partners in a circle initially for faster convergence
  centerNode.x = width / 2;
  centerNode.y = height / 2;
  partnerNodes.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / partnerNodes.length;
    n.x = width / 2 + 220 * Math.cos(angle);
    n.y = height / 2 + 220 * Math.sin(angle);
  });

  simulation = d3
    .forceSimulation(nodes)
    .force(
      "link",
      d3
        .forceLink(links)
        .id((d) => d.node_id)
        .distance((d) => 80 + (1 - d.count / maxCount) * 80)
        .strength(0.6),
    )
    .force("charge", d3.forceManyBody().strength(-180))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force(
      "collision",
      d3.forceCollide().radius((d) =>
        d.isCenter ? 30 : rScale(d.co_occurrence_count) + 6,
      ),
    );

  // Pin center node so the graph fans out from it
  centerNode.fx = width / 2;
  centerNode.fy = height / 2;

  // Links
  const link = linkGroup
    .selectAll(".link")
    .data(links)
    .join("line")
    .attr("class", "link")
    .attr("stroke-width", (d) => strokeScale(d.count))
    .attr("stroke-opacity", 0.5);

  // Nodes
  const node = nodeGroup
    .selectAll(".node")
    .data(nodes, (d) => d.node_id)
    .join("g")
    .attr("class", "node")
    .on("click", (event, d) => {
      if (!d.isCenter) {
        selectIngredient({
          node_id: d.node_id,
          name: d.name,
          category: d.category,
        });
      }
    })
    .on("mouseover", (event, d) => showTooltip(event, d))
    .on("mouseout", hideTooltip)
    .call(
      d3
        .drag()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          if (!d.isCenter) {
            d.fx = null;
            d.fy = null;
          }
        }),
    );

  node
    .append("circle")
    .attr("r", (d) => (d.isCenter ? 26 : rScale(d.co_occurrence_count)))
    .attr("fill", (d) =>
      d.isCenter ? "#c0782a" : categoryColor(d.category),
    )
    .attr("stroke", (d) => {
      const base = d.isCenter ? "#c0782a" : categoryColor(d.category);
      return d3.color(base).brighter(0.8);
    })
    .attr("stroke-width", (d) => (d.isCenter ? 3 : 1.5));

  node
    .append("text")
    .text((d) => (d.name.length > 13 ? d.name.slice(0, 13) + "…" : d.name))
    .attr("dy", (d) =>
      (d.isCenter ? 26 : rScale(d.co_occurrence_count)) + 13,
    )
    .attr("text-anchor", "middle")
    .attr("font-size", (d) => (d.isCenter ? "12px" : "10px"))
    .attr("fill", "#111")
    .attr("pointer-events", "none");

  simulation.on("tick", () => {
    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);
    node.attr("transform", (d) => `translate(${d.x},${d.y})`);
  });
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
const tooltip = document.getElementById("tooltip");

function showTooltip(event, d) {
  if (!tooltip) return;
  tooltip.style.display = "block";
  const count = d.isCenter
    ? "(selected ingredient)"
    : `${d.co_occurrence_count} shared recipe${d.co_occurrence_count !== 1 ? "s" : ""}`;
  tooltip.innerHTML = `<strong>${d.name}</strong><br>Category: ${d.category || "—"}<br>${count}`;
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

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", initSVG);

const API = "api.php";

const MARGIN = { top: 10, right: 200, bottom: 40, left: 160 };
const BAR_HEIGHT = 26;
const BAR_PAD = 0.25;

async function load() {
  const res = await fetch(API + "?action=accessibility_index");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function drawChart(data) {
  const container = document.getElementById("chart-container");
  const containerWidth = Math.min(container.clientWidth, 1000);
  const width = containerWidth - MARGIN.left - MARGIN.right;
  const height = data.length * BAR_HEIGHT;

  const svg = d3
    .select("#chart-container")
    .append("svg")
    .attr("width", containerWidth)
    .attr("height", height + MARGIN.top + MARGIN.bottom)
    .append("g")
    .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

  const x = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => +d.accessibility_index)])
    .range([0, width]);

  const y = d3
    .scaleBand()
    .domain(data.map((d) => d.name))
    .range([0, height])
    .padding(BAR_PAD);

  // Grid lines
  svg
    .append("g")
    .attr("class", "grid")
    .attr("transform", `translate(0,${height})`)
    .call(
      d3
        .axisBottom(x)
        .ticks(6)
        .tickSize(-height)
        .tickFormat(""),
    )
    .call((g) => g.select(".domain").remove())
    .call((g) => g.selectAll("line").attr("stroke", "#e8e8e8"));

  // Bars
  svg
    .selectAll(".bar")
    .data(data)
    .join("rect")
    .attr("class", "bar")
    .attr("x", 0)
    .attr("y", (d) => y(d.name))
    .attr("width", (d) => x(+d.accessibility_index))
    .attr("height", y.bandwidth());

  // Value labels
  svg
    .selectAll(".bar-label")
    .data(data)
    .join("text")
    .attr("class", "bar-label")
    .attr("x", (d) => x(+d.accessibility_index) - 5)
    .attr("text-anchor", "end")
    .attr("y", (d) => y(d.name) + y.bandwidth() / 2)
    .text((d) => d.accessibility_index);

  // Y axis
  svg
    .append("g")
    .attr("class", "axis-y")
    .call(d3.axisLeft(y).tickSize(0).tickPadding(8))
    .call((g) => g.select(".domain").remove());

  // X axis
  svg
    .append("g")
    .attr("class", "axis-x")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(6))
    .append("text")
    .attr("x", width / 2)
    .attr("y", 36)
    .attr("fill", "#555")
    .attr("text-anchor", "middle")
    .attr("font-size", "12px")
    .text("Accessibility Index (k)");
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const data = await load();
    drawChart(data);
    document.getElementById("chart-status").textContent =
      `${data.length} ingredient${data.length !== 1 ? "s" : ""} with accessibility index ≥ 5`;
  } catch (e) {
    console.error("Failed to load accessibility index", e);
    document.getElementById("chart-status").textContent = "Error loading data";
  }
});

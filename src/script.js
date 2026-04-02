const API = 'api.php';

// ── Helpers ───────────────────────────────────────────────────────────────

function badgeClass(type) {
  const key = (type || '').toLowerCase().replace(/\s+/g, '_');
  const known = ['recipe', 'ingredient', 'compound_ingredient', 'chef'];
  return known.includes(key) ? `badge-${key}` : 'badge-default';
}

function badge(type) {
  return `<span class="badge ${badgeClass(type)}">${type}</span>`;
}

async function apiFetch(params) {
  const url = API + '?' + new URLSearchParams(params);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Load node types for dropdown ──────────────────────────────────────────

async function loadTypes() {
  try {
    const types = await apiFetch({ action: 'node_types' });
    const sel = document.getElementById('type-filter');
    types.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      sel.appendChild(opt);
    });
  } catch (e) {
    console.error('Could not load node types', e);
  }
}

// ── Load and render node list ─────────────────────────────────────────────

let currentNodeId = null;

async function loadNodes() {
  const search = document.getElementById('search-input').value.trim();
  const type   = document.getElementById('type-filter').value;

  document.getElementById('node-count').textContent = 'Loading…';
  document.getElementById('node-list').innerHTML = '';

  try {
    const params = { action: 'nodes' };
    if (search) params.search = search;
    if (type)   params.type   = type;

    const nodes = await apiFetch(params);
    const list  = document.getElementById('node-list');

    document.getElementById('node-count').textContent =
      `${nodes.length} node${nodes.length !== 1 ? 's' : ''}`;

    if (nodes.length === 0) {
      list.innerHTML = '<li style="color:#aaa;cursor:default">No results</li>';
      return;
    }

    nodes.forEach(n => {
      const li = document.createElement('li');
      li.dataset.id = n.node_id;
      li.innerHTML  = `${badge(n.node_type)}<span class="node-name">${n.node_name}</span>`;
      li.addEventListener('click', () => selectNode(n));
      list.appendChild(li);
    });

    if (currentNodeId !== null) highlightSelected(currentNodeId);

  } catch (e) {
    document.getElementById('node-count').textContent = 'Error loading nodes';
    console.error(e);
  }
}

function highlightSelected(id) {
  document.querySelectorAll('#node-list li').forEach(li => {
    li.classList.toggle('selected', parseInt(li.dataset.id) === id);
  });
}

// ── Select a node → load its edges ───────────────────────────────────────

async function selectNode(node) {
  currentNodeId = node.node_id;
  highlightSelected(node.node_id);

  const detail      = document.getElementById('detail');
  const placeholder = document.getElementById('detail-placeholder');
  const loading     = document.getElementById('loading');
  const errorEl     = document.getElementById('error');
  const edgeList    = document.getElementById('edge-list');

  placeholder.style.display = 'none';
  detail.style.display = 'block';

  document.getElementById('detail-name').textContent = node.node_name;
  document.getElementById('detail-type').innerHTML   = badge(node.node_type) + ` &nbsp; ID: ${node.node_id}`;

  edgeList.innerHTML = '';
  errorEl.style.display  = 'none';
  loading.style.display  = 'inline';

  try {
    const edges = await apiFetch({ action: 'edges', id: node.node_id });
    loading.style.display = 'none';

    if (edges.length === 0) {
      edgeList.innerHTML = '<li class="no-edges" style="border:none;background:none">No connections found.</li>';
      return;
    }

    edges.forEach(e => {
      const li = document.createElement('li');
      const isOutgoing = e.source_id === node.node_id;

      if (isOutgoing) {
        li.innerHTML = `
          <strong>${node.node_name}</strong>
          <span class="arrow">→</span>
          <span class="edge-type-label">${e.edge_type}</span>
          <span class="arrow">→</span>
          ${badge(e.target_type)} <span>${e.target_name}</span>
        `;
      } else {
        li.innerHTML = `
          ${badge(e.source_type)} <span>${e.source_name}</span>
          <span class="arrow">→</span>
          <span class="edge-type-label">${e.edge_type}</span>
          <span class="arrow">→</span>
          <strong>${node.node_name}</strong>
        `;
      }

      edgeList.appendChild(li);
    });

  } catch (e) {
    loading.style.display  = 'none';
    errorEl.textContent    = 'Failed to load edges.';
    errorEl.style.display  = 'inline';
    console.error(e);
  }
}

// ── Event listeners ───────────────────────────────────────────────────────

let debounceTimer;
document.getElementById('search-input').addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(loadNodes, 300);
});

document.getElementById('type-filter').addEventListener('change', loadNodes);

// ── Init ──────────────────────────────────────────────────────────────────
loadTypes();
loadNodes();

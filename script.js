const sheets = {
  league: {
    file: "data/league.json",
  },
  admin: {
    file: "data/admin.json",
  },
  clas: {
    file: "data/clas.json",
  },
};

const state = {
  data: {},
};

const columnLetter = (index) => {
  let col = "";
  let num = index + 1;
  while (num > 0) {
    const rem = (num - 1) % 26;
    col = String.fromCharCode(65 + rem) + col;
    num = Math.floor((num - 1) / 26);
  }
  return col;
};

const buildTable = (tableEl, grid) => {
  tableEl.innerHTML = "";
  if (!grid || !grid.length) {
    tableEl.innerHTML = "<tbody><tr><td>No hay datos.</td></tr></tbody>";
    return;
  }

  const colCount = grid[0].length;
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const corner = document.createElement("th");
  corner.className = "row-header";
  corner.textContent = "";
  headRow.appendChild(corner);
  for (let c = 0; c < colCount; c += 1) {
    const th = document.createElement("th");
    th.textContent = columnLetter(c);
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);

  const tbody = document.createElement("tbody");
  grid.forEach((row, rIndex) => {
    const tr = document.createElement("tr");
    tr.dataset.row = rIndex + 1;
    const rowHeader = document.createElement("th");
    rowHeader.className = "row-header";
    rowHeader.textContent = rIndex + 1;
    tr.appendChild(rowHeader);
    row.forEach((cell) => {
      const td = document.createElement("td");
      td.textContent = cell === "" ? "" : cell;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  tableEl.appendChild(thead);
  tableEl.appendChild(tbody);
};

const filterRows = (tableEl, query, hideEmpty) => {
  const rows = Array.from(tableEl.querySelectorAll("tbody tr"));
  rows.forEach((row) => {
    const cells = Array.from(row.querySelectorAll("td"));
    const rowText = cells.map((cell) => cell.textContent.toLowerCase()).join(" ");
    const hasContent = cells.some((cell) => cell.textContent.trim() !== "");
    const match = rowText.includes(query);
    const visible = match && (!hideEmpty || hasContent);
    row.style.display = visible ? "" : "none";
  });
};

const setupFilters = (panelEl) => {
  const search = panelEl.querySelector(".sheet-search");
  const toggle = panelEl.querySelector(".toggle-empty");
  const tableEl = panelEl.querySelector(".sheet-table");

  const applyFilter = () => {
    filterRows(tableEl, search.value.trim().toLowerCase(), toggle.checked);
  };

  search.addEventListener("input", applyFilter);
  toggle.addEventListener("change", applyFilter);
};

const loadSheet = async (key) => {
  const response = await fetch(sheets[key].file);
  const data = await response.json();
  state.data[key] = data;
  const tableEl = document.querySelector(`table[data-table="${key}"]`);
  buildTable(tableEl, data);
};

const setupTabs = () => {
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((btn) => btn.classList.remove("is-active"));
      tab.classList.add("is-active");
      const target = tab.dataset.tab;
      document.querySelectorAll(".sheet-panel").forEach((panel) => {
        panel.classList.toggle("is-visible", panel.dataset.sheet === target);
      });
    });
  });
};

const init = async () => {
  setupTabs();
  await Promise.all(Object.keys(sheets).map(loadSheet));
  document.querySelectorAll(".sheet-panel").forEach(setupFilters);
};

init();

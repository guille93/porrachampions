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

const isNumericValue = (value) =>
  value !== "" && value !== null && value !== undefined && !Number.isNaN(Number(value));

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

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

const timeFormatter = new Intl.DateTimeFormat("es-ES", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

const formatExcelDate = (value) => {
  if (!isNumericValue(value)) {
    return value;
  }
  const serial = Number(value);
  const milliseconds = (serial - 25569) * 86400 * 1000;
  return new Date(milliseconds);
};

const formatDateCell = (value) => {
  const date = formatExcelDate(value);
  return date instanceof Date && !Number.isNaN(date) ? dateFormatter.format(date) : value;
};

const formatTimeCell = (value) => {
  const date = formatExcelDate(value);
  if (!(date instanceof Date) || Number.isNaN(date)) {
    return value;
  }
  return timeFormatter.format(date);
};

const formatScoreCell = (left, right) => {
  if (!isNumericValue(left) && !isNumericValue(right)) {
    return "-";
  }
  const leftValue = isNumericValue(left) ? left : "-";
  const rightValue = isNumericValue(right) ? right : "-";
  return `${leftValue} - ${rightValue}`;
};

const buildTable = (tableEl, grid) => {
  tableEl.innerHTML = "";
  if (!grid || !grid.length) {
    tableEl.innerHTML = "<tbody><tr><td>No hay datos.</td></tr></tbody>";
    return;
  }

  tableEl.classList.remove("friendly-table");
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
      td.textContent = cell === "#VALUE!" ? "" : cell;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  tableEl.appendChild(thead);
  tableEl.appendChild(tbody);
};

const buildLeagueTable = (tableEl, grid) => {
  tableEl.innerHTML = "";
  tableEl.classList.add("friendly-table");

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const headers = [
    "Jornada",
    "Fecha",
    "Hora",
    "Local",
    "Resultado",
    "Visitante",
    "Pronóstico",
  ];
  headers.forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  const tbody = document.createElement("tbody");
  grid.slice(1).forEach((row) => {
    const jornada = row[0];
    const fecha = row[1];
    const hora = row[2];
    const local = row[3];
    const visitante = row[10];
    const isHeader = String(local).toLowerCase() === "equipo local";

    if (!local || !visitante || isHeader) {
      return;
    }

    const tr = document.createElement("tr");
    const cells = [
      jornada,
      formatDateCell(fecha),
      formatTimeCell(hora),
      local,
      formatScoreCell(row[6], row[7]),
      visitante,
      formatScoreCell(row[5], row[8]),
    ];

    cells.forEach((value, index) => {
      const td = document.createElement("td");
      td.textContent = value === "#VALUE!" ? "" : value;
      if (index === 4 || index === 6) {
        td.classList.add("score-cell");
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  if (!tbody.children.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = headers.length;
    td.textContent = "No hay partidos cargados.";
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

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
  if (key === "league") {
    buildLeagueTable(tableEl, data);
  } else {
    buildTable(tableEl, data);
  }
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

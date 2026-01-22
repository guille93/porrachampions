# Porra Champions 2025–2026 (GitHub Pages)

App estática (HTML/CSS/JS) que replica los datos y la lógica principal del Excel (hojas **League**, **ADMIN** y **CLAS**).

## Archivos
- `index.html` – interfaz (League / Admin / Clas)
- `styles.css` – estilos
- `app.js` – lógica (puntos, clasificación, tabla de equipos)
- `data.json` – datos extraídos del Excel
- `state.json` (opcional) – estado compartido (sobrescribe resultados reales y “actuales” de picks)

## Publicar en GitHub Pages
1. Crea un repositorio y sube estos archivos a la raíz.
2. Settings → Pages → Deploy from branch → selecciona la rama y `/ (root)`.
3. Abre la URL que te da GitHub Pages.

## Cómo actualizar resultados reales (sin servidor)
### Opción A (privado, por navegador)
- En **League**, pulsa **Editar** y escribe goles.
- Se guarda en localStorage (solo tú lo ves en tu navegador).

### Opción B (compartido para todos en GitHub Pages)
- Pulsa **Exportar estado** → se descargará `state.json`.
- Sube ese `state.json` al repositorio (raíz, junto a `data.json`).
- Al recargar la web, aparecerá `state.json: sí` y todos verán los mismos resultados.

## Puntuación (como en el Excel actual)
- Fase de liga: **2** puntos por signo (1X2) + **3** puntos de bonus si el marcador es exacto (total 5).
- El resto de fases/picks están a 0 en tu Excel actual; la app los respeta.

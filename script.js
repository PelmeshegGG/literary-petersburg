const CLUSTER_MAX_ZOOM = 15;
const CLUSTER_RADIUS = 25;

function fixStyle(style) {
    const s = JSON.parse(JSON.stringify(style));
    if (!s.layers) return s;
    s.layers.forEach(l => {
        if (l.layout && l.layout['symbol-sort-key']) {
            l.layout['symbol-sort-key'] = ['coalesce', l.layout['symbol-sort-key'], 0];
        }
    });
    return s;
}

const TYPE_TO_ICON = {
    "Захоронение": "zahoroneniya",
    "Памятник": "pamyatnik",
    "Мемориальная табличка": "memorialnaya_tablichka",
    "Место действия": "mesto_deystviya",
    "Ориентир": "orientir"
};

let literaryData = null;
let currentWorld = 'day';
let isUpdating = false;

const originalIconCache = {};
const tintedIconCache = new Map();

const mapContainer = document.getElementById('map');
const slidebar = document.getElementById('slidebar');
const slidebarContent = document.getElementById('slidebar-content');
const closeSlidebarBtn = document.getElementById('close-slidebar');
const hoverTooltip = document.getElementById('hover-tooltip');
const hoverImg = document.getElementById('hover-img');
const hoverName = document.getElementById('hover-name');

let clusterClickHandler = null;
let singlePointClickHandler = null;
let singlePointHoverEnter = null;
let singlePointHoverLeave = null;
let singlePointHoverMove = null;
let clusterHoverEnter = null;
let clusterHoverLeave = null;

async function loadLiteraryData() {
    try {
        const response = await fetch('literary_places.geojson');
        literaryData = await response.json();
        console.log('✅ GeoJSON загружен, всего точек:', literaryData.features.length);
    } catch (err) {
        console.error('❌ Ошибка загрузки GeoJSON:', err);
    }
}

function processFeatures(features) {
    features.forEach(f => {
        const p = f.properties;
        p.has_day = p.has_day != null ? Number(p.has_day) : null;
        p.has_night = p.has_night != null ? Number(p.has_night) : null;

        p.litraturer_array = p.litraturer ? p.litraturer.split(',').map(s => s.trim()) : [];

        const rawTypes = (p.type || '').split(',').map(s => s.trim()).filter(Boolean);
        let dayType = null, nightType = null;

        if (rawTypes.length === 2) {
            dayType = rawTypes[0];
            nightType = rawTypes[1];
        } else if (rawTypes.length === 1) {
            const t = rawTypes[0];
            if (['Захоронение', 'Памятник', 'Мемориальная табличка'].includes(t)) dayType = t;
            else if (['Место действия', 'Ориентир'].includes(t)) nightType = t;
            else dayType = t;
        }

        if (p.has_night === 1 && !nightType) nightType = 'Место действия';

        p.day_type = dayType;
        p.night_type = nightType;

        if (f.geometry.coordinates[1] > 80) {
            const tmp = f.geometry.coordinates[0];
            f.geometry.coordinates[0] = f.geometry.coordinates[1];
            f.geometry.coordinates[1] = tmp;
        }
    });
}

async function loadIcons() {
    const promises = [];
    for (const [typeName, fileName] of Object.entries(TYPE_TO_ICON)) {
        promises.push(new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                originalIconCache[fileName] = img;
                if (!map.hasImage(fileName)) map.addImage(fileName, img);
                resolve();
            };
            img.onerror = () => {
                console.warn(`Иконка "${typeName}" не найдена, создаю заглушку`);
                const canvas = document.createElement('canvas');
                canvas.width = 24;
                canvas.height = 24;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#333';
                ctx.beginPath();
                ctx.arc(12, 12, 8, 0, 2 * Math.PI);
                ctx.fill();
                const fallback = new Image();
                fallback.src = canvas.toDataURL();
                fallback.onload = () => {
                    originalIconCache[fileName] = fallback;
                    if (!map.hasImage(fileName)) map.addImage(fileName, fallback);
                    resolve();
                };
            };
            img.src = `icons/${fileName}.svg`;
        }));
    }
    await Promise.all(promises);
    console.log('🖼 Базовые иконки загружены');
}

function generateColors(count, isNight) {
    const lightness = isNight ? 75 : 35;
    const saturation = 65;
    const colors = [];
    for (let i = 0; i < count; i++) {
        const hue = (i * 360 / count) % 360;
        colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
    }
    return colors;
}

async function getTintedIcon(baseName, colorHex) {
    const cacheKey = `${baseName}_${colorHex.replace('#', '')}`;
    if (tintedIconCache.has(cacheKey)) return cacheKey;
    if (map.hasImage(cacheKey)) return cacheKey;

    const baseImg = originalIconCache[baseName];
    if (!baseImg || !baseImg.complete) return baseName;

    const w = baseImg.naturalWidth || 24;
    const h = baseImg.naturalHeight || 24;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(baseImg, 0, 0);

    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    const tempEl = document.createElement('div');
    tempEl.style.color = colorHex;
    document.body.appendChild(tempEl);
    const rgb = getComputedStyle(tempEl).color.match(/\d+/g).map(Number);
    document.body.removeChild(tempEl);

    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 10 && data[i] < 100 && data[i + 1] < 100 && data[i + 2] < 100) {
            data[i] = rgb[0];
            data[i + 1] = rgb[1];
            data[i + 2] = rgb[2];
        }
    }
    ctx.putImageData(imageData, 0, 0);

    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            if (!map.hasImage(cacheKey)) map.addImage(cacheKey, img);
            tintedIconCache.set(cacheKey, cacheKey);
            resolve(cacheKey);
        };
        img.onerror = () => resolve(baseName);
        img.src = canvas.toDataURL();
    });
}

async function updateCategoryColors() {
    if (isUpdating || !literaryData || !map.getLayer('literary-points-circle')) return;
    isUpdating = true;

    try {
        const isNight = currentWorld === 'night';
        const filtered = getFilteredData();
        const counts = {};

        filtered.forEach(f => {
            const p = f.properties;
            if (isNight && p.night_book) {
                counts[p.night_book] = (counts[p.night_book] || 0) + 1;
            } else if (!isNight && p.litraturer_array) {
                p.litraturer_array.forEach(a => counts[a] = (counts[a] || 0) + 1);
            }
        });

        const frequentList = Object.entries(counts)
            .filter(([_, c]) => c >= 2)
            .map(([cat]) => cat);
        const frequentSet = new Set(frequentList);
        const colors = generateColors(frequentList.length, isNight);
        const grayColor = isNight ? '#aaaaaa' : '#555555';

        window._lastCategoryColors = {};
        frequentList.forEach((cat, i) => window._lastCategoryColors[cat] = colors[i]);

        const neededCombos = new Map();
        filtered.forEach(f => {
            const p = f.properties;
            const baseType = isNight ? p.night_type : p.day_type;
            const baseIcon = TYPE_TO_ICON[baseType] || 'mesto_deystviya';

            let color = null;
            if (isNight && p.night_book && frequentSet.has(p.night_book)) {
                color = colors[frequentList.indexOf(p.night_book)];
            } else if (!isNight) {
                const authors = p.litraturer_array || [];
                if (authors.length === 1 && frequentSet.has(authors[0])) {
                    color = colors[frequentList.indexOf(authors[0])];
                }
            }

            const finalColor = color || grayColor;
            const cacheKey = `${baseIcon}_${finalColor.replace(/[^a-f0-9]/gi, '')}`;
            if (!neededCombos.has(cacheKey)) {
                neededCombos.set(cacheKey, { baseIcon, color: finalColor });
            }
        });

        const promises = [];
        for (const [cacheKey, combo] of neededCombos) {
            promises.push(
                getTintedIcon(combo.baseIcon, combo.color).then(id => {
                    neededCombos.get(cacheKey).resultId = id;
                })
            );
        }
        await Promise.all(promises);

        filtered.forEach(f => {
            const p = f.properties;
            const baseType = isNight ? p.night_type : p.day_type;
            const baseIcon = TYPE_TO_ICON[baseType] || 'mesto_deystviya';

            let color = null;
            if (isNight && p.night_book && frequentSet.has(p.night_book)) {
                color = colors[frequentList.indexOf(p.night_book)];
            } else if (!isNight) {
                const authors = p.litraturer_array || [];
                if (authors.length === 1 && frequentSet.has(authors[0])) {
                    color = colors[frequentList.indexOf(authors[0])];
                }
            }

            const finalColor = color || grayColor;
            const cacheKey = `${baseIcon}_${finalColor.replace(/[^a-f0-9]/gi, '')}`;
            p._icon = neededCombos.get(cacheKey)?.resultId || baseIcon;
        });

        updateSourceData();
        updateCategoryColorIndicators();
    } finally {
        isUpdating = false;
    }
}

function getFilteredData() {
    const isNight = currentWorld === 'night';
    const worldField = isNight ? 'has_night' : 'has_day';
    const activeTypes = getSelectedValues('type-checkboxes');
    const activeAuthors = getSelectedValues('author-checkboxes');
    const activeBooks = getSelectedValues('book-checkboxes');
    const typeField = isNight ? 'night_type' : 'day_type';

    return literaryData.features.filter(f => {
        const p = f.properties;
        if (p[worldField] !== 1) return false;
        if (activeTypes.length > 0 && !activeTypes.includes(p[typeField])) return false;
        if (activeAuthors.length > 0 && (!p.litraturer_array || !p.litraturer_array.some(a => activeAuthors.includes(a)))) return false;
        if (isNight && activeBooks.length > 0 && (!p.night_book || !activeBooks.includes(p.night_book))) return false;
        return true;
    });
}

function updateSourceData() {
    const source = map.getSource('literary-points');
    if (!source) return;
    source.setData({ type: 'FeatureCollection', features: getFilteredData() });
}

function getSelectedValues(containerId) {
    const container = document.getElementById(containerId);
    return container ? Array.from(container.querySelectorAll('input:checked:not([data-value="all"])')).map(cb => cb.dataset.value) : [];
}

function removeEventHandlers() {
    const off = (evt, layer, handler) => handler && map.off(evt, layer, handler);
    off('click', 'clusters', clusterClickHandler);
    off('click', 'literary-points-circle', singlePointClickHandler);
    off('mouseenter', 'literary-points-circle', singlePointHoverEnter);
    off('mouseleave', 'literary-points-circle', singlePointHoverLeave);
    off('mousemove', 'literary-points-circle', singlePointHoverMove);
    off('mouseenter', 'clusters', clusterHoverEnter);
    off('mouseleave', 'clusters', clusterHoverLeave);

    clusterClickHandler = singlePointClickHandler = singlePointHoverEnter = null;
    singlePointHoverLeave = singlePointHoverMove = clusterHoverEnter = clusterHoverLeave = null;
}

function addLiteraryPoints() {
    ['literary-points-circle', 'literary-points-glow', 'clusters', 'cluster-count'].forEach(id => {
        if (map.getLayer(id)) map.removeLayer(id);
    });
    if (map.getSource('literary-points')) map.removeSource('literary-points');
    removeEventHandlers();

    const isNight = currentWorld === 'night';
    const worldField = isNight ? 'has_night' : 'has_day';
    const initialFeatures = literaryData.features.filter(f => f.properties[worldField] === 1);

    initialFeatures.forEach(f => {
        const p = f.properties;
        const base = isNight ? p.night_type : p.day_type;
        f.properties._icon = TYPE_TO_ICON[base] || 'mesto_deystviya';
    });

    map.addSource('literary-points', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: initialFeatures },
        cluster: true,
        clusterMaxZoom: CLUSTER_MAX_ZOOM,
        clusterRadius: CLUSTER_RADIUS
    });

    map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'literary-points',
        filter: ['has', 'point_count'],
        paint: {
            'circle-color': ['step', ['get', 'point_count'], '#AF2C22', 10, '#D2604A', 30, '#E08B79', 100, '#F0B5A0'],
            'circle-radius': ['step', ['get', 'point_count'], 15, 10, 20, 30, 25, 100, 30],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff'
        }
    });

    map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'literary-points',
        filter: ['has', 'point_count'],
        layout: {
            'text-field': ['get', 'point_count_abbreviated'],
            'text-font': ['Noto Sans Regular'],
            'text-size': 12
        },
        paint: {
            'text-color': '#ffffff'
        }
    });

    map.addLayer({
        id: 'literary-points-glow',
        type: 'circle',
        source: 'literary-points',
        filter: ['!', ['has', 'point_count']],
        paint: {
            'circle-radius': 25,
            'circle-color': isNight ? '#1A1C20' : '#ffffff',
            'circle-blur': 1,
            'circle-opacity': 0.75
        }
    });

    map.addLayer({
        id: 'literary-points-circle',
        type: 'symbol',
        source: 'literary-points',
        filter: ['!', ['has', 'point_count']],
        layout: {
            'icon-image': ['get', '_icon'],
            'icon-size': 0.15,
            'icon-allow-overlap': true,
            'text-field': ['get', 'name'],
            'text-font': ['Noto Sans Regular'],
            'text-size': 12,
            'text-offset': [0, 1.8],
            'text-anchor': 'top',
            'text-optional': true
        },
        paint: {
            'text-color': isNight ? '#FFFFFF' : '#2e2418',
            'text-halo-color': isNight ? '#1A1C20' : '#fbfbfb',
            'text-halo-width': 1.5,
            'text-opacity': 1
        }
    });

    singlePointHoverEnter = (e) => {
        map.getCanvas().style.cursor = 'pointer';
        showHoverTooltip(e);
    };
    map.on('mouseenter', 'literary-points-circle', singlePointHoverEnter);

    singlePointHoverLeave = () => {
        map.getCanvas().style.cursor = '';
        hideHoverTooltip();
    };
    map.on('mouseleave', 'literary-points-circle', singlePointHoverLeave);

    singlePointHoverMove = (e) => moveHoverTooltip(e);
    map.on('mousemove', 'literary-points-circle', singlePointHoverMove);

    singlePointClickHandler = (e) => {
        if (!e.features?.length) return;
        openSlidebar(e.features[0].properties);
        panToFeature(e.lngLat);
    };
    map.on('click', 'literary-points-circle', singlePointClickHandler);

    clusterHoverEnter = () => map.getCanvas().style.cursor = 'pointer';
    map.on('mouseenter', 'clusters', clusterHoverEnter);

    clusterHoverLeave = () => map.getCanvas().style.cursor = '';
    map.on('mouseleave', 'clusters', clusterHoverLeave);

    clusterClickHandler = (e) => {
        if (!e.features?.length) return;
        map.getSource('literary-points').getClusterExpansionZoom(
            e.features[0].properties.cluster_id,
            (err, zoom) => {
                if (err) return;
                map.easeTo({
                    center: e.features[0].geometry.coordinates,
                    zoom: zoom,
                    padding: { left: 30, right: 30, top: 30, bottom: 30 },
                    duration: 800
                });
            }
        );
    };
    map.on('click', 'clusters', clusterClickHandler);
}

function getUniqueTypes(world) {
    const types = new Set();
    const field = world === 'night' ? 'has_night' : 'has_day';
    literaryData.features.forEach(f => {
        if (f.properties[field] === 1) {
            const type = world === 'night' ? f.properties.night_type : f.properties.day_type;
            if (type) types.add(type);
        }
    });
    return Array.from(types).filter(Boolean).sort();
}

function getUniqueAuthors(world) {
    const authors = new Set();
    const field = world === 'night' ? 'has_night' : 'has_day';
    literaryData.features.forEach(f => {
        if (f.properties[field] === 1) f.properties.litraturer_array?.forEach(a => authors.add(a));
    });
    return Array.from(authors).filter(Boolean).sort();
}

function getAllBooks() {
    const books = new Set();
    literaryData.features.forEach(f => {
        if (f.properties.night_book) books.add(f.properties.night_book);
    });
    return Array.from(books).filter(Boolean).sort();
}

function buildFilterUI(world, forceReset = false) {
    currentWorld = world;
    const typeDiv = document.getElementById('type-checkboxes');
    const authorDiv = document.getElementById('author-checkboxes');
    const bookDiv = document.getElementById('book-checkboxes');

    typeDiv?.replaceChildren();
    authorDiv?.replaceChildren();
    bookDiv?.replaceChildren();

    const createChecks = (div, list, filterName) => {
        if (!div) return;
        list.forEach(val => {
            const label = document.createElement('label');
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = true;
            input.dataset.filter = filterName;
            input.dataset.value = val;
            label.append(input, document.createTextNode(' ' + val));
            div.appendChild(label);
        });
    };

    createChecks(typeDiv, getUniqueTypes(world), 'type');
    createChecks(authorDiv, getUniqueAuthors(world), 'litraturer');
    if (world === 'night') createChecks(bookDiv, getAllBooks(), 'night_book');

    document.querySelectorAll('.filter-section input[data-value="all"]').forEach(allCb => {
        const newCb = allCb.cloneNode(true);
        allCb.replaceWith(newCb);
        newCb.addEventListener('change', function() {
            const section = this.closest('.filter-section');
            section.querySelectorAll('input[type="checkbox"]:not([data-value="all"])').forEach(cb => cb.checked = this.checked);
            updateDependentFilters(section.id);
        });
    });

    document.querySelectorAll('#filter-panel input[type="checkbox"]:not([data-value="all"])').forEach(cb => {
        cb.addEventListener('change', function() {
            updateDependentFilters(this.closest('.filter-section').id);
        });
    });

    setupSearch('author-search', 'author-checkboxes');
    setupSearch('book-search', 'book-checkboxes');

    const defaultTypes = world === 'night' ? ['Место действия', 'Ориентир'] : ['Захоронение', 'Памятник', 'Мемориальная табличка'];
    typeDiv?.querySelectorAll('input[type="checkbox"]:not([data-value="all"])').forEach(cb => cb.checked = defaultTypes.includes(cb.dataset.value));
    updateTypeAllCheckbox();
    applyFilters();
}

function updateTypeAllCheckbox() {
    const allCb = document.querySelector('#filter-type input[data-value="all"]');
    if (!allCb) return;
    const cbs = document.querySelectorAll('#type-checkboxes input[type="checkbox"]:not([data-value="all"])');
    allCb.checked = Array.from(cbs).every(cb => cb.checked);
}

function syncLegendState() {
    document.querySelectorAll('.legend-item').forEach(item => {
        const cb = document.querySelector(`#type-checkboxes input[data-value="${item.dataset.type}"]`);
        if (cb) item.classList.toggle('disabled', !cb.checked);
    });
}

async function applyFilters() {
    if (!map.getLayer('literary-points-circle')) return;
    await updateCategoryColors();
    syncLegendState();
}

let updateDependentFiltersRunning = false;
function updateDependentFilters(changedSectionId) {
    if (!literaryData || currentWorld !== 'night') {
        applyFilters();
        return;
    }
    if (updateDependentFiltersRunning) return;
    updateDependentFiltersRunning = true;
    try {
        const selAuthors = getSelectedValues('author-checkboxes');
        const selBooks = getSelectedValues('book-checkboxes');

        if (changedSectionId === 'filter-author') {
            const booksSet = new Set();
            if (selAuthors.length > 0) {
                literaryData.features.filter(f => f.properties.has_night === 1).forEach(f => {
                    if (f.properties.night_book && f.properties.litraturer_array?.some(a => selAuthors.includes(a)))
                        booksSet.add(f.properties.night_book);
                });
            }
            updateCheckboxes('book-checkboxes', booksSet);
        }
        if (changedSectionId === 'filter-book') {
            const authorsSet = new Set();
            if (selBooks.length > 0) {
                literaryData.features.filter(f => f.properties.has_night === 1).forEach(f => {
                    if (f.properties.night_book && selBooks.includes(f.properties.night_book))
                        f.properties.litraturer_array?.forEach(a => authorsSet.add(a));
                });
            }
            updateCheckboxes('author-checkboxes', authorsSet);
        }
    } finally {
        updateDependentFiltersRunning = false;
    }
    applyFilters();
}

function updateCheckboxes(containerId, valuesSet) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = valuesSet.has(cb.dataset.value));
    const allCb = container.closest('.filter-section')?.querySelector('input[data-value="all"]');
    if (allCb) allCb.checked = Array.from(container.querySelectorAll('input[type="checkbox"]')).every(cb => cb.checked);
}

function setupSearch(inputId, containerId) {
    const input = document.getElementById(inputId);
    const container = document.getElementById(containerId);
    if (!input || !container) return;
    input.addEventListener('input', () => {
        const q = input.value.toLowerCase().trim();
        container.querySelectorAll('label').forEach(l => {
            l.style.display = l.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
    });
}

function buildLegend(world) {
    const panel = document.getElementById('legend-panel');
    if (!panel) return;
    panel.innerHTML = '';
    const allowed = world === 'night' ? ['Место действия', 'Ориентир'] : ['Захоронение', 'Памятник', 'Мемориальная табличка'];
    allowed.forEach(type => {
        const iconFile = TYPE_TO_ICON[type];
        if (!iconFile) return;
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.dataset.type = type;
        const img = document.createElement('img');
        img.src = `icons/${iconFile}.svg`;
        img.onerror = () => img.src = 'data:image/svg+xml;base64,...';
        const label = document.createElement('span');
        label.textContent = type;
        item.append(img, label);
        item.addEventListener('click', () => {
            const cb = document.querySelector(`#type-checkboxes input[data-value="${type}"]`);
            if (cb) {
                cb.checked = !cb.checked;
                updateTypeAllCheckbox();
                applyFilters();
            }
        });
        panel.appendChild(item);
    });
    syncLegendState();
}

function updateCategoryColorIndicators() {
    const colorMap = window._lastCategoryColors || {};
    document.querySelectorAll('#author-checkboxes input[type="checkbox"]').forEach(cb => {
        const cat = cb.dataset.value;
        cb.style.accentColor = colorMap[cat] || '#F5F5F5';
    });
    document.querySelectorAll('#book-checkboxes input[type="checkbox"]').forEach(cb => {
        const cat = cb.dataset.value;
        cb.style.accentColor = colorMap[cat] || '#F5F5F5';
    });
}

function openSlidebar(props) {
    const isNight = currentWorld === 'night';
    let html = `<h3>${props.name || ''}</h3>`;
    if (props.title) html += `<p><em>${props.title}</em></p>`;
    if (props[isNight ? 'night_type' : 'day_type']) html += `<p><strong>Тип:</strong> ${props[isNight ? 'night_type' : 'day_type']}</p>`;
    html += `<p>${(isNight ? props.night_description : props.day_description) || ''}</p>`;
    if (props.address) html += `<p><strong>Адрес:</strong> ${props.address}</p>`;
    if (props.litraturer) html += `<p><strong>Писатель:</strong> ${props.litraturer}</p>`;
    if (isNight && props.night_quote) html += `<blockquote>${props.night_quote}</blockquote>`;
    if (props.img_url) html += `<img src="${props.img_url}" alt="${props.name}" style="max-width:100%; margin-top:8px; border-radius:4px;">`;
    slidebarContent.innerHTML = html;
    slidebar.classList.remove('slidebar-closed');
    slidebar.classList.add('slidebar-open');
}

function closeSlidebar() {
    slidebar.classList.remove('slidebar-open');
    slidebar.classList.add('slidebar-closed');
}
closeSlidebarBtn.addEventListener('click', closeSlidebar);

function panToFeature(lngLat) {
    const sw = slidebar.classList.contains('slidebar-open') ? 340 : 0;
    map.easeTo({
        center: lngLat,
        zoom: map.getZoom(),
        padding: { left: 50, right: sw + 20, top: 50, bottom: 50 },
        duration: 800
    });
}

function showHoverTooltip(e) {
    const p = e.features[0].properties;
    const pt = map.project(e.lngLat);
    hoverImg.src = p.img_url || '';
    hoverImg.style.display = p.img_url ? 'block' : 'none';
    hoverName.textContent = p.name || '';
    hoverTooltip.style.display = 'block';
    hoverTooltip.style.left = (pt.x + 10) + 'px';
    hoverTooltip.style.top = (pt.y + 10) + 'px';
}

function moveHoverTooltip(e) {
    const pt = map.project(e.lngLat);
    hoverTooltip.style.left = (pt.x + 10) + 'px';
    hoverTooltip.style.top = (pt.y + 10) + 'px';
}

function hideHoverTooltip() {
    hoverTooltip.style.display = 'none';
}

const map = new maplibregl.Map({
    container: 'map',
    style: fixStyle(MY_FINAL_DAY_STYLE),
    center: [30.332, 59.935],
    zoom: 11,
    attributionControl: false
});

document.querySelectorAll('.world-btn').forEach(btn => {
    btn.onclick = async () => {
        const world = btn.dataset.world;
        currentWorld = world;
        document.querySelectorAll('.world-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.body.className = world + '-theme';

        const newStyle = world === 'day' ? MY_FINAL_DAY_STYLE : MY_FINAL_NIGHT_STYLE;
        map.setStyle(fixStyle(newStyle));
        await new Promise(r => map.once('idle', r));

        tintedIconCache.clear();
        await loadIcons();
        addLiteraryPoints();

        document.getElementById('filter-book').style.display = world === 'night' ? 'block' : 'none';
        buildFilterUI(world);
        buildLegend(world);
        await updateCategoryColors();
        closeSlidebar();
    };
});

map.on('load', async () => {
    console.log('🗺 Карта готова');
    await loadLiteraryData();
    if (!literaryData) return;
    processFeatures(literaryData.features);
    await loadIcons();
    addLiteraryPoints();
    buildFilterUI('day');
    buildLegend('day');
    updateCategoryColors();
});

map.on('click', (e) => {
    if (!map.queryRenderedFeatures(e.point, { layers: ['literary-points-circle'] }).length) closeSlidebar();
});

document.getElementById('reset-filters-btn').addEventListener('click', () => {
    buildFilterUI(currentWorld, true);
    buildLegend(currentWorld);
    updateCategoryColors();
});

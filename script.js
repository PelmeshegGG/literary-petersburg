// ========================
// НАСТРОЙКИ КЛАСТЕРИЗАЦИИ (меняйте смело)
// ========================
const CLUSTER_MAX_ZOOM = 15;   // максимальный зум, на котором ещё работают кластеры
const CLUSTER_RADIUS = 25;     // радиус объединения точек в пикселях

// ========================
// Функция-лечилка стилей
// ========================
function fixStyle(style) {
    const s = JSON.parse(JSON.stringify(style));
    if (!s.layers) return s;
    s.layers.forEach(l => {
        if (l.layout && l.layout['symbol-sort-key']) {
            l.layout['symbol-sort-key'] = ["coalesce", l.layout['symbol-sort-key'], 0];
        }
    });
    return s;
}

// ========================
// Сопоставление типов и иконок
// ========================
const TYPE_TO_ICON = {
    "Захоронение": "zahoroneniya",
    "Памятник": "pamyatnik",
    "Мемориальная табличка": "memorialnaya_tablichka",
    "Место действия": "mesto_deystviya",
    "Ориентир": "orientir"
};

// ========================
// Глобальные переменные
// ========================
let literaryData = null;
let currentWorld = 'day';
const searchQueries = {};

// Элементы интерфейса
const mapContainer = document.getElementById('map');
const slidebar = document.getElementById('slidebar');
const slidebarContent = document.getElementById('slidebar-content');
const closeSlidebarBtn = document.getElementById('close-slidebar');
const hoverTooltip = document.getElementById('hover-tooltip');
const hoverImg = document.getElementById('hover-img');
const hoverName = document.getElementById('hover-name');

// Ссылки на обработчики событий, чтобы можно было их снимать
let clusterClickHandler = null;
let singlePointClickHandler = null;
let singlePointHoverEnter = null;
let singlePointHoverLeave = null;
let singlePointHoverMove = null;
let clusterHoverEnter = null;
let clusterHoverLeave = null;

// ========================
// Загрузка GeoJSON
// ========================
async function loadLiteraryData() {
    try {
        const response = await fetch('literary_places.geojson');
        literaryData = await response.json();
        console.log('✅ GeoJSON загружен, всего точек:', literaryData.features.length);
    } catch (err) {
        console.error('❌ Ошибка загрузки GeoJSON:', err);
    }
}

// ========================
// Обработка свойств точек
// ========================
function processFeatures(features) {
    features.forEach(f => {
        const props = f.properties;

        props.has_day = props.has_day !== null && props.has_day !== undefined ? Number(props.has_day) : null;
        props.has_night = props.has_night !== null && props.has_night !== undefined ? Number(props.has_night) : null;

        if (props.litraturer) {
            props.litraturer_array = props.litraturer.split(', ').map(s => s.trim());
        } else {
            props.litraturer_array = [];
        }

        const rawTypes = (props.type || '').split(',').map(s => s.trim()).filter(Boolean);
        let dayType = null, nightType = null;
        if (rawTypes.length === 2) {
            dayType = rawTypes[0];
            nightType = rawTypes[1];
        } else if (rawTypes.length === 1) {
            const t = rawTypes[0];
            if (["Захоронение", "Памятник", "Мемориальная табличка"].includes(t)) {
                dayType = t;
            } else if (["Место действия", "Ориентир"].includes(t)) {
                nightType = t;
            } else {
                dayType = t;
            }
        }

        if (props.has_night === 1 && !nightType) {
            nightType = "Место действия";
        }

        props.day_type = dayType;
        props.night_type = nightType;
        props.day_icon = dayType ? TYPE_TO_ICON[dayType] : null;
        props.night_icon = nightType ? TYPE_TO_ICON[nightType] : null;

        if (f.geometry.coordinates[1] > 80) {
            console.warn(`Исправляю координаты для "${props.name}"`);
            const tmp = f.geometry.coordinates[0];
            f.geometry.coordinates[0] = f.geometry.coordinates[1];
            f.geometry.coordinates[1] = tmp;
        }
    });
}

// ========================
// Загрузка иконок
// ========================
async function loadIcons() {
    Object.values(TYPE_TO_ICON).forEach(name => {
        if (map.hasImage(name)) map.removeImage(name);
    });

    const promises = [];
    for (const [typeName, fileName] of Object.entries(TYPE_TO_ICON)) {
        promises.push(new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                if (!map.hasImage(fileName)) map.addImage(fileName, img);
                resolve();
            };
            img.onerror = () => {
                console.warn(`Иконка "${typeName}" не найдена, использую заглушку`);
                if (!map.hasImage(fileName)) {
                    const canvas = document.createElement('canvas');
                    canvas.width = 20; canvas.height = 20;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#AF2C22';
                    ctx.beginPath(); ctx.arc(10, 10, 8, 0, 2 * Math.PI); ctx.fill();
                    map.addImage(fileName, canvas);
                }
                resolve();
            };
            img.src = `icons/${fileName}.svg`;
        }));
    }
    await Promise.all(promises);
    console.log('🖼 Все иконки обработаны');
}

// ========================
// Получение отфильтрованных точек
// ========================
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
        if (activeAuthors.length > 0) {
            if (!p.litraturer_array || !p.litraturer_array.some(a => activeAuthors.includes(a))) return false;
        }
        if (isNight && activeBooks.length > 0) {
            if (!p.night_book || !activeBooks.includes(p.night_book)) return false;
        }
        return true;
    });
}

function updateSourceData() {
    const source = map.getSource('literary-points');
    if (!source) return;
    const filtered = getFilteredData();
    source.setData({
        type: 'FeatureCollection',
        features: filtered
    });
}

// ========================
// Удаление старых обработчиков событий
// ========================
function removeEventHandlers() {
    if (clusterClickHandler) {
        map.off('click', 'clusters', clusterClickHandler);
        clusterClickHandler = null;
    }
    if (singlePointClickHandler) {
        map.off('click', 'literary-points-circle', singlePointClickHandler);
        singlePointClickHandler = null;
    }
    if (singlePointHoverEnter) {
        map.off('mouseenter', 'literary-points-circle', singlePointHoverEnter);
        singlePointHoverEnter = null;
    }
    if (singlePointHoverLeave) {
        map.off('mouseleave', 'literary-points-circle', singlePointHoverLeave);
        singlePointHoverLeave = null;
    }
    if (singlePointHoverMove) {
        map.off('mousemove', 'literary-points-circle', singlePointHoverMove);
        singlePointHoverMove = null;
    }
    if (clusterHoverEnter) {
        map.off('mouseenter', 'clusters', clusterHoverEnter);
        clusterHoverEnter = null;
    }
    if (clusterHoverLeave) {
        map.off('mouseleave', 'clusters', clusterHoverLeave);
        clusterHoverLeave = null;
    }
}

// ========================
// Добавление слоёв и обработчиков событий
// ========================
function addLiteraryPoints() {
    // Удаляем старые слои и источник
    ['literary-points-circle', 'clusters', 'cluster-count'].forEach(id => {
        if (map.getLayer(id)) map.removeLayer(id);
    });
    if (map.getSource('literary-points')) map.removeSource('literary-points');

    // Снимаем старые обработчики, чтобы не накапливались
    removeEventHandlers();

    const worldField = currentWorld === 'night' ? 'has_night' : 'has_day';
    const initialFeatures = literaryData.features.filter(f => f.properties[worldField] === 1);

    map.addSource('literary-points', {
        type: 'geojson',
        data: {
            type: 'FeatureCollection',
            features: initialFeatures
        },
        cluster: true,
        clusterMaxZoom: CLUSTER_MAX_ZOOM,
        clusterRadius: CLUSTER_RADIUS
    });

    // --- Слой кластеров (круги) ---
    map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'literary-points',
        filter: ['has', 'point_count'],
        paint: {
            'circle-color': [
                'step',
                ['get', 'point_count'],
                '#AF2C22',
                10, '#D2604A',
                30, '#E08B79',
                100, '#F0B5A0'
            ],
            'circle-radius': [
                'step',
                ['get', 'point_count'],
                15,
                10, 20,
                30, 25,
                100, 30
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff'
        }
    });

    // --- Слой чисел в кластерах ---
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

    // --- Слой отдельных точек ---
    map.addLayer({
        id: 'literary-points-circle',
        type: 'symbol',
        source: 'literary-points',
        filter: ['!', ['has', 'point_count']],
        layout: {
            'icon-image': ['get', currentWorld === 'night' ? 'night_icon' : 'day_icon'],
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
            'text-color': '#111111',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1.5
        }
    });

    // === Назначение обработчиков событий ===

    // Ховер по отдельным точкам
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

    singlePointHoverMove = (e) => {
        moveHoverTooltip(e);
    };
    map.on('mousemove', 'literary-points-circle', singlePointHoverMove);

    // Клик по отдельной точке
    singlePointClickHandler = (e) => {
        if (!e.features || !e.features.length) return;
        const props = e.features[0].properties;
        openSlidebar(props);
        panToFeature(e.lngLat);
    };
    map.on('click', 'literary-points-circle', singlePointClickHandler);

    // Ховер по кластерам
    clusterHoverEnter = () => {
        map.getCanvas().style.cursor = 'pointer';
    };
    map.on('mouseenter', 'clusters', clusterHoverEnter);

    clusterHoverLeave = () => {
        map.getCanvas().style.cursor = '';
    };
    map.on('mouseleave', 'clusters', clusterHoverLeave);

    // Клик по кластеру
    clusterClickHandler = (e) => {
        if (!e.features || !e.features.length) return;
        const clusterId = e.features[0].properties.cluster_id;
        const source = map.getSource('literary-points');
        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err) return;
            map.easeTo({
                center: e.features[0].geometry.coordinates,
                zoom: zoom,
                padding: { left: 30, right: 30, top: 30, bottom: 30 },
                duration: 800
            });
        });
    };
    map.on('click', 'clusters', clusterClickHandler);
}

// ========================
// Вспомогательные функции
// ========================
function getUniqueTypes(world) {
    const types = new Set();
    const field = world === 'night' ? 'has_night' : 'has_day';
    literaryData.features.forEach(f => {
        if (f.properties[field] !== 1) return;
        const type = world === 'night' ? f.properties.night_type : f.properties.day_type;
        if (type) types.add(type);
    });
    return Array.from(types).filter(Boolean).sort();
}

function getUniqueAuthors(world) {
    const authors = new Set();
    const field = world === 'night' ? 'has_night' : 'has_day';
    literaryData.features.forEach(f => {
        if (f.properties[field] !== 1) return;
        if (f.properties.litraturer_array) {
            f.properties.litraturer_array.forEach(a => authors.add(a));
        }
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

function getSelectedValues(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    return Array.from(container.querySelectorAll('input:checked:not([data-value="all"])')).map(cb => cb.dataset.value);
}

// ========================
// Построение UI фильтров
// ========================
function buildFilterUI(world, forceReset = false) {
    console.log('🏗 buildFilterUI начал работу для мира:', world);
    currentWorld = world;

    const typeDiv = document.getElementById('type-checkboxes');
    const authorDiv = document.getElementById('author-checkboxes');
    const bookDiv = document.getElementById('book-checkboxes');

    if (typeDiv) typeDiv.replaceChildren();
    if (authorDiv) authorDiv.replaceChildren();
    if (bookDiv) bookDiv.replaceChildren();

    if (typeDiv) {
        getUniqueTypes(world).forEach(type => {
            const label = document.createElement('label');
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = true;
            input.dataset.filter = 'type';
            input.dataset.value = type;
            label.appendChild(input);
            label.appendChild(document.createTextNode(' ' + type));
            typeDiv.appendChild(label);
        });
    }

    if (authorDiv) {
        getUniqueAuthors(world).forEach(author => {
            const label = document.createElement('label');
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = true;
            input.dataset.filter = 'litraturer';
            input.dataset.value = author;
            label.appendChild(input);
            label.appendChild(document.createTextNode(' ' + author));
            authorDiv.appendChild(label);
        });
    }

    if (bookDiv && world === 'night') {
        getAllBooks().forEach(book => {
            const label = document.createElement('label');
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = true;
            input.dataset.filter = 'night_book';
            input.dataset.value = book;
            label.appendChild(input);
            label.appendChild(document.createTextNode(' ' + book));
            bookDiv.appendChild(label);
        });
    }

    document.querySelectorAll('.filter-section input[data-value="all"]').forEach(allCb => {
        const newAllCb = allCb.cloneNode(true);
        allCb.parentNode.replaceChild(newAllCb, allCb);
        newAllCb.addEventListener('change', function() {
            const section = this.closest('.filter-section');
            const checkboxes = section.querySelectorAll('input[type="checkbox"]:not([data-value="all"])');
            checkboxes.forEach(cb => cb.checked = this.checked);
            updateDependentFilters(this.closest('.filter-section').id);
        });
    });

    document.querySelectorAll('#filter-panel input[type="checkbox"]:not([data-value="all"])').forEach(cb => {
        cb.addEventListener('change', function(e) {
            updateDependentFilters(this.closest('.filter-section').id);
        });
    });

    setupSearch('author-search', 'author-checkboxes');
    setupSearch('book-search', 'book-checkboxes');

    document.querySelectorAll('.filter-section').forEach(section => {
        const allCb = section.querySelector('input[data-value="all"]');
        if (!allCb) return;
        const checkboxes = section.querySelectorAll('input[type="checkbox"]:not([data-value="all"])');
        allCb.checked = checkboxes.length > 0 && Array.from(checkboxes).every(cb => cb.checked);
    });

    // Установка типов по умолчанию
    const defaultTypes = world === 'night'
        ? ['Место действия', 'Ориентир']
        : ['Захоронение', 'Памятник', 'Мемориальная табличка'];

    const typeCheckboxes = document.querySelectorAll('#type-checkboxes input[type="checkbox"]:not([data-value="all"])');
    typeCheckboxes.forEach(cb => {
        cb.checked = defaultTypes.includes(cb.dataset.value);
    });

    updateTypeAllCheckbox();
    
    // синхронизация master-чекбокса "Выбрать всё"
    const typeAllCb = document.querySelector('#filter-type input[data-value="all"]');
    if (typeAllCb) {
        const allChecked = Array.from(typeCheckboxes).every(cb => cb.checked);
        typeAllCb.checked = allChecked;
    }

    applyFilters();
}

// ========================
// Поиск
// ========================
function setupSearch(inputId, containerId) {
    const searchInput = document.getElementById(inputId);
    const container = document.getElementById(containerId);
    if (!searchInput || !container) return;

    const searchKey = containerId;
    searchInput.addEventListener('input', function() {
        const query = this.value.toLowerCase().trim();
        searchQueries[searchKey] = query;
        applySearchFilter(containerId, query);
    });

    searchInput.value = '';
    searchQueries[searchKey] = '';
    applySearchFilter(containerId, '');
}

function applySearchFilter(containerId, query) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const labels = container.querySelectorAll('label');
    labels.forEach(label => {
        const text = label.textContent?.toLowerCase() || '';
        label.style.display = text.includes(query) ? '' : 'none';
    });
}

// ========================
// Зависимые фильтры
// ========================
updateDependentFilters.running = false;

function updateDependentFilters(changedSectionId) {
    if (!literaryData || currentWorld !== 'night') {
        applyFilters();
        return;
    }

    if (updateDependentFilters.running) return;
    updateDependentFilters.running = true;

    try {
        const selectedAuthors = getSelectedValues('author-checkboxes');
        const selectedBooks = getSelectedValues('book-checkboxes');

        if (changedSectionId === 'filter-author') {
            const booksToSelect = new Set();
            if (selectedAuthors.length > 0) {
                literaryData.features.filter(f => f.properties.has_night === 1).forEach(f => {
                    if (f.properties.night_book &&
                        f.properties.litraturer_array &&
                        f.properties.litraturer_array.some(a => selectedAuthors.includes(a))) {
                        booksToSelect.add(f.properties.night_book);
                    }
                });
            }
            updateCheckboxes('book-checkboxes', booksToSelect);
        }

        if (changedSectionId === 'filter-book') {
            const authorsToSelect = new Set();
            if (selectedBooks.length > 0) {
                literaryData.features.filter(f => f.properties.has_night === 1).forEach(f => {
                    if (f.properties.night_book &&
                        selectedBooks.includes(f.properties.night_book) &&
                        f.properties.litraturer_array) {
                        f.properties.litraturer_array.forEach(a => authorsToSelect.add(a));
                    }
                });
            }
            updateCheckboxes('author-checkboxes', authorsToSelect);
        }
    } finally {
        updateDependentFilters.running = false;
    }

    applyFilters();
}

function updateCheckboxes(containerId, valuesToCheck) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = valuesToCheck.has(cb.dataset.value);
    });
    const section = container.closest('.filter-section');
    if (section) {
        const allCb = section.querySelector('input[data-value="all"]');
        if (allCb) {
            const checkboxes = container.querySelectorAll('input[type="checkbox"]');
            allCb.checked = checkboxes.length > 0 && Array.from(checkboxes).every(cb => cb.checked);
        }
    }
}

// ========================
// Применение фильтров
// ========================
function applyFilters() {
    if (!map.getLayer('literary-points-circle')) return;

    const isNight = currentWorld === 'night';
    map.setLayoutProperty('literary-points-circle', 'icon-image', ['get', isNight ? 'night_icon' : 'day_icon']);
    updateSourceData();
    syncLegendState();  // <-- добавить
    console.log('🔍 Фильтр обновлён');
}

// ========================
// СЛАЙДБАР
// ========================
function openSlidebar(props) {
    const isNight = currentWorld === 'night';
    const currentType = isNight ? props.night_type : props.day_type;
    const desc = isNight ? props.night_description : props.day_description;

    let html = `<h3>${props.name || ''}</h3>`;
    if (props.title) html += `<p><em>${props.title}</em></p>`;
    if (currentType) html += `<p><strong>Тип:</strong> ${currentType}</p>`;
    html += `<p>${desc || ''}</p>`;
    if (props.address) html += `<p><strong>Адрес:</strong> ${props.address}</p>`;
    if (props.litraturer) html += `<p><strong>Писатель:</strong> ${props.litraturer}</p>`;
    if (isNight && props.night_quote) {
        html += `<blockquote>${props.night_quote}</blockquote>`;
    }
    if (props.img_url) {
        html += `<img src="${props.img_url}" alt="${props.name}" style="max-width:100%; margin-top:8px; border-radius:4px;">`;
    }
    slidebarContent.innerHTML = html;
    slidebar.classList.remove('slidebar-closed');
    slidebar.classList.add('slidebar-open');
}

function closeSlidebar() {
    slidebar.classList.remove('slidebar-open');
    slidebar.classList.add('slidebar-closed');
}

closeSlidebarBtn.addEventListener('click', closeSlidebar);

// ========================
// ЦЕНТРИРОВАНИЕ
// ========================
function panToFeature(lngLat) {
    const slidebarWidth = slidebar.classList.contains('slidebar-open') ? 340 : 0;
    const padding = {
        left: 50,
        right: slidebarWidth + 20,
        top: 50,
        bottom: 50
    };

    map.easeTo({
        center: lngLat,
        zoom: map.getZoom(),
        padding: padding,
        duration: 800
    });
}

// ========================
// ХОВЕР-ТУЛТИП
// ========================
function showHoverTooltip(e) {
    const props = e.features[0].properties;
    const coords = e.lngLat;
    const point = map.project(coords);

    hoverImg.src = props.img_url || '';
    hoverImg.style.display = props.img_url ? 'block' : 'none';
    hoverName.textContent = props.name || '';

    hoverTooltip.style.display = 'block';
    hoverTooltip.style.left = (point.x + 10) + 'px';
    hoverTooltip.style.top  = (point.y + 10) + 'px';
}

function moveHoverTooltip(e) {
    const point = map.project(e.lngLat);
    hoverTooltip.style.left = (point.x + 10) + 'px';
    hoverTooltip.style.top  = (point.y + 10) + 'px';
}

function hideHoverTooltip() {
    hoverTooltip.style.display = 'none';
}

// ========================
// Инициализация карты
// ========================
const map = new maplibregl.Map({
    container: 'map',
    style: fixStyle(MY_FINAL_DAY_STYLE),
    center: [30.332, 59.935],
    zoom: 11,
    attributionControl: false
});

// ========================
// Переключение тем
// ========================
document.querySelectorAll('.world-btn').forEach(btn => {
    btn.onclick = async () => {
        const world = btn.dataset.world;
        console.log('🔄 Переключение на тему:', world);

        currentWorld = world;

        document.querySelectorAll('.world-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.body.className = world + '-theme';

        const newStyle = (world === 'day') ? MY_FINAL_DAY_STYLE : MY_FINAL_NIGHT_STYLE;
        map.setStyle(fixStyle(newStyle));

        await new Promise(resolve => map.once('idle', resolve));

        await loadIcons();
        addLiteraryPoints();

        const filterBook = document.getElementById('filter-book');
        if (filterBook) filterBook.style.display = (world === 'night') ? 'block' : 'none';

        buildFilterUI(world);
        buildLegend(world);
        closeSlidebar();
    };
});

// ========================
// Первый запуск
// ========================
map.on('load', async () => {
    console.log('🗺 Карта готова');
    await loadLiteraryData();
    if (!literaryData) return;
    processFeatures(literaryData.features);
    await loadIcons();
    addLiteraryPoints();
    buildFilterUI('day');
    buildLegend('day');
});

// Закрытие слайдбара при клике на пустое место
map.on('click', (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: ['literary-points-circle'] });
    if (!features.length) {
        closeSlidebar();
    }
});

// --- Легенда ---
function buildLegend(world) {
    const panel = document.getElementById('legend-panel');
    if (!panel) return;
    panel.innerHTML = '';

    const allowedTypes = world === 'night'
        ? ['Место действия', 'Ориентир']
        : ['Захоронение', 'Памятник', 'Мемориальная табличка'];

    allowedTypes.forEach(type => {
        const iconFile = TYPE_TO_ICON[type];
        if (!iconFile) return;
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.dataset.type = type;

        const img = document.createElement('img');
        img.src = `icons/${iconFile}.svg`;
        img.onerror = () => { img.src = 'data:image/svg+xml,...'; };

        const label = document.createElement('span');
        label.textContent = type;

        item.appendChild(img);
        item.appendChild(label);

        item.addEventListener('click', () => {
            const cb = document.querySelector(`#type-checkboxes input[data-value="${type}"]`);
            if (cb) {
                cb.checked = !cb.checked;
                updateTypeAllCheckbox();
                applyFilters();
                syncLegendState();
            }
        });

        panel.appendChild(item);
    });

    syncLegendState();
}

function updateTypeAllCheckbox() {
    const allCb = document.querySelector('#filter-type input[data-value="all"]');
    if (!allCb) return;
    const checkboxes = document.querySelectorAll('#type-checkboxes input[type="checkbox"]:not([data-value="all"])');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    allCb.checked = allChecked;
}

function syncLegendState() {
    document.querySelectorAll('.legend-item').forEach(item => {
        const type = item.dataset.type;
        const cb = document.querySelector(`#type-checkboxes input[data-value="${type}"]`);
        if (cb) {
            if (cb.checked) {
                item.classList.remove('disabled');
            } else {
                item.classList.add('disabled');
            }
        }
    });
}

// --- Кнопка сброса фильтров ---
document.getElementById('reset-filters-btn').addEventListener('click', () => {
    buildFilterUI(currentWorld, true);
    buildLegend(currentWorld);
});
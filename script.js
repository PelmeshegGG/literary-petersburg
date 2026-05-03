// --- Функция-лечилка стилей ---
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

// --- Сопоставление русских типов и имён файлов иконок ---
const TYPE_TO_ICON = {
    "Захоронение": "zahoroneniya",
    "Памятник": "pamyatnik",
    "Мемориальная табличка": "memorialnaya_tablichka",
    "Место действия": "mesto_deystviya",
    "Ориентир": "orientir"
};

// --- Глобальная переменная для данных ---
let literaryData = null;

// --- Загрузка GeoJSON ---
async function loadLiteraryData() {
    try {
        const response = await fetch('literary_places.geojson');
        literaryData = await response.json();
        console.log('✅ GeoJSON загружен, всего точек:', literaryData.features.length);
    } catch (err) {
        console.error('❌ Ошибка загрузки GeoJSON:', err);
    }
}

// --- Обработка свойств точек: авторы, типы, иконки ---
function processFeatures(features) {
    features.forEach(f => {
        const props = f.properties;

        // Исправляем has_day / has_night – на случай, если пришли строки "1"
        props.has_day = props.has_day !== null && props.has_day !== undefined ? Number(props.has_day) : null;
        props.has_night = props.has_night !== null && props.has_night !== undefined ? Number(props.has_night) : null;

        // 1. Разбиваем авторов
        if (props.litraturer) {
            props.litraturer_array = props.litraturer.split(', ').map(s => s.trim());
        } else {
            props.litraturer_array = [];
        }

        // 2. Типы (как раньше)
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
                dayType = t; // неизвестный тип считаем дневным
            }
        }

        // 3. Если объект должен быть в ночном мире, но нет nightType – даём "Место действия"
        if (props.has_night === 1 && !nightType) {
            nightType = "Место действия";
        }

        props.day_type = dayType;
        props.night_type = nightType;
        props.day_icon = dayType ? TYPE_TO_ICON[dayType] : null;
        props.night_icon = nightType ? TYPE_TO_ICON[nightType] : null;

        // 4. Проверка координат: если широта > 80, вероятно порядок неверный – меняем местами
        if (f.geometry.coordinates[1] > 80) {
            console.warn(`Исправляю координаты для "${props.name}" – было [${f.geometry.coordinates}], меняю на [${f.geometry.coordinates[1]}, ${f.geometry.coordinates[0]}]`);
            const tmp = f.geometry.coordinates[0];
            f.geometry.coordinates[0] = f.geometry.coordinates[1];
            f.geometry.coordinates[1] = tmp;
        }
    });
}

// --- Загрузка иконок ---
async function loadIcons() {
    const promises = [];
    for (const [typeName, fileName] of Object.entries(TYPE_TO_ICON)) {
        promises.push(new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                map.addImage(fileName, img);
                resolve();
            };
            img.onerror = () => {
                console.warn(`Иконка "${typeName}" не найдена, использую заглушку`);
                const canvas = document.createElement('canvas');
                canvas.width = 20; canvas.height = 20;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#AF2C22';
                ctx.beginPath(); ctx.arc(10, 10, 8, 0, 2 * Math.PI); ctx.fill();
                map.addImage(fileName, canvas);
                resolve();
            };
            img.src = `icons/${fileName}.svg`;
        }));
    }
    await Promise.all(promises);
    console.log('🖼 Все иконки обработаны');
}

// --- Добавление слоя на карту ---
function addLiteraryPoints() {
    if (!literaryData) {
        console.warn('⚠️ literaryData ещё не загружен');
        return;
    }

    if (map.getLayer('literary-points-circle')) map.removeLayer('literary-points-circle');
    if (map.getSource('literary-points')) map.removeSource('literary-points');

    map.addSource('literary-points', {
        type: 'geojson',
        data: literaryData
    });

    map.addLayer({
        id: 'literary-points-circle',
        type: 'symbol',
        source: 'literary-points',
        layout: {
            'icon-image': ['get', 'day_icon'],   // будет меняться динамически
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
    console.log('➕ Слой с иконками добавлен');
}

// --- Вспомогательные функции для фильтров (принимают world) ---
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

function getUniqueBooks() {
    const books = new Set();
    literaryData.features.forEach(f => {
        if (f.properties.night_book) books.add(f.properties.night_book);
    });
    return Array.from(books).filter(Boolean).sort();
}

// --- Построение интерфейса фильтров ---
function buildFilterUI(world) {
    console.log('🏗 buildFilterUI начал работу для мира:', world);
    const typeDiv = document.getElementById('type-checkboxes');
    const authorDiv = document.getElementById('author-checkboxes');
    const bookDiv = document.getElementById('book-checkboxes');

    // Полная очистка
    if (typeDiv) typeDiv.replaceChildren();
    if (authorDiv) authorDiv.replaceChildren();
    if (bookDiv) bookDiv.replaceChildren();

    // Типы
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

    // Авторы
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

    // Книги (только для ночи)
    if (bookDiv && world === 'night') {
        getUniqueBooks().forEach(book => {
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

    // === ВОТ ЭТОТ БЛОК БЫЛ ИСПОРЧЕН – ТЕПЕРЬ ОН ПРАВИЛЬНЫЙ ===
    // Обработчики «Выбрать всё»
    document.querySelectorAll('.filter-section input[data-value="all"]').forEach(allCb => {
        // Клонируем элемент, чтобы гарантированно сбросить старые обработчики
        const newAllCb = allCb.cloneNode(true);
        allCb.parentNode.replaceChild(newAllCb, allCb);
        newAllCb.addEventListener('change', function() {
            const section = this.closest('.filter-section');
            const checkboxes = section.querySelectorAll('input[type="checkbox"]:not([data-value="all"])');
            checkboxes.forEach(cb => cb.checked = this.checked);
            applyFilters();
        });
    });

    // Обработчики отдельных чекбоксов
    document.querySelectorAll('#filter-panel input[type="checkbox"]:not([data-value="all"])').forEach(cb => {
        cb.addEventListener('change', applyFilters);
    });
}

// --- Легенда ---
function buildLegend() {
    const panel = document.getElementById('legend-panel');
    if (!panel) return;
    panel.innerHTML = '';
    const types = Object.keys(TYPE_TO_ICON);
    types.forEach(type => {
        const item = document.createElement('div');
        item.className = 'legend-item';
        const img = document.createElement('img');
        img.src = `icons/${TYPE_TO_ICON[type]}.svg`;
        img.onerror = () => { img.src = 'data:image/svg+xml;base64,...'; };
        const tooltip = document.createElement('span');
        tooltip.className = 'legend-tooltip';
        tooltip.textContent = type;
        item.appendChild(img);
        item.appendChild(tooltip);
        panel.appendChild(item);
    });
}

// --- Применение фильтров ---
function applyFilters() {
    if (!map.getLayer('literary-points-circle')) return;

    const isNight = document.body.classList.contains('night-theme');

    // Устанавливаем правильную иконку для текущего времени суток
    const iconProperty = isNight ? 'night_icon' : 'day_icon';
    map.setLayoutProperty('literary-points-circle', 'icon-image', ['get', iconProperty]);

    // Собираем активные галочки
    const activeTypes = Array.from(document.querySelectorAll('#type-checkboxes input:checked:not([data-value="all"])'))
        .map(cb => cb.dataset.value);
    const activeAuthors = Array.from(document.querySelectorAll('#author-checkboxes input:checked:not([data-value="all"])'))
        .map(cb => cb.dataset.value);
    const activeBooks = Array.from(document.querySelectorAll('#book-checkboxes input:checked:not([data-value="all"])'))
        .map(cb => cb.dataset.value);

    // Базовый фильтр мира
    const worldFilter = isNight 
        ? ['==', ['get', 'has_night'], 1] 
        : ['==', ['get', 'has_day'], 1];

    // Фильтр по типу (используем day_type или night_type)
    const typeField = isNight ? 'night_type' : 'day_type'; // <-- вот эта строка была потеряна
    const typeFilter = activeTypes.length > 0
        ? ['match', ['get', typeField], activeTypes, true, false]
        : ['literal', false];   // если ничего не выбрано – скрываем всё

    // Фильтр по авторам (хотя бы один из выбранных)
    const authorFilter = activeAuthors.length > 0
        ? ['any', ...activeAuthors.map(a => ['in', a, ['get', 'litraturer_array']])]
        : ['literal', false];

    // Фильтр по книгам (только ночью)
    let bookFilter = ['literal', true]; // по умолчанию показываем всё, если секция скрыта
    if (isNight && activeBooks.length > 0) {
        bookFilter = ['match', ['get', 'night_book'], activeBooks, true, false];
    } else if (isNight && activeBooks.length === 0) {
        bookFilter = ['literal', false]; // если ничего не выбрано – скрываем
    }

    map.setFilter('literary-points-circle', ['all', worldFilter, typeFilter, authorFilter, bookFilter]);
    console.log('🔍 Фильтр обновлён');
}

// --- Инициализация карты ---
const map = new maplibregl.Map({
    container: 'map',
    style: fixStyle(MY_FINAL_DAY_STYLE),
    center: [30.332, 59.935],
    zoom: 11,
    attributionControl: false
});

// --- Переключение тем ---
document.querySelectorAll('.world-btn').forEach(btn => {
    btn.onclick = () => {
        const world = btn.dataset.world;
        console.log('🔄 Переключение на тему:', world);

        document.querySelectorAll('.world-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.body.className = world + '-theme';

        const newStyle = (world === 'day') ? MY_FINAL_DAY_STYLE : MY_FINAL_NIGHT_STYLE;
        map.setStyle(fixStyle(newStyle));

        map.once('idle', () => {
            addLiteraryPoints();
            // Показываем/скрываем секцию книг
            const filterBook = document.getElementById('filter-book');
            if (filterBook) {
                filterBook.style.display = (world === 'night') ? 'block' : 'none';
            }
            // Перестраиваем фильтры под текущий мир
            buildFilterUI(world);
            applyFilters();
        });
    };
});

// --- Первый запуск ---
map.on('load', async () => {
    console.log('🗺 Карта готова');
    await loadLiteraryData();
    if (!literaryData) return;
    processFeatures(literaryData.features);
    await loadIcons();
    addLiteraryPoints();
    // Первый запуск – дневная тема
    buildFilterUI('day');
    applyFilters();
    buildLegend();
});

// --- Клик по точке (попап) ---
map.on('click', 'literary-points-circle', (e) => {
    const props = e.features[0].properties;
    const isNight = document.body.classList.contains('night-theme');

    const currentType = isNight ? props.night_type : props.day_type;
    const desc = isNight ? props.night_description : props.day_description;

    let html = `<h3>${props.name || ''}</h3>`;
    if (props.title) html += `<p><em>${props.title}</em></p>`;
    if (currentType) html += `<p><strong>Тип:</strong> ${currentType}</p>`;
    html += `<p>${desc || ''}</p>`;
    if (props.address) html += `<p><strong>Адрес:</strong> ${props.address}</p>`;
    if (props.litraturer) html += `<p><strong>Писатель:</strong> ${props.litraturer}</p>`;
    if (isNight && props.night_quote) {
        html += `<blockquote style="font-style:italic; border-left:3px solid #AF2C22; padding-left:8px;">${props.night_quote}</blockquote>`;
    }
    if (props.img_url) {
        html += `<img src="${props.img_url}" alt="${props.name}" style="max-width:200px; display:block; margin-top:8px; border-radius:4px;">`;
    }
    new maplibregl.Popup().setLngLat(e.lngLat).setHTML(html).addTo(map);
});

// --- Курсор при наведении ---
map.on('mouseenter', 'literary-points-circle', () => map.getCanvas().style.cursor = 'pointer');
map.on('mouseleave', 'literary-points-circle', () => map.getCanvas().style.cursor = '');

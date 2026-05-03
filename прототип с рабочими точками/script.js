// --- Функция-лечилка стилей (без изменений) ---
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

// --- Добавление слоёв на карту ---
function addLiteraryPoints() {
    console.log('🔄 addLiteraryPoints вызвана. literaryData:', literaryData ? 'есть' : 'нет');
    if (!literaryData) {
        console.warn('⚠️ literaryData ещё не загружен, точки не добавлены.');
        return;
    }

    // Удаляем старые слои/источник (если есть)
    if (map.getLayer('literary-points-circle')) {
        map.removeLayer('literary-points-circle');
        console.log('🗑 Удалён старый слой circle');
    }
    if (map.getLayer('literary-points-labels')) {
        map.removeLayer('literary-points-labels');
        console.log('🗑 Удалён старый слой labels');
    }
    if (map.getSource('literary-points')) {
        map.removeSource('literary-points');
        console.log('🗑 Удалён старый источник');
    }

    // Источник GeoJSON
    map.addSource('literary-points', {
        type: 'geojson',
        data: literaryData
    });
    console.log('➕ Источник добавлен');

    // Слой кружков
    map.addLayer({
        id: 'literary-points-circle',
        type: 'circle',
        source: 'literary-points',
        paint: {
            'circle-radius': 7,
            'circle-color': '#AF2C22',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff'
        }
    });
    console.log('➕ Слой кружков добавлен');

    // Слой подписей
    map.addLayer({
        id: 'literary-points-labels',
        type: 'symbol',
        source: 'literary-points',
        layout: {
            'text-field': ['get', 'name'],
            'text-font': ['Noto Sans Regular'],
            'text-size': 12,
            'text-offset': [0, 1.8],
            'text-anchor': 'top'
        },
        paint: {
            'text-color': '#111111',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1.5
        }
    });
    console.log('➕ Слой подписей добавлен');
}

// --- Фильтр по теме ---
function updatePointsFilter(world) {
    console.log('🔧 updatePointsFilter для мира:', world);
    if (!map.getLayer('literary-points-circle')) {
        console.warn('⚠️ Слой circle не найден, фильтр не установлен');
        return;
    }
    if (world === 'day') {
        map.setFilter('literary-points-circle', ['==', ['get', 'has_day'], 1]);
        map.setFilter('literary-points-labels', ['==', ['get', 'has_day'], 1]);
        console.log('🌞 Фильтр: только has_day = 1');
    } else {
        map.setFilter('literary-points-circle', ['==', ['get', 'has_night'], 1]);
        map.setFilter('literary-points-labels', ['==', ['get', 'has_night'], 1]);
        console.log('🌙 Фильтр: только has_night = 1');
    }
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
    console.log('⏳ Карта в состоянии idle, добавляем точки для мира:', world);
    addLiteraryPoints();
    updatePointsFilter(world);
});
    };
});

// --- Первый запуск ---
map.on('load', async () => {
    console.log('🗺 Карта готова');
    await loadLiteraryData();   // ждём загрузку файла
    addLiteraryPoints();
    updatePointsFilter('day');
});

// --- Клик по точке (попап) ---
map.on('click', 'literary-points-circle', (e) => {
    const props = e.features[0].properties;
    const isNight = document.body.classList.contains('night-theme');
    let desc = isNight ? props.night_description : props.day_description;
    if (!desc) desc = '';
    let html = `<h3>${props.name || ''}</h3>`;
    if (props.title) html += `<p><em>${props.title}</em></p>`;
    html += `<p>${desc}</p>`;
    if (props.address) html += `<p><strong>Адрес:</strong> ${props.address}</p>`;
    if (props.litraturer) html += `<p><strong>Писатель:</strong> ${props.litraturer}</p>`;
    if (isNight && props.night_quote) html += `<blockquote style="font-style:italic; border-left:3px solid #AF2C22; padding-left:8px;">${props.night_quote}</blockquote>`;
    if (props.img_url) html += `<img src="${props.img_url}" alt="${props.name}" style="max-width:200px; display:block; margin-top:8px; border-radius:4px;">`;
    new maplibregl.Popup().setLngLat(e.lngLat).setHTML(html).addTo(map);
});

// --- Курсор при наведении на точку ---
map.on('mouseenter', 'literary-points-circle', () => map.getCanvas().style.cursor = 'pointer');
map.on('mouseleave', 'literary-points-circle', () => map.getCanvas().style.cursor = '');
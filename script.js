// script.js
console.log("1. Логика запущена");

/**
 * ФУНКЦИЯ-ЛЕЧИЛКА
 * Твои стили содержат ошибки (использование rank/size без проверки на null).
 * Эта функция проходит по слоям и подставляет 0 там, где MapLibre может упасть.
 */
function fixStyleErrors(style) {
    if (!style || !style.layers) return style;
    style.layers.forEach(layer => {
        // Чиним сортировку POI (самая частая причина ошибки 'found null')
        if (layer.layout && layer.layout['symbol-sort-key']) {
            layer.layout['symbol-sort-key'] = ["coalesce", layer.layout['symbol-sort-key'], 0];
        }
        // Чиним прозрачность текста
        if (layer.paint && layer.paint['text-opacity']) {
            if (Array.isArray(layer.paint['text-opacity']) && layer.paint['text-opacity'][0] === 'interpolate') {
                // Если внутри интерполяции есть get, который может вернуть null, это опасно.
                // Но обычно зум (zoom) там всегда есть.
            }
        }
    });
    return style;
}

// Применяем лечилку к твоим стилям перед инициализацией
const CLEAN_DAY_STYLE = fixStyleErrors(MY_FINAL_DAY_STYLE);
const CLEAN_NIGHT_STYLE = fixStyleErrors(MY_FINAL_NIGHT_STYLE);

// 1. Инициализация карты
const map = new maplibregl.Map({
    container: 'map',
    style: CLEAN_DAY_STYLE, 
    center: [30.332, 59.935],
    zoom: 11,
    attributionControl: false
});

// 2. Функция принудительной отрисовки всех точек
function forceLoadPoints() {
    console.log("3. Загружаю GeoJSON...");
    
    fetch('literary_places.geojson')
        .then(res => res.json())
        .then(data => {
            console.log("4. Данные считаны, объектов:", data.features.length);

            if (map.getSource('places')) {
                if (map.getLayer('points-layer')) map.removeLayer('points-layer');
                map.removeSource('places');
            }

            map.addSource('places', { type: 'geojson', data: data });

            map.addLayer({
                id: 'points-layer',
                type: 'circle',
                source: 'places',
                // НИКАКИХ ФИЛЬТРОВ - рисуем абсолютно всё
                paint: {
                    'circle-radius': 12,
                    'circle-color': '#ff0000', // Ярко-красный, чтобы точно увидеть
                    'circle-stroke-width': 3,
                    'circle-stroke-color': '#ffffff',
                    'circle-opacity': 1
                }
            });
            console.log("5. Слой добавлен. Проверь карту!");
        })
        .catch(err => console.error("Ошибка Fetch:", err));
}

// События готовности
map.on('load', forceLoadPoints);
map.on('style.load', forceLoadPoints);

// Переключатель миров
document.querySelectorAll('.world-btn').forEach(btn => {
    btn.onclick = () => {
        const world = btn.dataset.world;
        console.log("Смена мира на:", world);
        
        document.querySelectorAll('.world-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.body.className = world + '-theme';
        
        map.setStyle(world === 'day' ? CLEAN_DAY_STYLE : CLEAN_NIGHT_STYLE);
    };
});

// Тупейший клик для проверки атрибутов
map.on('click', 'points-layer', (e) => {
    const p = e.features[0].properties;
    let s = "<h3>Атрибуты объекта:</h3>";
    for (let k in p) s += `<p><b>${k}:</b> ${p[k]}</p>`;
    
    document.getElementById('sidebar-content').innerHTML = s;
    document.getElementById('sidebar').classList.remove('hidden');
});

// Закрытие окон
document.addEventListener('DOMContentLoaded', () => {
    const safeClick = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
    safeClick('close-sidebar', () => document.getElementById('sidebar').classList.add('hidden'));
    safeClick('info-btn', () => document.getElementById('info-modal').classList.remove('hidden'));
    safeClick('close-info', () => document.getElementById('info-modal').classList.add('hidden'));
});

map.on('mouseenter', 'points-layer', () => map.getCanvas().style.cursor = 'pointer');
map.on('mouseleave', 'points-layer', () => map.getCanvas().style.cursor = '');

// Функция-лечилка для стилей (чтобы не было белого экрана из-за null в данных Maptiler)
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

// 1. Инициализация
const map = new maplibregl.Map({
    container: 'map',
    style: fixStyle(MY_FINAL_DAY_STYLE), 
    center: [30.332, 59.935],
    zoom: 11,
    attributionControl: false
});

// 2. Переключение
document.querySelectorAll('.world-btn').forEach(btn => {
    btn.onclick = () => {
        const world = btn.dataset.world;
        
        // Кнопки
        document.querySelectorAll('.world-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Класс темы для body (на случай, если в будущем захотим менять стили UI)
        document.body.className = world + '-theme';
        
        // Стиль карты
        const newStyle = (world === 'day') ? MY_FINAL_DAY_STYLE : MY_FINAL_NIGHT_STYLE;
        map.setStyle(fixStyle(newStyle));
    };
});

map.on('load', () => {
    console.log("Интерфейс и карта готовы.");
});
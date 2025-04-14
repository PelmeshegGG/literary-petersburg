document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Content Loaded. Initializing script...");

    // --- Элементы DOM (без изменений) ---
    const sidebar = document.getElementById('sidebar');
    const sidebarPhoto = document.getElementById('sidebar-photo');
    const sidebarTitle = document.getElementById('sidebar-title');
    const pSidebarType = document.getElementById('p-sidebar-type');
    const pSidebarWriter = document.getElementById('p-sidebar-writer');
    const pSidebarBook = document.getElementById('p-sidebar-book');
    const pSidebarAge = document.getElementById('p-sidebar-age');
    const pSidebarYear = document.getElementById('p-sidebar-year');
    const pSidebarDescription = document.getElementById('p-sidebar-description');
    const sidebarType = document.getElementById('sidebar-type');
    const sidebarWriter = document.getElementById('sidebar-writer');
    const sidebarAge = document.getElementById('sidebar-age');
    const sidebarYear = document.getElementById('sidebar-year');
    const sidebarBook = document.getElementById('sidebar-book');
    const sidebarDescriptionDiv = document.getElementById('sidebar-description');
    const closeSidebarButton = document.getElementById('close-sidebar');
    const header = document.getElementById('header');
    const footer = document.getElementById('footer');
    const modeSelector = document.getElementById('mode-selector');
    const modeButtons = modeSelector ? modeSelector.querySelectorAll('.mode-btn') : [];
    const filterToggleButton = document.getElementById('filter-toggle-btn');
    const filterPanel = document.getElementById('filter-panel');
    const filterPanelCloseButton = document.getElementById('filter-panel-close-btn');
    const resetFiltersButton = document.getElementById('reset-filters-btn');
    const legend = document.getElementById('legend');

    // --- Настройки и Глобальные переменные ---
    const mapCenter = [59.9343, 30.3351];
    let currentMode = 'all';
    let allFeatures = [];
    let activeFilters = { types: new Set(), writers: new Set(), books: new Set() };
    const themeColors = {
        default: { bg: '#AF2C22', text: '#FFFFFF' },
        "1": { bg: '#8df2e9', text: '#005f6a' },
        "2": { bg: '#f2e382', text: '#000000' },
        "3": { bg: '#C0C0C0', text: '#2F4F4F' }
    };

    // --- Переменная для карты Leaflet ---
    let map;
    // --- Инициализация MarkerClusterGroup ---
    let markerClusterGroup; // Объявляем здесь

    try {
        console.log("Initializing Leaflet map...");
        map = L.map('map').setView(mapCenter, 12);
        let baseLayers = {
            "Оттенки серого (CartoDB)": L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '© OSM © CARTO', subdomains: 'abcd', maxZoom: 20 }),
            "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }),
            "Спутник (Esri)": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '© Esri' })
        };
        baseLayers["Оттенки серого (CartoDB)"].addTo(map);
        console.log("Default base layer added.");
        L.control.layers(baseLayers).addTo(map);
        console.log("Layer control added.");

        // --- Инициализируем MarkerClusterGroup ЗДЕСЬ ---
        console.log("Initializing MarkerClusterGroup...");
        markerClusterGroup = L.markerClusterGroup({
            spiderfyOnMaxZoom: true,      // Обязательно для доступа к маркерам при макс. зуме кластера
            showCoverageOnHover: false,   // Не показывать границы кластера при наведении
            zoomToBoundsOnClick: true,    // Приближать при клике на кластер
            maxClusterRadius: 20,         // Радиус кластеризации (можно подбирать, 80 - стандарт)
            disableClusteringAtZoom: 16, // Отключить кластеризацию на зуме 18 (показывать все маркеры)
            chunkedLoading: true          // Для улучшения производительности при большом кол-ве маркеров
        });
        markerClusterGroup.addTo(map); // Добавляем группу на карту СРАЗУ
        console.log("MarkerClusterGroup added to map.");

    } catch (e) {
        console.error("FATAL ERROR during Leaflet map or MarkerCluster initialization:", e);
        alert("Критическая ошибка при инициализации карты или кластеризации.");
        return;
    }

    // --- Функции (без изменений, кроме filterAndDisplayMarkers) ---

    /** Применяет переменные темы к корневому элементу */
    function applyThemeVariables(theme) {
        if (!theme || !theme.bg || !theme.text) { console.error("Ошибка: applyThemeVariables вызвана с неверными данными темы:", theme); return; }
        const root = document.documentElement;
        console.log(`>>> Применяем переменные: --theme-bg-color=${theme.bg}, --theme-text-color=${theme.text}`);
        root.style.setProperty('--theme-bg-color', theme.bg);
        root.style.setProperty('--theme-text-color', theme.text);
    }

    /** Обновляет стиль кнопок в шапке */
    function updateHeaderButtonsStyle() {
        if (!modeButtons || modeButtons.length === 0) return;
        console.log(`   Обновляем стили кнопок, текущий режим: ${currentMode}`);
        modeButtons.forEach(btn => { btn.classList.toggle('active', btn.dataset.mode === currentMode); });
    }

    /** Обновляет тему (цвета и активную кнопку) */
    function updateTheme(mode) {
        console.log(`Вызов updateTheme с режимом: ${mode}`);
        const theme = themeColors[mode] || themeColors.default;
        console.log(`Выбрана тема для режима ${mode}:`, theme);
        applyThemeVariables(theme);
        updateHeaderButtonsStyle();
    }

    /** Сопоставление типа объекта с именем иконки SVG */
    function getIconNameByType(type) {
        const typeLower = (typeof type === 'string') ? type.toLowerCase() : 'default';
        switch (typeLower) {
            case 'дом': return 'home';
            case 'здание': return 'building';
            case 'кладбище': return 'cemetery';
            case 'памятник': return 'memorial';
            case 'театр': return 'theater';
            case 'библиотека': return 'library';
            case 'церковь': return 'church';
            case 'учебное_заведение': return 'education';
            case 'сад':
            case 'другое':
            default: return 'другое'; // Имя CSS класса будет icon-type-другое
        }
    }

    /** Фильтрует и отображает маркеры на карте (ИСПОЛЬЗУЯ markerClusterGroup) */
    function filterAndDisplayMarkers() {
        console.log(`--- Filtering markers for mode: ${currentMode}, Active Filters:`, JSON.stringify([...activeFilters.types]), JSON.stringify([...activeFilters.writers]), JSON.stringify([...activeFilters.books]));

        if (!markerClusterGroup) { // Доп. проверка, если что-то пошло не так при инициализации
            console.error("markerClusterGroup is not initialized!");
            return;
        }
        markerClusterGroup.clearLayers(); // Очищаем группу кластеров
        console.log("MarkerClusterGroup cleared.");

        if (!allFeatures || allFeatures.length === 0) { console.log("No features to display."); return; }

        let displayedCount = 0;
        const selectedTypes = activeFilters.types;
        const selectedWriters = activeFilters.writers;
        const selectedBooks = activeFilters.books;
        const markersToAdd = []; // Собираем маркеры для пакетного добавления

        allFeatures.forEach((feature) => {
            if (!feature.properties || !feature.geometry) return;
            const props = feature.properties;
            let mainFilterMatch = false;
            let featureAges = [];

            // Фильтрация по основному режиму (Век/Библиотеки)
            if (currentMode === 'all') {
                mainFilterMatch = true;
            } else if (currentMode === 'library') {
                mainFilterMatch = props.type && props.type.toLowerCase() === 'библиотека';
            } else {
                const ageProperty = props.age;
                if (typeof ageProperty === 'string' && ageProperty.trim() !== '') {
                    featureAges = ageProperty.split(',').map(a => a.trim());
                } else if (typeof ageProperty === 'number') {
                    featureAges = [ageProperty.toString()];
                }
                mainFilterMatch = featureAges.includes(currentMode);
            }
            if (!mainFilterMatch) return;

            // Фильтрация по панели фильтров
            let typeMatch = selectedTypes.size === 0 || (props.type && selectedTypes.has(props.type));
            let writerMatch = selectedWriters.size === 0 || (props.writer && props.writer.split(',').some(w => selectedWriters.has(w.trim())));
            let bookMatch = selectedBooks.size === 0 || (props.book && props.book.split(',').some(b => {
                const cleanBook = b.trim().replace(/^(«|")/, '').replace(/(»|")$/, '').trim();
                return selectedBooks.has(cleanBook);
            }));

            if (typeMatch && writerMatch && bookMatch) {
                if (feature.geometry.type === 'Point' && Array.isArray(feature.geometry.coordinates)) {
                    const coords = feature.geometry.coordinates;
                    const latLng = [coords[1], coords[0]]; // [lat, lon]
                    if (typeof latLng[0] === 'number' && typeof latLng[1] === 'number' && !isNaN(latLng[0]) && !isNaN(latLng[1])) {
                        try {
                            const iconName = getIconNameByType(props.type);
                            let customIcon = L.divIcon({
                                html: `<span class="marker-icon icon-type-${iconName}"></span>`,
                                className: 'custom-div-icon',
                                iconSize: [24, 24], // Размер иконки
                                iconAnchor: [12, 12] // Центр иконки
                            });
                            const marker = L.marker(latLng, { icon: customIcon });

                            marker.featureData = feature; // Сохраняем данные объекта в маркере
                            marker.on('click', (e) => {
                                try {
                                    displayFeatureInfo(marker.featureData);
                                    // Небольшое приближение при клике на маркер, если не сильно увеличено
                                    if (map.getZoom() < 15) {
                                       map.setView(marker.getLatLng(), 15);
                                    } else {
                                       map.panTo(marker.getLatLng()); // Просто центрируем, если зум уже большой
                                    }
                                } catch (displayError) {
                                    console.error("Error inside marker click handler:", displayError);
                                }
                            });
                            if (props.name) {
                                marker.bindTooltip(props.name); // Добавляем всплывающую подсказку
                            }
                            // Собираем маркеры, чтобы добавить их потом все сразу
                            markersToAdd.push(marker);
                            displayedCount++;
                        } catch (e) {
                            console.error(`ERROR creating marker for ${props.name}:`, e);
                        }
                    } else {
                        console.warn(`Invalid coordinates for ${props.name}:`, latLng);
                    }
                } else if (feature.geometry.type !== 'Point') {
                    console.warn(`Feature ${props.name} has geometry type ${feature.geometry.type}, not Point.`);
                }
            }
        });

        // Добавляем все отфильтрованные маркеры в группу кластеров
        markerClusterGroup.addLayers(markersToAdd);
        console.log(`--- Filtering finished. Added ${displayedCount} markers to MarkerClusterGroup.`);
        // Проверка: console.log(`markerClusterGroup now contains ${markerClusterGroup.getLayers().length} base layers (approx). Is on map: ${map.hasLayer(markerClusterGroup)}`);
    }


    /** Заполняет панель фильтров чекбоксами */
    function populateFilters(features) {
        const filterSectionTypes = document.getElementById('filter-types');
        const filterSectionWriters = document.getElementById('filter-writers');
        const filterSectionBooks = document.getElementById('filter-books');
        if (!filterSectionTypes || !filterSectionWriters || !filterSectionBooks) { console.error("ОШИБКА в populateFilters: Не найден один или несколько контейнеров для фильтров."); return; }
        const types = new Set(); const writers = new Set(); const books = new Set();

        features.forEach(feature => {
            if (!feature.properties) return;
            const props = feature.properties;
            if (props.type) types.add(props.type);
            if (props.writer) { props.writer.split(',').forEach(w => { const trimmedWriter = w.trim(); if (trimmedWriter) writers.add(trimmedWriter); }); }
            if (props.book) { props.book.split(',').forEach(b => { const cleanBook = b.trim().replace(/^(«|")/, '').replace(/(»|")$/, '').trim(); if (cleanBook) books.add(cleanBook); }); }
        });

        createCheckboxes('filter-types', types, 'types');
        createCheckboxes('filter-writers', writers, 'writers');
        createCheckboxes('filter-books', books, 'books');
    }

    /** Создает чекбоксы для одного раздела фильтров */
    function createCheckboxes(containerId, itemsSet, filterGroup) {
        const container = document.getElementById(containerId); if (!container) { console.error(`Error in createCheckboxes: Container element with ID '${containerId}' not found.`); return; }
        container.innerHTML = ''; const sortedItems = Array.from(itemsSet).filter(item => item).sort((a, b) => a.localeCompare(b));
        if (sortedItems.length === 0) { container.innerHTML = 'Нет данных'; return; }
        sortedItems.forEach(item => { const label = document.createElement('label'); const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.value = item; checkbox.dataset.filterGroup = filterGroup; checkbox.checked = activeFilters[filterGroup].has(item); label.appendChild(checkbox); label.appendChild(document.createTextNode(` ${item}`)); container.appendChild(label); });
    }

    /** Обновляет состояние активных фильтров при изменении чекбокса */
    function handleFilterChange(event) {
        const checkbox = event.target; if (checkbox.type !== 'checkbox') return; const group = checkbox.dataset.filterGroup; const value = checkbox.value; if (checkbox.checked) { activeFilters[group].add(value); } else { activeFilters[group].delete(value); } filterAndDisplayMarkers();
    }

    /** Сбрасывает все чекбоксы в панели фильтров */
    function resetPanelFilters() {
        activeFilters.types.clear(); activeFilters.writers.clear(); activeFilters.books.clear(); if(filterPanel) filterPanel.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false); filterAndDisplayMarkers();
    }

    /** Отображает информацию в сайдбаре */
    function displayFeatureInfo(feature) {
        if (!feature || !feature.properties) { closeSidebar(); return; }
        const props = feature.properties;

        if (sidebarPhoto) { if (props.photo_url) { sidebarPhoto.src = props.photo_url; sidebarPhoto.alt = `Фото: ${props.name || 'объект'}`; sidebarPhoto.classList.add('visible'); sidebarPhoto.onerror = () => { sidebarPhoto.classList.remove('visible'); }; } else { sidebarPhoto.classList.remove('visible'); sidebarPhoto.src = ''; sidebarPhoto.alt = 'Фото объекта'; } }
        if (sidebarTitle) { sidebarTitle.textContent = props.name || 'Без названия'; }

        const setInfoField = (pElement, spanElement, value, prefix = '', processFunc = null) => {
            if (!pElement || !spanElement) { console.warn(`Sidebar element not found for value: ${value}`); return; }
            const processedValue = processFunc ? processFunc(value) : value;
            const isEmpty = processedValue === null || processedValue === undefined || processedValue === '' || (pElement.id === 'p-sidebar-year' && String(processedValue) === '0');
            spanElement.innerHTML = isEmpty ? '' : prefix + processedValue;
            pElement.classList.toggle('hidden-info', isEmpty);
        };

        setInfoField(pSidebarType, sidebarType, props.type, '', (type) => { if (type && type.toLowerCase() === 'дом') return 'Место жительства'; return type; });
        setInfoField(pSidebarWriter, sidebarWriter, props.writer);
        setInfoField(pSidebarBook, sidebarBook, props.book);
        setInfoField(pSidebarAge, sidebarAge, props.age, '', (age) => { if (!age || String(age).trim() === '') return null; return String(age).toString().replace(/1/g, 'XVIII').replace(/2/g, 'XIX').replace(/3/g, 'XX'); });
        setInfoField(pSidebarYear, sidebarYear, props.year);
        if (sidebarDescriptionDiv && pSidebarDescription) { if (props.description) { sidebarDescriptionDiv.textContent = props.description; pSidebarDescription.classList.remove('hidden-info'); } else { sidebarDescriptionDiv.textContent = ''; pSidebarDescription.classList.add('hidden-info'); } }

        if (sidebar) { sidebar.classList.remove('hidden'); if (legend) { legend.classList.add('shifted-left'); } }
    }

    /** Закрывает сайдбар и возвращает легенду */
    function closeSidebar() {
        if (sidebar) { sidebar.classList.add('hidden'); if (legend) { legend.classList.remove('shifted-left'); } }
    }

    function toggleFilterPanel() { if(filterPanel) filterPanel.classList.toggle('hidden'); }

    // --- Загрузка GeoJSON данных ---
    console.log("Setting up fetch for GeoJSON...");
    fetch('literary_places.geojson')
        .then(response => { console.log("Fetch response received."); if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`); return response.json(); })
        .then(data => {
            console.log("GeoJSON data loaded and parsed successfully.");
            allFeatures = data.features || [];
            console.log(`Loaded ${allFeatures.length} features.`);
            if (allFeatures.length > 0) {
                populateFilters(allFeatures);
                updateTheme(currentMode);
                filterAndDisplayMarkers(); // Первое отображение маркеров
            } else {
                 console.warn("GeoJSON loaded, but no features found.");
                 // Можно показать сообщение пользователю, если нужно
            }
        })
        .catch(error => { console.error('Failed to load or parse GeoJSON:', error); alert(`Критическая ошибка загрузки данных карты: ${error.message}.`); });

    // --- Обработчики событий (без изменений) ---
    console.log("Adding event listeners...");
    if (modeSelector) {
        modeSelector.addEventListener('click', (event) => {
            if (event.target.classList.contains('mode-btn') && event.target.dataset.mode) {
                const selectedMode = event.target.dataset.mode;
                console.log(`Клик по кнопке режима. Выбран режим: ${selectedMode}`);
                if (selectedMode !== currentMode) {
                    console.log(`>>> Смена режима с ${currentMode} на ${selectedMode}`);
                    currentMode = selectedMode;
                    updateTheme(currentMode);
                    filterAndDisplayMarkers();
                    closeSidebar();
                    if (filterPanel && !filterPanel.classList.contains('hidden')) { toggleFilterPanel(); }
                } else { console.log(`Режим ${selectedMode} уже активен.`); }
            }
        });
    } else { console.error("Mode selector element (#mode-selector) not found!"); }
    if (filterToggleButton) filterToggleButton.addEventListener('click', toggleFilterPanel); else console.error("Filter toggle button not found");
    if (filterPanelCloseButton) filterPanelCloseButton.addEventListener('click', toggleFilterPanel); else console.error("Filter panel close button not found");
    if (filterPanel) { filterPanel.addEventListener('change', handleFilterChange); } else { console.error("Filter panel not found for 'change' listener"); }
    if (resetFiltersButton) { resetFiltersButton.addEventListener('click', resetPanelFilters); } else { console.error("Reset filters button not found"); }
    if (closeSidebarButton) closeSidebarButton.addEventListener('click', closeSidebar); else console.error("Close sidebar button not found");
    if (map) {
         map.on('click', (e) => {
             if (e.originalEvent.target.closest('.leaflet-marker-icon') === null && // Не клик по маркеру
                 e.originalEvent.target.closest('.leaflet-marker-icon') === null && // Повтор - убрать? Проверить!
                 e.originalEvent.target.closest('.leaflet-control') === null && // Не клик по контролам карты
                 e.originalEvent.target.closest('#filter-toggle-btn') === null && // Не клик по кнопке фильтров
                 e.originalEvent.target.closest('#legend') === null && // Не клик по легенде
                 e.originalEvent.target.closest('#filter-panel') === null && // Не клик по панели фильтров
                 e.originalEvent.target.closest('#sidebar') === null) // Не клик по сайдбару
             {
                 if (sidebar && !sidebar.classList.contains('hidden')) { closeSidebar(); }
                 if (filterPanel && !filterPanel.classList.contains('hidden')) { toggleFilterPanel(); }
             }
         });
    } else { console.error("Map object not available for 'click' listener"); }

}); // Конец DOMContentLoaded
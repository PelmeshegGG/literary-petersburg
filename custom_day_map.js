const MY_FINAL_DAY_STYLE = {
    "version": 8,
    "sources": {
        "maptiler-vector": {
            "type": "vector",
            "url": "https://api.maptiler.com/tiles/v3/tiles.json?key=" + MAPTILER_KEY
        }
    },
    "glyphs": "https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=" + MAPTILER_KEY,
    "layers": [
        { "id": "background", "type": "background", "paint": { "background-color": "#fbfbfb" } },

        // --- 1. ТЕРРИТОРИИ (САМЫЙ НИЗ) ---
        { "id": "res", "type": "fill", "source": "maptiler-vector", "source-layer": "landuse", "filter": ["==", "class", "residential"], "paint": { "fill-color": "#F8EFDD", "fill-opacity": ["interpolate", ["linear"], ["zoom"], 6, 1, 16, 0] } },
        { "id": "ind", "type": "fill", "source": "maptiler-vector", "source-layer": "landuse", "filter": ["==", "class", "industrial"], "paint": { "fill-color": "#E6E6E6", "fill-opacity": ["interpolate", ["linear"], ["zoom"], 6, 1, 18, 0] } },
        { "id": "soc", "type": "fill", "source": "maptiler-vector", "source-layer": "landuse", "filter": ["in", "class", "hospital", "military", "university", "college", "education", "commercial"], "paint": { "fill-color": ["match", ["get", "class"], "hospital", "#F9C8E3", "military", "#F9E1DC", ["university", "college", "education"], "#D3D5F8", "#D8E9F8"], "fill-opacity": ["interpolate", ["linear"], ["zoom"], 8, 1, 18, 0] } },

        // --- 2. ПРИРОДА ---
        { "id": "grass", "type": "fill", "source": "maptiler-vector", "source-layer": "landcover", "filter": ["==", "class", "grass"], "paint": { "fill-color": "#9BCC7B", "fill-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0, 11, 0.35] } },
        { "id": "wood", "type": "fill", "source": "maptiler-vector", "source-layer": "landcover", "filter": ["in", "class", "wood", "forest"], "paint": { "fill-color": "#41813B", "fill-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0, 10, 0.30] } },
        { "id": "cem", "type": "fill", "source": "maptiler-vector", "source-layer": "landuse", "filter": ["==", "class", "cemetery"], "paint": { "fill-color": "#E7EEE9", "fill-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0, 8, 1] } },
        
        // --- 3. ВОДА ---
        { "id": "water", "type": "fill", "source": "maptiler-vector", "source-layer": "water", "paint": { "fill-color": "#AAC5CF" } },

        // --- 4. ПОДЗЕМНЫЙ ЯРУС (LAYER -1) ---
        { "id": "rd-t-out", "type": "line", "source": "maptiler-vector", "source-layer": "transportation", "filter": ["all", ["==", "brunnel", "tunnel"], ["in", "class", "motorway", "trunk", "primary", "secondary", "tertiary", "minor"]], "paint": { "line-color": "#D9D9D9", "line-width": getRoadOutlineWidth(), "line-opacity": 0.4 } },
        { "id": "rd-t-core", "type": "line", "source": "maptiler-vector", "source-layer": "transportation", "filter": ["all", ["==", "brunnel", "tunnel"], ["in", "class", "motorway", "trunk", "primary", "secondary", "tertiary", "minor"]], "paint": { "line-color": "#FFFFFF", "line-width": getRoadCoreWidth(), "line-opacity": 0.4 } },
        { "id": "pth-tunnel", "type": "line", "source": "maptiler-vector", "source-layer": "transportation", "filter": ["all", ["==", "brunnel", "tunnel"], ["in", "class", "path", "pedestrian", "footway"]], "layout": { "line-cap": "butt" }, "paint": { "line-color": "#A6A6A6", "line-dasharray": [1, 2], "line-width": getPathwayWidth(), "line-opacity": 0.4 } },

        // --- 5. НАЗЕМНЫЕ ПЕШЕХОДКИ (ПОД МОСТАМИ) ---
        { "id": "p-g-out", "type": "line", "source": "maptiler-vector", "source-layer": "transportation", "filter": ["all", ["!has", "brunnel"], ["in", "class", "path", "pedestrian", "footway"]], "layout": { "line-cap": "round", "line-join": "round" }, "paint": { "line-color": "#FFFFFF", "line-width": ["interpolate", ["linear"], ["zoom"], 14, 1.5, 16, 2, 18.6, 4, 22, 10], "line-blur": 1, "line-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 15, 1] } },
        { "id": "p-g-core", "type": "line", "source": "maptiler-vector", "source-layer": "transportation", "filter": ["all", ["!has", "brunnel"], ["in", "class", "path", "pedestrian", "footway"]], "layout": { "line-cap": "round", "line-join": "round" }, "paint": { "line-color": "#A6A6A6", "line-dasharray": [2, 4], "line-width": getPathwayWidth() } },

        // --- 6. НАЗЕМНЫЕ АВТОДОРОГИ (LAYER 0) ---
        { "id": "rd-outline", "type": "line", "source": "maptiler-vector", "source-layer": "transportation", "filter": ["all", ["!has", "brunnel"], ["in", "class", "motorway", "trunk", "primary", "secondary", "tertiary", "minor"]], "layout": { "line-cap": "round", "line-join": "round", "line-sort-key": ["get", "layer"] }, "paint": { "line-color": "#D9D9D9", "line-width": getRoadOutlineWidth() } },
        { "id": "rd-core", "type": "line", "source": "maptiler-vector", "source-layer": "transportation", "filter": ["all", ["!has", "brunnel"], ["in", "class", "motorway", "trunk", "primary", "secondary", "tertiary", "minor"]], "layout": { "line-cap": "round", "line-join": "round", "line-sort-key": ["get", "layer"] }, "paint": { "line-color": "#FFFFFF", "line-width": getRoadCoreWidth() } },

        // --- 7. МОСТЫ (ЗАЛИВКА ТЕЛ + ПУТИ LAYER 1+) ---
        { "id": "bridge-fill", "type": "fill", "source": "maptiler-vector", "source-layer": "transportation", "filter": ["all", ["==", "class", "bridge"], ["==", "$type", "Polygon"]], "paint": { "fill-color": "#FFFFFF", "fill-opacity": 0.85 } },
        { "id": "rd-b-out", "type": "line", "source": "maptiler-vector", "source-layer": "transportation", "filter": ["all", ["==", "brunnel", "bridge"], ["in", "class", "motorway", "trunk", "primary", "secondary", "tertiary", "minor"]], "layout": { "line-cap": "butt", "line-join": "round", "line-sort-key": ["get", "layer"] }, "paint": { "line-color": "#D9D9D9", "line-width": getRoadOutlineWidth() } },
        { "id": "rd-b-core", "type": "line", "source": "maptiler-vector", "source-layer": "transportation", "filter": ["all", ["==", "brunnel", "bridge"], ["in", "class", "motorway", "trunk", "primary", "secondary", "tertiary", "minor"]], "layout": { "line-cap": "butt", "line-join": "round", "line-sort-key": ["get", "layer"] }, "paint": { "line-color": "#FFFFFF", "line-width": getRoadCoreWidth() } },
        { "id": "p-b-core", "type": "line", "source": "maptiler-vector", "source-layer": "transportation", "filter": ["all", ["==", "brunnel", "bridge"], ["in", "class", "path", "pedestrian", "footway"]], "layout": { "line-cap": "round", "line-join": "round", "line-sort-key": ["get", "layer"] }, "paint": { "line-color": "#A6A6A6", "line-dasharray": [2, 4], "line-width": getPathwayWidth() } },

        // --- 8. ЖЕЛЕЗНЫЕ ДОРОГИ ---
        { "id": "rail-b", "type": "line", "source": "maptiler-vector", "source-layer": "transportation", "filter": ["==", "class", "rail"], "layout": { "line-cap": "round", "line-join": "round" }, "paint": { "line-color": "#CCCCCC", "line-width": ["interpolate", ["exponential", 1.3], ["zoom"], 12, 1, 16, 4, 20, 8] } },
        { "id": "rail-t", "type": "line", "source": "maptiler-vector", "source-layer": "transportation", "filter": ["==", "class", "rail"], "layout": { "line-cap": "round", "line-join": "round" }, "paint": { "line-color": "#FFFFFF", "line-dasharray": [1, 3], "line-width": ["interpolate", ["exponential", 1.3], ["zoom"], 14, 1, 20, 6], "line-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 15, 1] } },

        // --- 9. ЗДАНИЯ ---
        { "id": "b-body", "type": "fill", "source": "maptiler-vector", "source-layer": "building", "paint": { "fill-color": ["interpolate", ["linear"], ["zoom"], 13, "#EBEBEB", 16, "#DFD0BF"], "fill-outline-color": ["interpolate", ["linear"], ["zoom"], 13, "#EBEBEB", 16, "#DFD0BF"], "fill-opacity": 0.7 } },
        { "id": "b-top", "type": "fill", "source": "maptiler-vector", "source-layer": "building", "paint": { "fill-color": "#F5F2F0", "fill-opacity": ["interpolate", ["linear"], ["zoom"], 13.5, 0, 16, 0.7], "fill-outline-color": ["interpolate", ["linear"], ["zoom"], 13, "#EBEBEB", 16, "#DFD0BF"] } },

        // --- 10. ГЕО-ПОДПИСИ ---
        { "id": "city-lbl", "type": "symbol", "source": "maptiler-vector", "source-layer": "place", "filter": ["==", "class", "city"], "layout": { "text-field": ["get", "name:ru"], "text-font": ["Metropolis Semi Bold", "Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 5, 16, 12, 24] }, "paint": { "text-color": "#828282", "text-halo-color": "#E6E6E6", "text-halo-width": 1.5 } },
        { "id": "town-lbl", "type": "symbol", "source": "maptiler-vector", "source-layer": "place", "filter": ["==", "class", "town"], "layout": { "text-field": ["get", "name:ru"], "text-font": ["Metropolis Semi Bold", "Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 8, 12, 14, 18] }, "paint": { "text-color": "#828282", "text-halo-color": "#E6E6E6", "text-halo-width": 1.5 } },
        { "id": "place-lbl", "type": "symbol", "source": "maptiler-vector", "source-layer": "place", "filter": ["any", ["==", "class", "suburb"], ["==", "class", "quarter"], ["==", "class", "neighbourhood"]], "layout": { "text-field": ["get", "name:ru"], "text-font": ["Metropolis Semi Bold", "Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 11, 10, 16, 14] }, "paint": { "text-color": "#828282", "text-halo-color": "#E6E6E6", "text-halo-width": 1.5, "text-opacity": 0.8 } },

        // --- 11. ПОДПИСИ ОБЪЕКТОВ ---
        { "id": "wat-lbl", "type": "symbol", "source": "maptiler-vector", "source-layer": "waterway", "filter": ["any", ["==", "class", "river"], ["==", "class", "canal"]], "layout": { "text-field": ["get", "name:ru"], "text-font": ["Noto Sans Italic"], "text-size": ["interpolate", ["linear"], ["zoom"], 13, 11, 17, 15], "symbol-placement": "line" }, "paint": { "text-color": "#2A4B7C", "text-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0, 13, 1] } },
        { "id": "rd-lbl", "type": "symbol", "source": "maptiler-vector", "source-layer": "transportation_name", "filter": ["all", ["!=", "class", "ferry"], ["!=", "brunnel", "bridge"]], "layout": { "text-field": ["get", "name:ru"], "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 12.5, 11, 18, 24], "symbol-placement": "line" }, "paint": { "text-color": "#6B7A85", "text-halo-color": "#FFFFFF", "text-halo-width": 2, "text-opacity": ["interpolate", ["linear"], ["zoom"], 12.5, 0, 13.5, 1] } },
        { "id": "poi-lbl", "type": "symbol", "source": "maptiler-vector", "source-layer": "poi", "filter": ["all", ["has", "name"], ["!=", "name", "Дуб черешчатый"], ["!=", "class", "museum"], ["any", ["in", "class", "building", "university", "college", "government", "military", "place_of_worship", "townhall", "heritage", "monument", "palace", "castle", "station", "industrial"], ["==", "subclass", "theater"], ["==", "subclass", "theatre"], ["all", ["==", "class", "attraction"], ["==", "subclass", "attraction"]], ["all", ["==", "class", "shop"], ["==", "subclass", "mall"]], ["all", ["==", "class", "hospital"], ["!=", "subclass", "clinic"]]]], "layout": { "text-field": ["coalesce", ["get", "name:ru"], ["get", "name"]], "text-font": ["Noto Sans Regular"], "text-size": 12, "symbol-sort-key": ["get", "rank"] }, "paint": { "text-color": ["match", ["get", "class"], "university", "#406291", "college", "#406291", "hospital", "#AF2C22", "#B99974"], "text-halo-color": "rgba(255,255,255,0.9)", "text-halo-width": 2, "text-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0, 13, 1] } },
        { "id": "prk-lbl", "type": "symbol", "source": "maptiler-vector", "source-layer": "poi", "filter": ["all", ["has", "name"], ["any", ["==", "class", "park"], ["==", "class", "garden"], ["==", "class", "cemetery"]]], "layout": { "text-field": ["coalesce", ["get", "name:ru"], ["get", "name"]], "text-font": ["Noto Sans Regular"], "text-size": 12 }, "paint": { "text-color": "#437C52", "text-halo-color": "#FFFFFF", "text-halo-width": 1, "text-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0, 13, 1] } },
        { "id": "h-num", "type": "symbol", "source": "maptiler-vector", "source-layer": "housenumber", "layout": { "text-field": ["get", "housenumber"], "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 17, 16, 20, 28] }, "paint": { "text-color": "#B99974", "text-halo-color": "#FFFFFF", "text-halo-width": 1.5, "text-opacity": ["interpolate", ["linear"], ["zoom"], 17, 0, 17.5, 1] } }
    ]
};


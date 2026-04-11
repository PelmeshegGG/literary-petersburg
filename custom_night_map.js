const MY_FINAL_NIGHT_STYLE = {
    "version": 8,
    "sources": {
        "maptiler-vector": {
            "type": "vector",
            "url": "https://api.maptiler.com/tiles/v3/tiles.json?key=" + MAPTILER_KEY
        }
    },
    "glyphs": "https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=" + MAPTILER_KEY,
    "layers": [
        { "id": "background", "type": "background", "paint": { "background-color": "#1A1C20" } },

        // --- 1. ТЕРРИТОРИИ (САМЫЙ НИЗ) ---
        { "id": "res", "type": "fill", "source": "maptiler-vector", "source-layer": "landuse", "filter": ["==", "class", "residential"], "paint": { "fill-color": "#2C2A26", "fill-opacity": ["interpolate", ["linear"], ["zoom"], 6, 1, 16, 0] } },
        { "id": "ind", "type": "fill", "source": "maptiler-vector", "source-layer": "landuse", "filter": ["==", "class", "industrial"], "paint": { "fill-color": "#232427", "fill-opacity": ["interpolate", ["linear"], ["zoom"], 6, 1, 18, 0] } },
        { "id": "soc", "type": "fill", "source": "maptiler-vector", "source-layer": "landuse", "filter": ["in", "class", "hospital", "military", "university", "college", "education", "commercial"], "paint": { "fill-color": ["match", ["get", "class"], "hospital", "#4A2B3A", "military", "#4A3028", ["university", "college", "education"], "#2A2D4A", "#293B4A"], "fill-opacity": ["interpolate", ["linear"], ["zoom"], 8, 1, 18, 0] } },

        // --- 2. ПРИРОДА ---
        { "id": "grass", "type": "fill", "source": "maptiler-vector", "source-layer": "landcover", "filter": ["==", "class", "grass"], "paint": { "fill-color": "#2E4A2A", "fill-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0, 11, 0.35] } },
        { "id": "wood", "type": "fill", "source": "maptiler-vector", "source-layer": "landcover", "filter": ["in", "class", "wood", "forest"], "paint": { "fill-color": "#1C3117", "fill-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0, 10, 0.30] } },
        { "id": "cem", "type": "fill", "source": "maptiler-vector", "source-layer": "landuse", "filter": ["==", "class", "cemetery"], "paint": { "fill-color": "#2A2E2C", "fill-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0, 8, 1] } },
        
        // --- 3. ВОДА ---
        { "id": "water", "type": "fill", "source": "maptiler-vector", "source-layer": "water", "paint": { "fill-color": "#1E3A4A" } },

        // --- 4. ПОДЗЕМНЫЙ ЯРУС (LAYER -1) ---
        { "id": "rd-t-out", "type": "line", "source": "maptiler-vector", "source-layer": "transportation", "filter": ["all", ["==", "brunnel", "tunnel"], ["in", "class", "motorway", "trunk", "primary", "secondary", "tertiary", "minor"]], "paint": { "line-color": "#5C4A1E", "line-width": getRoadOutlineWidth(), "line-opacity": 0.5 } },
        { "id": "rd-t-core", "type": "line", "source": "maptiler-vector", "source-layer": "transportation", "filter": ["all", ["==", "brunnel", "tunnel"], ["in", "class", "motorway", "trunk", "primary", "secondary", "tertiary", "minor"]], "paint": { "line-color": "#D4A017", "line-width": getRoadCoreWidth(), "line-opacity": 0.5 } },
        { "id": "pth-tunnel", "type": "line", "source": "maptiler-vector", "source-layer": "transportation", "filter": ["all", ["==", "brunnel", "tunnel"], ["in", "class", "path", "pedestrian", "footway"]], "layout": { "line-cap": "butt" }, "paint": { "line-color": "#C2A44A", "line-dasharray": [1, 2], "line-width": getPathwayWidth(), "line-opacity": 0.5 } },

        // --- 5. НАЗЕМНЫЕ ПЕШЕХОДКИ (ПОД МОСТАМИ) ---
        { "id": "p-g-out", "type": "line", "source": "maptiler-vector", "source-layer": "transportation", "filter": ["all", ["!has", "brunnel"], ["in", "class", "path", "pedestrian", "footway"]], "layout": { "line-cap": "round", "line-join": "round" }, "paint": { "line-color": "#3D311A", "line-width": ["interpolate", ["linear"], ["zoom"], 14, 1.5, 16, 2, 18.6, 4, 22, 10], "line-blur": 1, "line-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 15, 1] } },
        { "id": "p-g-core", "type": "line", "source": "maptiler-vector", "source-layer": "transportation", "filter": ["all", ["!has", "brunnel"], ["in", "class", "path", "pedestrian", "footway"]], "layout": { "line-cap": "round", "line-join": "round" }, "paint": { "line-color": "#C2A44A", "line-dasharray": [2, 4], "line-width": getPathwayWidth() } },

        // --- 6. НАЗЕМНЫЕ АВТОДОРОГИ (LAYER 0) ---
        { "id": "rd-outline", "type": "line", "source": "maptiler-vector", "source-layer": "transportation", "filter": ["all", ["!has", "brunnel"], ["in", "class", "motorway", "trunk", "primary", "secondary", "tertiary", "minor"]], "layout": { "line-cap": "round", "line-join": "round", "line-sort-key": ["get", "layer"] }, "paint": { "line-color": "#5C4A1E", "line-width": getRoadOutlineWidth() } },
        { "id": "rd-core", "type": "line", "source": "maptiler-vector", "source-layer": "transportation", "filter": ["all", ["!has", "brunnel"], ["in", "class", "motorway", "trunk", "primary", "secondary", "tertiary", "minor"]], "layout": { "line-cap": "round", "line-join": "round", "line-sort-key": ["get", "layer"] }, "paint": { "line-color": "#F2C94C", "line-width": getRoadCoreWidth() } },

        // --- 7. МОСТЫ (ЗАЛИВКА ТЕЛ + ПУТИ LAYER 1+) ---
        { "id": "bridge-fill", "type": "fill", "source": "maptiler-vector", "source-layer": "transportation", "filter": ["all", ["==", "class", "bridge"], ["==", "$type", "Polygon"]], "paint": { "fill-color": "#3D311A", "fill-opacity": 0.85 } },
        { "id": "rd-b-out", "type": "line", "source": "maptiler-vector", "source-layer": "transportation", "filter": ["all", ["==", "brunnel", "bridge"], ["in", "class", "motorway", "trunk", "primary", "secondary", "tertiary", "minor"]], "layout": { "line-cap": "butt", "line-join": "round", "line-sort-key": ["get", "layer"] }, "paint": { "line-color": "#5C4A1E", "line-width": getRoadOutlineWidth() } },
        { "id": "rd-b-core", "type": "line", "source": "maptiler-vector", "source-layer": "transportation", "filter": ["all", ["==", "brunnel", "bridge"], ["in", "class", "motorway", "trunk", "primary", "secondary", "tertiary", "minor"]], "layout": { "line-cap": "butt", "line-join": "round", "line-sort-key": ["get", "layer"] }, "paint": { "line-color": "#F2C94C", "line-width": getRoadCoreWidth() } },
        { "id": "p-b-core", "type": "line", "source": "maptiler-vector", "source-layer": "transportation", "filter": ["all", ["==", "brunnel", "bridge"], ["in", "class", "path", "pedestrian", "footway"]], "layout": { "line-cap": "round", "line-join": "round", "line-sort-key": ["get", "layer"] }, "paint": { "line-color": "#C2A44A", "line-dasharray": [2, 4], "line-width": getPathwayWidth() } },

        // --- 8. ЖЕЛЕЗНЫЕ ДОРОГИ ---
        { "id": "rail-b", "type": "line", "source": "maptiler-vector", "source-layer": "transportation", "filter": ["==", "class", "rail"], "layout": { "line-cap": "round", "line-join": "round" }, "paint": { "line-color": "#383838", "line-width": ["interpolate", ["exponential", 1.3], ["zoom"], 12, 1, 16, 4, 20, 8] } },
        { "id": "rail-t", "type": "line", "source": "maptiler-vector", "source-layer": "transportation", "filter": ["==", "class", "rail"], "layout": { "line-cap": "round", "line-join": "round" }, "paint": { "line-color": "#818181", "line-dasharray": [1, 3], "line-width": ["interpolate", ["exponential", 1.3], ["zoom"], 14, 1, 20, 6], "line-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 15, 1] } },

        // --- 9. ЗДАНИЯ ---
        { "id": "b-body", "type": "fill", "source": "maptiler-vector", "source-layer": "building", "paint": { "fill-color": ["interpolate", ["linear"], ["zoom"], 13, "#202226", 16, "#353331"], "fill-outline-color": ["interpolate", ["linear"], ["zoom"], 13, "#202226", 16, "#c28400"], "fill-opacity": 0.7 } },
        { "id": "b-top", "type": "fill", "source": "maptiler-vector", "source-layer": "building", "paint": { "fill-color": "#3A3C40", "fill-opacity": ["interpolate", ["linear"], ["zoom"], 13.5, 0, 16, 0.7], "fill-outline-color": ["interpolate", ["linear"], ["zoom"], 13, "#202226", 16, "#c28400"] } },

        // --- 10. ГЕО-ПОДПИСИ ---
        { "id": "city-lbl", "type": "symbol", "source": "maptiler-vector", "source-layer": "place", "filter": ["==", "class", "city"], "layout": { "text-field": ["get", "name:ru"], "text-font": ["Metropolis Semi Bold", "Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 5, 16, 12, 24] }, "paint": { "text-color": "#B0B3B8", "text-halo-color": "#1A1C20", "text-halo-width": 1.5 } },
        { "id": "town-lbl", "type": "symbol", "source": "maptiler-vector", "source-layer": "place", "filter": ["==", "class", "town"], "layout": { "text-field": ["get", "name:ru"], "text-font": ["Metropolis Semi Bold", "Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 8, 12, 14, 18] }, "paint": { "text-color": "#B0B3B8", "text-halo-color": "#1A1C20", "text-halo-width": 1.5 } },
        { "id": "place-lbl", "type": "symbol", "source": "maptiler-vector", "source-layer": "place", "filter": ["any", ["==", "class", "suburb"], ["==", "class", "quarter"], ["==", "class", "neighbourhood"]], "layout": { "text-field": ["get", "name:ru"], "text-font": ["Metropolis Semi Bold", "Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 11, 10, 16, 14] }, "paint": { "text-color": "#B0B3B8", "text-halo-color": "#1A1C20", "text-halo-width": 1.5, "text-opacity": 0.8 } },

        // --- 11. ПОДПИСИ ОБЪЕКТОВ ---
        { "id": "wat-lbl", "type": "symbol", "source": "maptiler-vector", "source-layer": "waterway", "filter": ["any", ["==", "class", "river"], ["==", "class", "canal"]], "layout": { "text-field": ["get", "name:ru"], "text-font": ["Noto Sans Italic"], "text-size": ["interpolate", ["linear"], ["zoom"], 13, 11, 17, 15], "symbol-placement": "line" }, "paint": { "text-color": "#8DB3CC", "text-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0, 13, 1] } },
        { "id": "rd-lbl", "type": "symbol", "source": "maptiler-vector", "source-layer": "transportation_name", "filter": ["all", ["!=", "class", "ferry"], ["!=", "brunnel", "bridge"]], "layout": { "text-field": ["get", "name:ru"], "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 12.5, 11, 18, 24], "symbol-placement": "line" }, "paint": { "text-color": "#E0C070", "text-halo-color": "#1A1C20", "text-halo-width": 2, "text-opacity": ["interpolate", ["linear"], ["zoom"], 12.5, 0, 13.5, 1] } },
        { "id": "poi-lbl", "type": "symbol", "source": "maptiler-vector", "source-layer": "poi", "filter": ["all", ["has", "name"], ["!=", "name", "Дуб черешчатый"], ["!=", "class", "museum"], ["any", ["in", "class", "building", "university", "college", "government", "military", "place_of_worship", "townhall", "heritage", "monument", "palace", "castle", "station", "industrial"], ["==", "subclass", "theater"], ["==", "subclass", "theatre"], ["all", ["==", "class", "attraction"], ["==", "subclass", "attraction"]], ["all", ["==", "class", "shop"], ["==", "subclass", "mall"]], ["all", ["==", "class", "hospital"], ["!=", "subclass", "clinic"]]]], "layout": { "text-field": ["coalesce", ["get", "name:ru"], ["get", "name"]], "text-font": ["Noto Sans Regular"], "text-size": 12, "symbol-sort-key": ["get", "rank"] }, "paint": { "text-color": ["match", ["get", "class"], "university", "#8AA1CC", "college", "#8AA1CC", "hospital", "#E0877A", "#D1BFA4"], "text-halo-color": "rgba(26,28,32,0.9)", "text-halo-width": 2, "text-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0, 13, 1] } },
        { "id": "prk-lbl", "type": "symbol", "source": "maptiler-vector", "source-layer": "poi", "filter": ["all", ["has", "name"], ["any", ["==", "class", "park"], ["==", "class", "garden"], ["==", "class", "cemetery"]]], "layout": { "text-field": ["coalesce", ["get", "name:ru"], ["get", "name"]], "text-font": ["Noto Sans Regular"], "text-size": 12 }, "paint": { "text-color": "#8CB87C", "text-halo-color": "#1A1C20", "text-halo-width": 1, "text-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0, 13, 1] } },
        { "id": "h-num", "type": "symbol", "source": "maptiler-vector", "source-layer": "housenumber", "layout": { "text-field": ["get", "housenumber"], "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 17, 16, 20, 28] }, "paint": { "text-color": "#D1BFA4", "text-halo-color": "#1A1C20", "text-halo-width": 1.5, "text-opacity": ["interpolate", ["linear"], ["zoom"], 17, 0, 17.5, 1] } }
    ]
};


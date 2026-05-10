// setup.js

// 1. Твой API Ключ
const MAPTILER_KEY = 'MAPTILER_LIVE_TOKEN';

// 2. Динамические настройки ширины дорог (из твоих исходников)
const getRoadOutlineWidth = () => [
    "interpolate", ["linear"], ["zoom"],
    12, ["match", ["get", "class"], "motorway", 3, "trunk", 2.5, "primary", 2, "secondary", 1.5, 1],
    15, ["match", ["get", "class"], "motorway", 10, "trunk", 9, "primary", 7, "secondary", 5, 2.5],
    18, ["match", ["get", "class"], "motorway", 24, "trunk", 22, "primary", 20, "secondary", 16, 10]
];

const getRoadCoreWidth = () => [
    "interpolate", ["linear"], ["zoom"],
    12, ["match", ["get", "class"], "motorway", 1.5, "trunk", 1.2, "primary", 1, "secondary", 0.8, 0.4],
    15, ["match", ["get", "class"], "motorway", 6, "trunk", 5, "primary", 4, "secondary", 3, 1],
    18, ["match", ["get", "class"], "motorway", 18, "trunk", 16, "primary", 14, "secondary", 10, 6]
];

const getPathwayWidth = () => [
    "interpolate", ["linear"], ["zoom"],
    14, 0.7, 16, 0.8, 18.6, 2, 22, 5
];


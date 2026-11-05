// Sinh đường viền bản đồ Việt Nam (SVG path) từ Natural Earth (world-atlas) cho màn hình chính.
// Chạy: npm run gen:map
import { readFileSync, writeFileSync } from 'node:fs';
import { feature } from 'topojson-client';
import { geoMercator, geoPath } from 'd3-geo';

const W = 600, H = 1000;
const topo = JSON.parse(readFileSync('node_modules/world-atlas/countries-10m.json', 'utf8'));
const all = feature(topo, topo.objects.countries) as any;
const vn = all.features.find((f: any) => f.id === '704');
const neighbors = all.features.filter((f: any) => ['418', '116', '156', '764'].includes(f.id)); // Lào, Campuchia, Trung Quốc, Thái Lan

// Khung bao gồm cả hai quần đảo Hoàng Sa, Trường Sa
const frame = { type: 'MultiPoint', coordinates: [[101.8, 23.6], [117.2, 23.6], [117.2, 7.6], [101.8, 7.6]] } as any;
const proj = geoMercator().fitExtent([[24, 24], [W - 24, H - 24]], frame).clipExtent([[-10, -10], [W + 10, H + 10]]);
const path = geoPath(proj).digits(1);
const pathCoarse = geoPath(proj).digits(0);

const out = `// Tệp sinh tự động bởi scripts/gen-vn-map.ts — không sửa tay.
export const MAP_W = ${W};
export const MAP_H = ${H};
export const MAP_SCALE = ${proj.scale()};
export const MAP_TRANSLATE: [number, number] = [${proj.translate().join(', ')}];
export const VN_PATH = ${JSON.stringify(path(vn))};
export const NEIGHBOR_PATH = ${JSON.stringify(neighbors.map((f: any) => pathCoarse(f)).join(''))};
`;
writeFileSync('src/client/home/vn-map.generated.ts', out);
console.log('OK', (out.length / 1024).toFixed(1) + 'KB');

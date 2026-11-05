// Kit điểm đón taxi + bãi thuê xe máy. Vị trí lấy từ zone.transport (dữ liệu khu).
import * as THREE from 'three';
import type { KitFactory } from './types';
import { makeScooter, makeTaxi } from '../engine/vehicles';
import { textSprite } from '../engine/Avatar';

function signPost(text: string, bg: string, fg: string) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 8), new THREE.MeshStandardMaterial({ color: '#3a3f47', metalness: 0.6, roughness: 0.4 }));
  pole.position.y = 1.5;
  const board = textSprite(text, { font: '800 30px "Be Vietnam Pro", sans-serif', color: fg, bg, pad: 14 });
  board.position.y = 3.25;
  board.scale.multiplyScalar(1.3);
  (board.material as THREE.SpriteMaterial).color.setScalar(0.85);
  g.add(pole, board);
  return g;
}

export const transport: KitFactory = (ctx) => {
  const t = ctx.zone.transport;
  if (!t) return {};
  const H = (x: number, z: number) => ctx.zone.walk.find((r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1)?.h0 ?? ctx.zone.ground.bankHeight;
  let taxiSign: THREE.Object3D | null = null;
  if (t.taxi) {
    const y = H(t.taxi.x, t.taxi.z);
    const post = signPost('TAXI', 'rgba(255,214,26,.95)', '#12213D');
    post.position.set(t.taxi.x, y, t.taxi.z);
    // xe taxi đỗ chờ bên lề đường, hướng dọc đường
    const car = makeTaxi();
    const side = Math.sign(t.taxi.x) || 1;
    car.position.set(t.taxi.carX ?? t.taxi.x + side * 5, y, t.taxi.z);
    ctx.scene.add(post, car);
    taxiSign = post;
  }
  if (t.bikes) {
    const y = H(t.bikes.x, t.bikes.z);
    const post = signPost('Thuê xe máy', 'rgba(31,163,154,.95)', '#ffffff');
    post.position.set(t.bikes.x, y, t.bikes.z);
    ctx.scene.add(post);
    const colors = ['#C8102E', '#F2F2EE', '#3B6FD8', '#1C1C1C', '#E8C547'];
    colors.forEach((c, i) => {
      const b = makeScooter(c);
      b.position.set(t.bikes!.x + Math.sign(t.bikes!.x || 1) * 2.4, y, t.bikes!.z - 4 + i * 1.6);
      b.rotation.y = Math.PI / 2 + 0.35;
      ctx.scene.add(b);
    });
  }
  return {
    update(_dt, env) {
      if (taxiSign) taxiSign.scale.setScalar(1 + env.night * 0.05);
    },
  };
};

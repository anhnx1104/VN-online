// Khu dài vài km có hàng nghìn cây, đèn, ghế... vẽ bằng InstancedMesh. Mặc định GPU vẽ hết mọi bản sao
// (kể cả lượt vẽ bóng đổ) dù ở tận cuối đường. Lớp này chỉ giữ lại các bản sao trong bán kính quanh camera,
// dồn chúng lên đầu bộ đệm và đặt `count`; đối tượng giữ nguyên nên code khác vẫn tham chiếu được.
import * as THREE from 'three';

interface Item {
  mesh: THREE.InstancedMesh;
  all: Float32Array;
  cols: Float32Array | null;
  xz: Float32Array;
  r2: number;
}

export class InstanceCuller {
  private items: Item[] = [];
  private lastX = Infinity;
  private lastZ = Infinity;

  /** Gom các InstancedMesh tĩnh trải rộng hơn `minExtent` mét. Đánh dấu `userData.dynamic` để bỏ qua. */
  collect(root: THREE.Object3D, minExtent = 260) {
    root.updateMatrixWorld(true);
    const m = new THREE.Matrix4(), p = new THREE.Vector3();
    root.traverse((o) => {
      const mesh = o as THREE.InstancedMesh;
      if (!mesh.isInstancedMesh || mesh.userData.dynamic || mesh.count < 16) return;
      const n = mesh.count;
      const xz = new Float32Array(n * 2);
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let i = 0; i < n; i++) {
        mesh.getMatrixAt(i, m);
        p.setFromMatrixPosition(m.premultiply(mesh.matrixWorld));
        xz[i * 2] = p.x; xz[i * 2 + 1] = p.z;
        x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z);
      }
      if (Math.max(x1 - x0, z1 - z0) < minExtent) return;
      if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
      // vật càng nhỏ càng sớm bỏ: ghế, bụi hoa ~300 m; đèn ~450 m; cây cao ~700 m
      const gr = mesh.geometry.boundingSphere!.radius;
      const r = (mesh.userData.cullRadius as number | undefined) ?? Math.min(900, 260 + gr * 60);
      this.items.push({
        mesh,
        all: (mesh.instanceMatrix.array as Float32Array).slice(0, n * 16),
        cols: mesh.instanceColor ? (mesh.instanceColor.array as Float32Array).slice(0, n * 3) : null,
        xz,
        r2: r * r,
      });
    });
  }

  update(cam: THREE.Vector3) {
    // chỉ dồn lại khi camera đã đi đủ xa
    if (Math.hypot(cam.x - this.lastX, cam.z - this.lastZ) < 30) return;
    this.lastX = cam.x; this.lastZ = cam.z;
    for (const it of this.items) {
      const dst = it.mesh.instanceMatrix.array as Float32Array;
      const cdst = it.mesh.instanceColor?.array as Float32Array | undefined;
      const n = it.xz.length / 2;
      let k = 0;
      for (let i = 0; i < n; i++) {
        const dx = it.xz[i * 2] - cam.x, dz = it.xz[i * 2 + 1] - cam.z;
        if (dx * dx + dz * dz > it.r2) continue;
        dst.set(it.all.subarray(i * 16, i * 16 + 16), k * 16);
        if (it.cols && cdst) cdst.set(it.cols.subarray(i * 3, i * 3 + 3), k * 3);
        k++;
      }
      it.mesh.count = k;
      it.mesh.instanceMatrix.needsUpdate = true;
      if (it.mesh.instanceColor) it.mesh.instanceColor.needsUpdate = true;
      // cập nhật khối bao để camera và bóng đổ còn loại được cả cụm khi nằm ngoài khung nhìn
      if (k > 0) it.mesh.computeBoundingSphere();
    }
  }
}

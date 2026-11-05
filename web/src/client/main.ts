import './style.css';
import { syncTime } from './api';

const app = document.getElementById('app')!;
let cleanup: (() => void) | null = null;
let routing = 0;

export function navigate(path: string) {
  history.pushState({}, '', path);
  void route();
}

async function route() {
  const id = ++routing;
  cleanup?.();
  cleanup = null;
  app.innerHTML = '';
  const m = location.pathname.match(/^\/d\/([a-z0-9-]+)/);
  if (m) {
    const { mountWorld } = await import('./world/WorldApp');
    if (id !== routing) return;
    cleanup = await mountWorld(app, m[1]);
  } else {
    const { mountHome } = await import('./home/Home');
    if (id !== routing) return;
    cleanup = mountHome(app);
  }
}

addEventListener('popstate', () => void route());
syncTime().then(route);

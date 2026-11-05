// Lưu trữ JSON trên đĩa cho bản v1 (thay bằng PostgreSQL khi lên MVP đầy đủ).
// Ghi file không bao giờ được làm sập server: tự tạo lại thư mục nếu bị xóa, lỗi thì ghi log và thử lại sau.
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.cwd(), 'data');

export class JsonStore<T> {
  private file: string;
  data: T;
  private timer: NodeJS.Timeout | null = null;
  constructor(name: string, initial: T) {
    this.file = join(DIR, name + '.json');
    let data = initial;
    try {
      if (existsSync(this.file)) data = JSON.parse(readFileSync(this.file, 'utf8'));
    } catch (e) {
      console.error(`[vno] không đọc được ${this.file}, dùng dữ liệu trống`, e);
    }
    this.data = data;
  }
  save() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      try {
        mkdirSync(DIR, { recursive: true });
        const tmp = this.file + '.tmp';
        writeFileSync(tmp, JSON.stringify(this.data));
        renameSync(tmp, this.file);
      } catch (e) {
        console.error(`[vno] lưu ${this.file} thất bại, sẽ thử lại`, e);
        setTimeout(() => this.save(), 5000);
      }
    }, 300);
  }
}

// Danh mục Kit: tên trong cấu hình khu → hàm dựng.
import type { KitFactory } from './types';
import { river } from './river';
import { banks } from './banks';
import { serpentBridge } from './serpentBridge';
import { lockPier } from './lockPier';
import { statueFountain } from './statueFountain';
import { promenade } from './promenade';
import { cityscape } from './cityscape';
import { beamBridge } from './beamBridge';
import { mountains } from './mountains';
import { road } from './road';
import { transport } from './transport';
import { ocean } from './ocean';
import { beach } from './beach';
import { beachProps } from './beachProps';

export const KITS: Record<string, KitFactory> = {
  river,
  banks,
  'serpent-bridge': serpentBridge,
  'lock-pier': lockPier,
  'statue-fountain': statueFountain,
  promenade,
  cityscape,
  'beam-bridge': beamBridge,
  'skyline-mountains': mountains,
  road,
  transport,
  ocean,
  beach,
  'beach-props': beachProps,
};

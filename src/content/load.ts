import type { CatalogEntry } from '../domain/recommend';
import { moduleSchema, type ModuleContent } from './schema';

// content/modules/*.json을 빌드에 포함한다 (서비스 워커가 함께 캐시).
const raw = import.meta.glob('../../content/modules/*.json', { eager: true, import: 'default' });

function loadModules(): Map<string, ModuleContent> {
  const map = new Map<string, ModuleContent>();
  for (const [path, data] of Object.entries(raw)) {
    const parsed = moduleSchema.safeParse(data);
    if (!parsed.success) {
      // 형식이 틀린 모듈은 빼고 나머지로 동작한다. 테스트에서 먼저 걸러지므로 배포본에서는 일어나지 않아야 한다.
      console.error(`콘텐츠 형식 오류: ${path}`, parsed.error.issues);
      continue;
    }
    map.set(parsed.data.id, parsed.data);
  }
  return map;
}

export const MODULES = loadModules();

export function getModule(id: string): ModuleContent | undefined {
  return MODULES.get(id);
}

export function catalog(): CatalogEntry[] {
  return [...MODULES.values()].map((m) => ({
    id: m.id,
    kind: m.kind,
    mainScale: m.postMeasure.id,
    summary: m.summary,
    variants: (['minimal', 'basic', 'extended'] as const).flatMap((key) => {
      const v = m.variants[key];
      return v ? [{ key, estimatedSec: v.estimatedSec }] : [];
    }),
  }));
}

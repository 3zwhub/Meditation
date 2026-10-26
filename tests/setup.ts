import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// vitest 전역(globals)을 쓰지 않으므로 Testing Library의 화면 정리를 직접 등록한다
afterEach(() => cleanup());

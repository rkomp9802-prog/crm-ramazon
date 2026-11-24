import { rmSync } from "node:fs";

const TEST_DB_DIR = ".test-dbs";

function removeTestDatabases(): void {
  try {
    rmSync(TEST_DB_DIR, { recursive: true, force: true });
  } catch (error) {
    console.warn(`Не удалось удалить ${TEST_DB_DIR}:`, error instanceof Error ? error.message : error);
  }
}

// Временные базы удаляем целиком до и после прогона. Teardown выполняется в главном процессе,
// когда воркеры vitest уже завершены, — Windows больше не держит файлы открытыми.
export default function setup() {
  removeTestDatabases();
  return removeTestDatabases;
}

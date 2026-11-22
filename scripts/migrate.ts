import "./env";
import { getDb } from "@/lib/turso";
import { migrate } from "@/lib/schema";

async function main() {
  await migrate(getDb());
  console.log("Схема базы данных применена.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

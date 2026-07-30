# 1. Update src/server/db.ts
sed -i 's/export const db = new Database();/let dbInstance: Database | null = null;\n\nexport function getDatabase(): Database {\n  if (!dbInstance) {\n    dbInstance = new Database();\n  }\n  return dbInstance;\n}/g' src/server/db.ts

# 2. Update server.ts imports
sed -i 's/import { db,/import { getDatabase,/g' server.ts

# 3. Update all db. method calls in server.ts
sed -i 's/db\./getDatabase()./g' server.ts


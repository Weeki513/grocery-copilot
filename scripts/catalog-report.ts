import { catalogStats } from "../src/server/catalog/repository";
import { closeDb } from "../src/server/db";

const stats = catalogStats();
console.log(JSON.stringify(stats, null, 2));
closeDb();

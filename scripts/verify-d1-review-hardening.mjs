import {execFile} from "node:child_process";
import {promisify} from "node:util";
const exec=promisify(execFile);
const database=process.env.DB_NAME??"ecommerce-iphone";
async function wrangler(args){const {stdout,stderr}=await exec("pnpm",["exec","wrangler",...args],{env:process.env,maxBuffer:4*1024*1024});if(stderr.trim())process.stderr.write(stderr);return stdout;}
async function query(sql){const raw=await wrangler(["d1","execute",database,"--remote","--json","--command",sql]);try{return JSON.parse(raw);}catch{throw new Error("Unable to parse Wrangler JSON output");}}
const migration=await wrangler(["d1","migrations","list",database,"--remote"]);if(!/0036_phase08_review_hardening/i.test(migration))throw new Error("Migration 0036 is not visible in the remote D1 migration list");
const tables=await query("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('review_moderation_events','review_reports') ORDER BY name");
const tableNames=(tables[0]?.results??tables.results??[]).map(x=>x.name);for(const name of ["review_moderation_events","review_reports"]){if(!tableNames.includes(name))throw new Error("Missing remote table: "+name);}
const fks=await query("SELECT m.name, f.[table] AS parent_table, f.[from] AS source_column, f.[to] AS target_column FROM sqlite_master m JOIN pragma_foreign_key_list(m.name) f WHERE m.name IN ('review_moderation_events','review_reports') ORDER BY m.name,f.id");
const fkRows=fks[0]?.results??fks.results??[];
const expected=[["review_moderation_events","product_reviews","review_id","id"],["review_moderation_events","admin_users","admin_user_id","id"],["review_reports","product_reviews","review_id","id"],["review_reports","customers","customer_id","id"]];
for(const [table,parent,source,target] of expected){if(!fkRows.some(x=>x.name===table&&x.parent_table===parent&&x.source_column===source&&x.target_column===target))throw new Error("Missing FK "+table+" -> "+parent+"."+source+" -> "+target);}
console.log("PASS remote D1 migration 0036: migration record, tables and required foreign keys verified.");

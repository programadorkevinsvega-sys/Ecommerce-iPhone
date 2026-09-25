import {execFile} from "node:child_process";
import {promisify} from "node:util";
const exec=promisify(execFile);
const database=process.env.DB_NAME??"ecommerce-iphone";
async function wrangler(args){const {stdout,stderr}=await exec("pnpm",["exec","wrangler",...args],{env:process.env,maxBuffer:4*1024*1024});if(stderr.trim())process.stderr.write(stderr);return stdout;}
async function query(sql){const raw=await wrangler(["d1","execute",database,"--remote","--json","--command",sql]);try{return JSON.parse(raw);}catch{throw new Error("Unable to parse Wrangler JSON output");}}
const migration=await wrangler(["d1","migrations","list",database,"--remote"]);if(!/0036_phase08_review_hardening/i.test(migration))throw new Error("Migration 0036 is not visible in the remote D1 migration list");
const tables=await query("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('review_moderation_events','review_reports') ORDER BY name");
const tableNames=(tables[0]?.results??tables.results??[]).map(x=>x.name);for(const name of ["review_moderation_events","review_reports"]){if(!tableNames.includes(name))throw new Error("Missing remote table: "+name);}
const eventFks=await query("PRAGMA foreign_key_list('review_moderation_events')");
const reportFks=await query("PRAGMA foreign_key_list('review_reports')");
const eventRows=eventFks[0]?.results??eventFks.results??[];
const reportRows=reportFks[0]?.results??reportFks.results??[];
if(!eventRows.some(x=>x.table==="product_reviews"&&x.from==="review_id"&&x.to==="id"))throw new Error("Missing moderation-event review FK");
if(!eventRows.some(x=>x.table==="admin_users"&&x.from==="admin_user_id"&&x.to==="id"))throw new Error("Missing moderation-event admin FK");
if(!reportRows.some(x=>x.table==="product_reviews"&&x.from==="review_id"&&x.to==="id"))throw new Error("Missing report review FK");
if(!reportRows.some(x=>x.table==="customers"&&x.from==="customer_id"&&x.to==="id"))throw new Error("Missing report customer FK");
console.log("PASS remote D1 migration 0036: migration record, tables and required foreign keys verified.");

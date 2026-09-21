import { NextResponse } from "next/server";
import { createTechnician,listTechnicians,updateTechnician } from "../../../../lib/api/adminTechnicians";

function bodyRecord(value:unknown){if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("INVALID_BODY");return value as Record<string,unknown>;}
function responseFor(error:unknown){const code=error instanceof Error?error.message:"UNKNOWN";const status=code==="UNAUTHORIZED"?401:code==="FORBIDDEN"?403:code==="TECHNICIAN_ALREADY_EXISTS"?409:code==="TECHNICIAN_NOT_FOUND"?404:400;const message=status===401?"Authentication required":status===403?"Forbidden":status===409?"Technician already exists":status===404?"Technician not found":"Invalid technician data";return NextResponse.json({error:message},{status,headers:{"cache-control":"no-store"}});}
export async function GET(){try{return NextResponse.json({items:await listTechnicians()},{headers:{"cache-control":"no-store"}});}catch(error){return responseFor(error);}}
export async function POST(request:Request){try{return NextResponse.json({id:await createTechnician(bodyRecord(await request.json()))},{status:201,headers:{"cache-control":"no-store"}});}catch(error){return responseFor(error);}}
export async function PATCH(request:Request){try{await updateTechnician(bodyRecord(await request.json()));return NextResponse.json({updated:true},{headers:{"cache-control":"no-store"}});}catch(error){return responseFor(error);}}

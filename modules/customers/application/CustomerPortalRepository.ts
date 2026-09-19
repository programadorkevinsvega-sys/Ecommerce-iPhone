export type CustomerDevice = Readonly<{
  id: string;
  customerId: string;
  deviceType: string;
  brand: string;
  model: string;
  serialLast4: string | null;
  imeiLast4: string | null;
  color: string | null;
  capacity: string | null;
  physicalCondition: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}>;
export type CustomerRepair = Readonly<{ id:string; orderNumber:string; status:string; problemReported:string; diagnosisSummary:string|null; workSummary:string|null; receivedAt:string; estimatedCompletionAt:string|null; device:{ brand:string; model:string; serialLast4:string|null; imeiLast4:string|null; color:string|null } }>;
export type CustomerWarranty = Readonly<{ repairOrderId:string; orderNumber:string; warrantyNumber:string; coverage:string; months:number; startsAt:string; expiresAt:string; status:string }>;
export type CustomerCommunication = Readonly<{ id:string; type:string; aggregateId:string; payload:Record<string,unknown>; createdAt:string }>;
export interface CustomerPortalRepository {
  listDevices(customerId:string):Promise<readonly CustomerDevice[]>;
  listRepairs(customerId:string):Promise<readonly CustomerRepair[]>;
  listWarranties(customerId:string):Promise<readonly CustomerWarranty[]>;
  listCommunications(customerId:string):Promise<readonly CustomerCommunication[]>;
}

import { CustomerDeviceService } from "../../customers/application/CustomerDeviceService";
import type { CustomerDeviceRepository } from "../../customers/application/CustomerDeviceRepository";
import type { RepairOrderRepository } from "../../repairs/application/RepairOrderRepository";

export class TechnicianDeviceService {
  constructor(private readonly devices:CustomerDeviceRepository,private readonly orders:RepairOrderRepository){}
  async list(technicianId:string){const orders=await this.orders.list({technicianId,limit:100});const result=[];for(const order of orders){const value=order.toPrimitives();if(!value.customerDeviceId||!value.customerId)continue;const device=await this.devices.find(value.customerId,value.customerDeviceId);if(device)result.push({orderId:order.getId(),orderNumber:value.orderNumber,customerEmail:value.email,device:device.toPrimitives()});}return result;}
  private async assignedOrder(technicianId:string,orderId:string){const order=await this.orders.findById(orderId);if(!order)throw new Error("REPAIR_ORDER_NOT_FOUND");const value=order.toPrimitives();if(value.assignedTechnicianId!==technicianId)throw new Error("FORBIDDEN");if(!value.customerId)throw new Error("REPAIR_ORDER_CUSTOMER_REQUIRED");return order;}
  async update(technicianId:string,orderId:string,input:Record<string,unknown>){
    const order=await this.assignedOrder(technicianId,orderId);
    const value=order.toPrimitives();
    if(!value.customerDeviceId||!value.customerId)throw new Error("DEVICE_NOT_LINKED");
    const current=await this.devices.find(value.customerId,value.customerDeviceId);
    if(!current)throw new Error("DEVICE_NOT_FOUND");
    const currentProps=current.toPrimitives();
    return new CustomerDeviceService(this.devices).update(value.customerId,value.customerDeviceId,{
      deviceType:typeof input.deviceType==="string"?input.deviceType as any:currentProps.deviceType,
      brand:typeof input.brand==="string"?input.brand:currentProps.brand,
      model:typeof input.model==="string"?input.model:currentProps.model,
      serialLast4:typeof input.serialLast4==="string"&&input.serialLast4?input.serialLast4:currentProps.serialLast4,
      imeiLast4:typeof input.imeiLast4==="string"&&input.imeiLast4?input.imeiLast4:currentProps.imeiLast4,
      color:typeof input.color==="string"&&input.color?input.color:currentProps.color,
      capacity:typeof input.capacity==="string"&&input.capacity?input.capacity:currentProps.capacity,
      physicalCondition:typeof input.physicalCondition==="string"&&input.physicalCondition?input.physicalCondition:currentProps.physicalCondition,
      notes:typeof input.notes==="string"&&input.notes?input.notes:currentProps.notes,
    });
  }
  async create(technicianId:string,orderId:string,input:Record<string,unknown>){const order=await this.assignedOrder(technicianId,orderId);if(order.toPrimitives().customerDeviceId)throw new Error("DEVICE_ALREADY_LINKED");const p=order.toPrimitives();const service=new CustomerDeviceService(this.devices);const device=await service.create(p.customerId!,{deviceType:typeof input.deviceType==="string"?input.deviceType as any:"PHONE",brand:typeof input.brand==="string"?input.brand:"",model:typeof input.model==="string"?input.model:"",serialLast4:typeof input.serialLast4==="string"&&input.serialLast4?input.serialLast4:null,imeiLast4:typeof input.imeiLast4==="string"&&input.imeiLast4?input.imeiLast4:null,color:typeof input.color==="string"&&input.color?input.color:null,capacity:typeof input.capacity==="string"&&input.capacity?input.capacity:null,physicalCondition:typeof input.physicalCondition==="string"&&input.physicalCondition?input.physicalCondition:null,notes:typeof input.notes==="string"&&input.notes?input.notes:null});order.attachCustomerDevice(device.getId());await this.orders.save(order,technicianId);return device;}
}

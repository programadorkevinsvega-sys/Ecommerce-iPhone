export type OrderStatus = "PENDING_PAYMENT"|"PAYMENT_PROCESSING"|"PAID"|"PROCESSING"|"READY_TO_SHIP"|"SHIPPED"|"DELIVERED"|"CANCELLED"|"REFUND_PENDING"|"REFUNDED";
export type ShippingAddress = Readonly<{recipientName:string;phone:string;addressLine1:string;addressLine2?:string|undefined;city:string;state:string;postalCode?:string|undefined;countryCode:string}>;
export type OrderItem = Readonly<{id:string;productId:string;productName:string;productSlug:string;quantity:number;unitPriceInCents:number;lineTotalInCents:number}>;
export type Order = Readonly<{id:string;orderNumber:string;customerId?:string|undefined;email:string;status:OrderStatus;currency:string;subtotalInCents:number;shippingInCents:number;discountInCents:number;totalInCents:number;shippingMethod:string;shippingAddress:ShippingAddress;items:readonly OrderItem[]}>;

export const ORDER_TRANSITIONS: Record<OrderStatus,readonly OrderStatus[]> = {
  PENDING_PAYMENT:["PAYMENT_PROCESSING","PAID","CANCELLED"], PAYMENT_PROCESSING:["PAID","CANCELLED"], PAID:["PROCESSING","REFUND_PENDING"], PROCESSING:["READY_TO_SHIP","CANCELLED"], READY_TO_SHIP:["SHIPPED"], SHIPPED:["DELIVERED"], DELIVERED:["REFUND_PENDING"], CANCELLED:[], REFUND_PENDING:["REFUNDED"], REFUNDED:[]
};

export function assertOrderTransition(from:OrderStatus,to:OrderStatus):void {
  if (!ORDER_TRANSITIONS[from].includes(to)) throw new Error(`Invalid order transition: ${from} -> ${to}`);
}

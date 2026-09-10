import { DomainError } from "../../shared-kernel";

export type CartItem = Readonly<{productId:string;productName:string;slug:string;quantity:number;unitPriceInCents:number;currency:string;stock:number;variantId?:string;variantName?:string}>;
export type Cart = Readonly<{id:string;customerId?:string;currency:string;items:readonly CartItem[]}>;
export function assertCartQuantity(quantity:number):void{if(!Number.isInteger(quantity)||quantity<1||quantity>99)throw new DomainError("INVALID_CART_QUANTITY","Cart quantity must be between 1 and 99");}
export function cartTotals(cart:Cart){return{subtotalInCents:cart.items.reduce((sum,item)=>sum+item.quantity*item.unitPriceInCents,0),itemCount:cart.items.reduce((sum,item)=>sum+item.quantity,0),currency:cart.currency};}

export type CheckoutCart = Readonly<{id:string;currency:string;items:readonly Readonly<{productId:string;productName:string;slug:string;quantity:number;unitPriceInCents:number}>[]}>;

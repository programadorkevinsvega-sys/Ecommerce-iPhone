import { DomainError } from "../../shared-kernel";

export type CustomerProps = Readonly<{ email:string; firstName:string; lastName:string; phone?:string|undefined }>;

export class Customer {
  private constructor(private readonly id:string, private props:CustomerProps) {}
  static create(id:string, props:CustomerProps):Customer {
    if (!/^\S+@\S+\.\S+$/.test(props.email)) throw new DomainError("Invalid customer email");
    if (!props.firstName.trim() || !props.lastName.trim()) throw new DomainError("Customer name is required");
    return new Customer(id, props);
  }
  getId():string { return this.id; }
  toPrimitives():CustomerProps & {id:string} { return {id:this.id,...this.props}; }
}

export type AddressProps = Readonly<{ label:string; recipientName:string; phone:string; addressLine1:string; addressLine2?:string|undefined; city:string; state:string; postalCode?:string|undefined; countryCode:string; isDefault:boolean }>;
export class Address {
  private constructor(private readonly id:string, private props:AddressProps) {}
  static create(id:string, props:AddressProps):Address {
    for (const [key,value] of Object.entries(props)) if (["label","recipientName","phone","addressLine1","city","state","countryCode"].includes(key) && typeof value === "string" && !value.trim()) throw new DomainError(`Address ${key} is required`);
    if (props.countryCode.length !== 2) throw new DomainError("Invalid country code");
    return new Address(id, props);
  }
  getId():string { return this.id; }
  toPrimitives():AddressProps & {id:string} { return {id:this.id,...this.props}; }
}

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { D1CartRepository } from "../../../modules/cart/infrastructure/D1CartRepository";
import { D1CustomerRepository } from "../../../modules/customers/infrastructure/D1CustomerRepository";
import { D1OrderRepository } from "../../../modules/orders/infrastructure/D1OrderRepository";
import { Checkout } from "../../../modules/orders/application/Checkout";

export async function commerceContext(){
  const {env}=getCloudflareContext();
  return {db:env.DB,cartRepo:new D1CartRepository(env.DB),customerRepo:new D1CustomerRepository(env.DB),orderRepo:new D1OrderRepository(env.DB)};
}
export async function checkoutUseCase(){const c=await commerceContext();return {context:c,checkout:new Checkout(c.db,c.orderRepo)};}

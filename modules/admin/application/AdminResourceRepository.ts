import type { ResourceName } from "./AdminResources";

export type ProductCreation = {
  id: string;
  name: string;
  slug: string;
  brand: string;
  model: string;
  description: string;
  condition: string;
  priceInCents: number;
  stock: number;
  warrantyMonths: number;
  batteryHealth: number | null;
  storageGb: number | null;
  color: string | null;
  specsJson: string;
};

export type MutationService = { status: string; email: string };
export type MutationOrder = { status: string; email: string; orderNumber: string };
export type StatusTransitionValidator = (fromStatus: string, toStatus: string) => void;

export interface AdminResourceRepository {
  list(resource: ResourceName, query: string): Promise<unknown[]>;
  createProduct(product: ProductCreation): Promise<string>;
  updateProduct(id: string, fields: string[], values: unknown[]): Promise<void>;
  deleteProduct(id: string): Promise<void>;
  getProductCategoryIds(productId: string): Promise<string[]>;
  replaceProductCategories(productId: string, categoryIds: readonly string[]): Promise<void>;
  replaceProductImages(productId: string, imageUrls: readonly string[]): Promise<void>;
  getServiceForMutation(id: string): Promise<MutationService | null>;
  quoteService(id: string, amountInCents: number, actorId: string): Promise<void>;
  updateServiceStatus(
    id: string,
    status: string,
    actorId: string,
    fromStatus: string,
  ): Promise<void>;
  getOrderForMutation(id: string): Promise<MutationOrder | null>;
  updateOrderStatus(id: string, status: string, actorId: string, fromStatus: string): Promise<void>;
}

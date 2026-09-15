import { requireUser } from '@/lib/server-auth';
import { ProductCatalog } from '@/components/products/product-catalog';

export default async function ProductsPage() {
  const user = await requireUser();
  return <ProductCatalog user={user} />;
}

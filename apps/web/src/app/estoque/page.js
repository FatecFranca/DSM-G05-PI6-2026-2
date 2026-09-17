import { requireUser } from '@/lib/server-auth';
import { StockManagement } from '@/components/stock/stock-management';

export default async function StockPage() {
  const user = await requireUser();
  return <StockManagement user={user} />;
}

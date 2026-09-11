import { Dashboard } from "@/components/dashboard";
import { requireUser } from '@/lib/server-auth';
async function Home() {
  const user = await requireUser();
  return <Dashboard user={user} />;
}
export {
  Home as default
};

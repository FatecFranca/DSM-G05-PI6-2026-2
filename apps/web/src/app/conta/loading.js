import { AuthSkeleton } from '@/components/loading-states';
export default function Loading() {
  return <main className="account-page"><h1>Minha conta</h1><AuthSkeleton fields={3} /></main>;
}

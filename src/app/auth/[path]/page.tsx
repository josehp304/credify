import { AuthView } from '@neondatabase/auth/react';

export const dynamicParams = false;

// We need to resolve `path` dynamically, but AuthView handles the inner logic
export default async function AuthPage({ params }: { params: Promise<{ path: string }> }) {
  const { path } = await params;

  return (
    <main className="container mx-auto flex grow flex-col items-center justify-center gap-3 self-center p-4 md:p-6" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AuthView path={path} />
    </main>
  );
}

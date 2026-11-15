import ErrorBoundary from '@/components/observatory/ErrorBoundary';
import ObservatoryShell from '@/components/observatory/ObservatoryShell';

export default function HomePage() {
  return (
    <ErrorBoundary scope="root">
      <ObservatoryShell />
    </ErrorBoundary>
  );
}

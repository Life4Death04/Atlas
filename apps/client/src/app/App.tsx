import { QueryProvider } from './providers/QueryProvider';
import { Router } from './Router';

export default function App() {
  return (
    <QueryProvider>
      <Router />
    </QueryProvider>
  );
}

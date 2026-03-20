import { TopBar } from './components/layout/TopBar';
import { TableArea } from './components/layout/TableArea';
import { ActionPanel } from './components/layout/ActionPanel';
import { SidePanel } from './components/layout/SidePanel';

export function App() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <main className="flex flex-col flex-1 items-center justify-center">
          <TableArea />
          <ActionPanel />
        </main>
        <SidePanel />
      </div>
    </div>
  );
}

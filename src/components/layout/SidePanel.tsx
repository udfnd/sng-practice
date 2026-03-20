export function SidePanel() {
  return (
    <aside className="hidden lg:flex flex-col w-72 bg-gray-800 border-l border-gray-700 overflow-y-auto">
      <div className="p-3 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Action Log
        </h3>
      </div>
      <div className="flex-1 p-3 text-sm text-gray-400">
        <p className="italic">Game not started</p>
      </div>
    </aside>
  );
}

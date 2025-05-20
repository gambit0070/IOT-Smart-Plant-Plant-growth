export default function Topbar() {
    return (
      <header className="flex justify-between items-center p-4 bg-white shadow-sm">
        <input type="text" placeholder="Search..." className="px-3 py-1 border rounded-md" />
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-gray-300" />
        </div>
      </header>
    );
  }
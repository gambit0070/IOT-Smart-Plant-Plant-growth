import { Home, ToggleLeft, User, Bell } from "lucide-react";
import { Link } from "react-router-dom";
// const menu = [
//   { icon: <Home size={20} />, label: "Main Dashboard" },
//   { icon: <ShoppingCart size={20} />, label: "NFT Marketplace" },
//   { icon: <Table size={20} />, label: "Data Tables" },
//   { icon: <User size={20} />, label: "Profile" },
//   { icon: <Lock size={20} />, label: "Sign In" },
// ];

const menu = [
  { icon: <Home size={20} />, label: "Main Dashboard", to: "/dashboard" },
  { icon: <ToggleLeft size={20} />, label: "Control", to: "/control" },
  { icon: <User size={20} />, label: "Operation History", to: "/ophistory" },
  { icon: <Bell size={20} />, label: "Notification Settings", to: "/notifications" },
  // { icon: <Lock size={20} />, label: "Sign In", to: "/signin" },
];


export default function Sidebar() {
  return (
    <aside className="w-64 min-h-screen bg-white border-r px-4 py-6">
      {/* <ul className="space-y-4">
        {menu.map((item, idx) => (
          <li key={idx} className="flex items-center space-x-3 text-gray-600 hover:text-blue-500 cursor-pointer">
            {item.icon}
            <span>{item.label}</span>
          </li>
        ))}
      </ul> */}
      <ul className="space-y-4">
        {menu.map((item, idx) => (
          <li key={idx}>
            <Link
              to={item.to}
              className="flex items-center space-x-3 text-gray-600 hover:text-blue-500"
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>

    </aside>
  );
}
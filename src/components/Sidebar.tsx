import React from "react";
import { 
  LayoutDashboard, 
  Building2, 
  FileText, 
  Users, 
  Building, 
  Landmark, 
  CalendarClock, 
  AlertTriangle, 
  Wrench, 
  Scale, 
  Sparkles, 
  LogOut,
  User,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Settings
} from "lucide-react";
import { AppSection } from "../types";
import Logo from "./Logo";

interface SidebarProps {
  currentSection: AppSection;
  setCurrentSection: (section: AppSection) => void;
  user: {
    displayName?: string;
    email?: string;
    photoURL?: string;
  } | null;
  onLogout: () => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function Sidebar({ 
  currentSection, 
  setCurrentSection, 
  user, 
  onLogout,
  isOpen,
  setIsOpen
}: SidebarProps) {
  // Desktop collapse state, persisting to localStorage
  const [isCollapsed, setIsCollapsed] = React.useState(() => {
    try {
      return localStorage.getItem("sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  interface MenuItem {
    readonly id: AppSection;
    readonly label: string;
    readonly icon: any;
    readonly highlight?: boolean;
  }

  const menuItems: MenuItem[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "fast_closing", label: "Fast Closing", icon: CalendarClock },
    { id: "properties", label: "Immobili", icon: Building2 },
    { id: "owners", label: "Area Proprietari", icon: User },
    { id: "contracts", label: "Contratti", icon: FileText },
    { id: "tenants", label: "Inquilini", icon: Users },
    { id: "condominiums", label: "Condomini", icon: Building },
    { id: "banks", label: "Banche", icon: Landmark },
    { id: "reminders", label: "Solleciti", icon: AlertTriangle },
    { id: "maintenance", label: "Manutenzioni", icon: Wrench },
    { id: "legal", label: "Legale", icon: Scale },
    { id: "ai_area", label: "Area AI", icon: Sparkles, highlight: true },
    { id: "settings", label: "Impostazioni", icon: Settings },
  ];

  const renderSidebarContent = (collapsed: boolean) => {
    return (
      <>
        {/* Upper part */}
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Logo Brand area */}
          <div className={`p-4 border-b border-slate-800 flex items-center ${collapsed ? "justify-center" : "space-x-3"}`}>
            <div className="bg-slate-900 p-1.5 rounded-xl text-white shrink-0 shadow-inner border border-slate-800 flex items-center justify-center">
              <Logo size={32} />
            </div>
            {!collapsed && (
              <div className="transition-opacity duration-300">
                <h1 className="font-sans font-black text-sm tracking-tight text-white leading-none">Palazzinaro <span className="text-indigo-400">AI</span></h1>
                <p className="text-[9px] text-indigo-400 font-mono tracking-widest uppercase mt-1">Gestione Avanzata</p>
              </div>
            )}
          </div>

          {/* User profile capsule */}
          {user && (
            <div className={`p-3 border-b border-slate-800/60 bg-slate-950/40 flex items-center ${collapsed ? "justify-center" : "space-x-3"}`}>
              {user.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt={user.displayName || "User"} 
                  className="w-8 h-8 rounded-full border border-slate-700 object-cover shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 bg-indigo-900/60 text-indigo-200 rounded-full flex items-center justify-center border border-indigo-700/50 shrink-0">
                  <User size={14} />
                </div>
              )}
              {!collapsed && (
                <div className="flex-1 min-w-0 transition-opacity duration-300">
                  <p className="text-xs font-semibold text-slate-200 truncate">{user.displayName || "Gestore"}</p>
                  <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                </div>
              )}
            </div>
          )}

          {/* Nav Items */}
          <nav className="p-3 space-y-1.5 flex-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentSection === item.id;
              return (
                <button
                  key={item.id}
                  id={`menu-item-${item.id}${collapsed ? '-collapsed' : ''}`}
                  title={collapsed ? item.label : undefined}
                  onClick={() => {
                    setCurrentSection(item.id);
                    // close mobile drawer if open
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center ${collapsed ? "justify-center" : "justify-between"} px-3 py-2 rounded-lg text-sm font-medium transition-all group relative ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                      : item.highlight
                      ? "bg-slate-850/50 text-amber-400 hover:bg-slate-800 hover:text-amber-300"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon 
                      size={18} 
                      className={`transition-colors shrink-0 ${
                        isActive 
                          ? "text-white" 
                          : item.highlight 
                          ? "text-amber-400 group-hover:text-amber-300" 
                          : "text-slate-400 group-hover:text-slate-200"
                      }`} 
                    />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </div>
                  {!collapsed && item.highlight && !isActive && (
                    <span className="bg-amber-400/10 text-amber-400 text-[9px] px-1.5 py-0.5 rounded font-mono uppercase font-bold tracking-wider animate-pulse shrink-0">
                      AI
                    </span>
                  )}
                  {collapsed && item.highlight && !isActive && (
                    <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer/Logout part */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/20 space-y-2">
          {/* Collapse toggle (desktop only) */}
          <button
            onClick={toggleCollapse}
            className="hidden md:flex w-full items-center justify-center py-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 rounded transition-colors"
            title={collapsed ? "Espandi menu" : "Comprimi menu"}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>

          <button
            onClick={onLogout}
            id={`logout-button${collapsed ? '-collapsed' : ''}`}
            className={`w-full flex items-center ${collapsed ? "justify-center" : "space-x-3"} px-3 py-2 rounded-lg text-sm font-medium text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors`}
            title={collapsed ? "Disconnetti" : undefined}
          >
            <LogOut size={18} className="shrink-0" />
            {!collapsed && <span>Disconnetti</span>}
          </button>

          {!collapsed && (
            <div className="text-center text-[9px] text-slate-500 font-mono transition-opacity duration-300">
              v1.2.0 • Palazzinaro AI
            </div>
          )}
        </div>
      </>
    );
  };

  return (
    <>
      {/* Mobile Overlay Backdrop */}
      {isOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300" 
          onClick={() => setIsOpen(false)} 
        />
      )}

      {/* Mobile Drawer Sidebar */}
      <aside 
        className={`md:hidden fixed inset-y-0 left-0 z-50 bg-slate-900 text-slate-100 flex flex-col justify-between border-r border-slate-800 h-screen transition-transform duration-300 w-52 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        id="app-sidebar-mobile"
      >
        {renderSidebarContent(false)}
      </aside>

      {/* Desktop Persistent Sidebar (In-flow layout so it never overlaps main content) */}
      <aside 
        className={`hidden md:flex h-screen sticky top-0 bg-slate-900 text-slate-100 flex-col justify-between border-r border-slate-800 transition-all duration-300 shrink-0 ${
          isCollapsed ? "w-16" : "w-52"
        }`}
        id="app-sidebar-desktop"
      >
        {renderSidebarContent(isCollapsed)}
      </aside>
    </>
  );
}

import {
  BarChart3,
  Bell,
  Boxes,
  Brain,
  Factory,
  FileText,
  LayoutDashboard,
  Package,
  Scissors,
  Settings,
  ShoppingCart,
  Shirt,
  ShieldAlert,
  Sparkles,
  Users,
  UserSquare2,
  Waves,
  Wind,
  Layers,
  Droplets,
  Flame,
  Sliders,
  Camera,
  Smartphone,
  Cpu,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  to: string;
  params?: Record<string, string>;
  icon: LucideIcon;
};
export type NavGroup = { heading: string; items: NavItem[] };

export const adminNav: NavGroup[] = [
  {
    heading: "Main",
    items: [
      { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
      { label: "Command Centre", to: "/command-centre", icon: ShieldAlert },
      { label: "Orders", to: "/orders", icon: ShoppingCart },
      { label: "Production", to: "/production", icon: Factory },
      { label: "Supervisor Mode", to: "/supervisor", icon: Smartphone },
    ],
  },
  {
    heading: "AI Intelligence",
    items: [
      { label: "AI Intelligence", to: "/ai-intelligence", icon: Brain },
      { label: "Scenario Planner", to: "/scenario-planner", icon: Sliders },
      { label: "Quality & Vision QC", to: "/quality", icon: Camera },
      { label: "Capacity Board", to: "/capacity", icon: Cpu },
      { label: "Inventory", to: "/inventory", icon: Boxes },
      { label: "Analytics", to: "/analytics", icon: BarChart3 },
      { label: "Reports", to: "/reports", icon: FileText },
    ],
  },
  {
    heading: "Stages",
    items: [
      { label: "Yarn", to: "/production/$stage", params: { stage: "yarn" }, icon: Waves },
      { label: "Knitting", to: "/production/$stage", params: { stage: "knitting" }, icon: Layers },
      { label: "Dyeing", to: "/production/$stage", params: { stage: "dyeing" }, icon: Droplets },
      {
        label: "Compacting",
        to: "/production/$stage",
        params: { stage: "compacting" },
        icon: Wind,
      },
      { label: "Cutting", to: "/production/$stage", params: { stage: "cutting" }, icon: Scissors },
      {
        label: "Printing",
        to: "/production/$stage",
        params: { stage: "printing" },
        icon: Sparkles,
      },
      { label: "Sewing", to: "/production/$stage", params: { stage: "sewing" }, icon: Shirt },
      { label: "Ironing", to: "/production/$stage", params: { stage: "ironing" }, icon: Flame },
      { label: "Packing", to: "/production/$stage", params: { stage: "packing" }, icon: Package },
    ],
  },
  {
    heading: "Management",
    items: [
      { label: "Buyers", to: "/buyers", icon: UserSquare2 },
      { label: "Users", to: "/users", icon: Users },
      { label: "Notifications", to: "/notifications", icon: Bell },
      { label: "Settings", to: "/settings", icon: Settings },
    ],
  },
];

export const buyerNav: NavGroup[] = [
  {
    heading: "Portal",
    items: [
      { label: "Dashboard", to: "/buyer/dashboard", icon: LayoutDashboard },
      { label: "My Orders", to: "/buyer/orders", icon: ShoppingCart },
      { label: "Notifications", to: "/buyer/notifications", icon: Bell },
      { label: "Profile", to: "/buyer/profile", icon: UserSquare2 },
    ],
  },
];

const STAGE_ICONS: Record<string, LucideIcon> = {
  yarn: Waves,
  knitting: Layers,
  dyeing: Droplets,
  compacting: Wind,
  cutting: Scissors,
  printing: Sparkles,
  sewing: Shirt,
  ironing: Flame,
  packing: Package,
};

export function processNav(stage: string, label: string): NavGroup[] {
  return [
    {
      heading: `${label} Portal`,
      items: [
        {
          label: `${label} Updates`,
          to: "/production/$stage",
          params: { stage },
          icon: STAGE_ICONS[stage] ?? Factory,
        },
        { label: "Supervisor Mode", to: "/supervisor", icon: Smartphone },
        { label: "Notifications", to: "/notifications", icon: Bell },
      ],
    },
  ];
}

"use client";

import { useState } from "react";
import { ListTodo, Blocks, Settings, Calendar } from "lucide-react";
import { TaskList } from "./TaskList";
import { FixedBlockList } from "./FixedBlockList";
import { SettingsPanel } from "./SettingsPanel";
import { TimelineView } from "./TimelineView";

type TabId = "tasks" | "fixed-blocks" | "settings" | "timeline";

const TABS: { id: TabId; label: string; icon: typeof ListTodo }[] = [
  { id: "tasks", label: "태스크 관리", icon: ListTodo },
  { id: "fixed-blocks", label: "고정 블록 관리", icon: Blocks },
  { id: "timeline", label: "타임라인", icon: Calendar },
  { id: "settings", label: "설정", icon: Settings },
];

export function ScheduleTabs() {
  const [activeTab, setActiveTab] = useState<TabId>("tasks");

  return (
    <div className="space-y-4">
      {/* 탭 네비게이션 */}
      <nav className="flex border-b border-gray-200 overflow-x-auto" aria-label="탭 메뉴">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
              aria-selected={isActive}
              role="tab"
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* 탭 콘텐츠 */}
      <div role="tabpanel">
        {activeTab === "tasks" && <TaskList />}
        {activeTab === "fixed-blocks" && <FixedBlockList />}
        {activeTab === "timeline" && <TimelineView />}
        {activeTab === "settings" && <SettingsPanel />}
      </div>
    </div>
  );
}

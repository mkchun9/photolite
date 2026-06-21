import Link from "next/link";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { ScheduleTabs } from "@/components/scheduler/ScheduleTabs";

export default function SchedulePage() {
  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* 헤더 */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-xl bg-white border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all"
              aria-label="홈으로 돌아가기"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-indigo-900 to-indigo-600 bg-clip-text text-transparent">
                업무 일정 관리
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                마감 기한과 중요도 기반 자동 우선순위 관리
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 text-xs font-medium rounded-full">
            <CalendarClock className="w-3.5 h-3.5" />
            SmartScheduler
          </div>
        </header>

        {/* 탭 네비게이션 + 콘텐츠 */}
        <ScheduleTabs />
      </div>
    </main>
  );
}

import Link from "next/link";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { StatsDashboard } from "@/components/statistics/StatsDashboard";

export default function StatisticsPage() {
  return (
    <main className="min-h-screen py-12 px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* 헤더 */}
        <header className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <BarChart3 className="w-7 h-7 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">절약 통계</h1>
          </div>
          <p className="text-sm text-gray-600">
            이미지 최적화로 절약한 용량을 확인하세요.
          </p>
        </header>

        {/* 네비게이션 */}
        <nav className="flex justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-blue-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            홈으로
          </Link>
          <Link
            href="/gallery"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-blue-400 transition-colors"
          >
            갤러리
          </Link>
        </nav>

        {/* 대시보드 */}
        <StatsDashboard />
      </div>
    </main>
  );
}

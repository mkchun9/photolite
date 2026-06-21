import Link from "next/link";
import { Images, BarChart3, Sparkles, Shield, Zap, CalendarClock } from "lucide-react";
import { UploadZone } from "@/components/upload/UploadZone";

export default function Home() {
  return (
    <main className="min-h-screen py-12 px-4">
      <div className="max-w-3xl mx-auto space-y-10">
        {/* 히어로 헤더 */}
        <header className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-600 text-xs font-medium rounded-full">
            <Sparkles className="w-3 h-3" />
            스마트 이미지 최적화
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-indigo-900 to-indigo-600 bg-clip-text text-transparent">
            PhotoLite
          </h1>
          <p className="text-base text-gray-500 max-w-md mx-auto">
            사진을 업로드하면 자동으로 용량을 줄이고, 비슷한 사진을 찾아줘요.
          </p>
        </header>

        {/* 기능 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FeatureCard
            icon={<Zap className="w-5 h-5 text-amber-500" />}
            title="WebP 최적화"
            description="평균 60~80% 용량 절약"
          />
          <FeatureCard
            icon={<Shield className="w-5 h-5 text-emerald-500" />}
            title="중복 감지"
            description="AI 해시 기반 유사도 분석"
          />
          <FeatureCard
            icon={<BarChart3 className="w-5 h-5 text-indigo-500" />}
            title="절약 통계"
            description="실시간 절약 현황 확인"
          />
        </div>

        {/* 업로드 영역 */}
        <UploadZone />

        {/* 네비게이션 */}
        <nav className="flex justify-center gap-3">
          <Link
            href="/gallery"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all hover:shadow-lg hover:shadow-indigo-200 hover:-translate-y-0.5"
          >
            <Images className="w-4 h-4" />
            갤러리 보기
          </Link>
          <Link
            href="/statistics"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:text-indigo-600 shadow-sm transition-all hover:-translate-y-0.5"
          >
            <BarChart3 className="w-4 h-4" />
            절약 통계
          </Link>
          <Link
            href="/schedule"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:text-indigo-600 shadow-sm transition-all hover:-translate-y-0.5"
          >
            <CalendarClock className="w-4 h-4" />
            업무 일정 관리
          </Link>
        </nav>
      </div>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
      <div className="p-2 bg-gray-50 rounded-lg shrink-0">{icon}</div>
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronUp, Save, Loader2 } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";

export function SettingsPanel() {
  const { settings, status, error, updateSettings } = useSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // 로컬 폼 상태
  const [researchQuotaMin, setResearchQuotaMin] = useState(180);
  const [bufferMin, setBufferMin] = useState(10);
  const [windDownMin, setWindDownMin] = useState(30);
  const [minChunkMin, setMinChunkMin] = useState(25);
  const [maxFocusMin, setMaxFocusMin] = useState(120);
  const [urgencyWeight, setUrgencyWeight] = useState(0.6);
  const [importanceWeight, setImportanceWeight] = useState(0.4);
  const [aiThreshold, setAiThreshold] = useState(0.5);
  const [timezone, setTimezone] = useState("Asia/Seoul");

  // 설정 로드 시 로컬 상태 동기화
  useEffect(() => {
    if (settings) {
      setResearchQuotaMin(settings.researchQuotaMin);
      setBufferMin(settings.bufferMin);
      setWindDownMin(settings.windDownMin);
      setMinChunkMin(settings.minChunkMin);
      setMaxFocusMin(settings.maxFocusMin);
      setUrgencyWeight(settings.urgencyWeight);
      setImportanceWeight(settings.importanceWeight);
      setAiThreshold(settings.aiThreshold);
      setTimezone(settings.timezone);
    }
  }, [settings]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveMessage(null);

    const success = await updateSettings({
      researchQuotaMin,
      bufferMin,
      windDownMin,
      minChunkMin,
      maxFocusMin,
      urgencyWeight,
      importanceWeight,
      aiThreshold,
      timezone,
    });

    setSaving(false);
    if (success) {
      setSaveMessage("설정이 저장되었습니다.");
      setTimeout(() => setSaveMessage(null), 3000);
    } else {
      setSaveMessage("설정 저장에 실패했습니다.");
    }
  }, [
    researchQuotaMin,
    bufferMin,
    windDownMin,
    minChunkMin,
    maxFocusMin,
    urgencyWeight,
    importanceWeight,
    aiThreshold,
    timezone,
    updateSettings,
  ]);

  if (status === "loading" && !settings) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex items-center gap-3 text-gray-500">
          <span className="w-5 h-5 border-2 border-indigo-400/30 border-t-indigo-500 rounded-full animate-spin" />
          <span className="text-sm">설정을 불러오는 중...</span>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="px-4 py-6 bg-red-50 border border-red-200 rounded-xl text-center">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* 접기/펼치기 헤더 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-semibold text-gray-900">스케줄러 설정</span>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {/* 설정 패널 */}
      {isOpen && (
        <div className="px-5 pb-5 space-y-4 border-t border-gray-100">
          <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 연구 쿼터 */}
            <SettingsField
              id="settings-research-quota"
              label="연구 쿼터 (분)"
              value={researchQuotaMin}
              onChange={setResearchQuotaMin}
              min={0}
              step={5}
            />

            {/* 버퍼 */}
            <SettingsField
              id="settings-buffer"
              label="버퍼 (분)"
              value={bufferMin}
              onChange={setBufferMin}
              min={0}
              step={5}
            />

            {/* Wind-down */}
            <SettingsField
              id="settings-winddown"
              label="Wind-down (분)"
              value={windDownMin}
              onChange={setWindDownMin}
              min={0}
              step={5}
            />

            {/* 최소 청크 */}
            <SettingsField
              id="settings-min-chunk"
              label="최소 청크 (분)"
              value={minChunkMin}
              onChange={setMinChunkMin}
              min={5}
              step={5}
            />

            {/* 최대 포커스 */}
            <SettingsField
              id="settings-max-focus"
              label="최대 포커스 (분)"
              value={maxFocusMin}
              onChange={setMaxFocusMin}
              min={15}
              step={5}
            />

            {/* urgency 가중치 */}
            <SettingsField
              id="settings-urgency-weight"
              label="Urgency 가중치"
              value={urgencyWeight}
              onChange={setUrgencyWeight}
              min={0}
              max={1}
              step={0.05}
              isDecimal
            />

            {/* importance 가중치 */}
            <SettingsField
              id="settings-importance-weight"
              label="Importance 가중치"
              value={importanceWeight}
              onChange={setImportanceWeight}
              min={0}
              max={1}
              step={0.05}
              isDecimal
            />

            {/* AI 임계값 */}
            <SettingsField
              id="settings-ai-threshold"
              label="AI 임계값"
              value={aiThreshold}
              onChange={setAiThreshold}
              min={0}
              max={1}
              step={0.05}
              isDecimal
            />

            {/* 타임존 */}
            <div>
              <label
                htmlFor="settings-timezone"
                className="block text-xs font-medium text-gray-600 mb-1"
              >
                타임존
              </label>
              <input
                id="settings-timezone"
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm"
                placeholder="Asia/Seoul"
              />
            </div>
          </div>

          {/* 저장 버튼 + 메시지 */}
          <div className="flex items-center justify-between pt-2">
            <div>
              {saveMessage && (
                <span
                  className={`text-xs font-medium ${
                    saveMessage.includes("실패") ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {saveMessage}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              저장
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** 개별 설정 필드 */
function SettingsField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step,
  isDecimal,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  isDecimal?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-gray-600 mb-1">
        {label}
      </label>
      <input
        id={id}
        type="number"
        value={isDecimal ? value.toFixed(2) : value}
        onChange={(e) => {
          const v = isDecimal ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
          if (!isNaN(v)) onChange(v);
        }}
        min={min}
        max={max}
        step={step}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm"
      />
    </div>
  );
}

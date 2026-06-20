'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/auth-context';
import { api } from '@/app/lib/api';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, Loader2, Sliders, Eye, Users, Thermometer, Info } from 'lucide-react';

interface UserAISettings {
  id?: number;
  user_id?: number;
  temperature: number;
  response_style: string;
  show_sources: boolean;
  preferred_max_tokens: number;
  receive_community_knowledge?: boolean;
  ollama_endpoint?: string;
  updated_at?: string;
}

interface AILimits {
  max_temperature: number;
  max_context_length: number;
  max_tokens: number;
  default_temperature: number;
  default_response_style: string;
}

export default function SettingsAIPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [settings, setSettings] = useState<UserAISettings>({
    temperature: 0.2,
    response_style: 'concise',
    show_sources: true,
    preferred_max_tokens: 512,
    receive_community_knowledge: false,
  });
  const [limits, setLimits] = useState<AILimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
        return;
      }
      fetchData();
    }
  }, [user, authLoading]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [settingsRes, limitsRes] = await Promise.all([
        api.get('/users/me/ai-settings'),
        api.get('/users/me/ai-settings/limits'),
      ]);
      setSettings(settingsRes.data);
      setLimits(limitsRes.data);
    } catch (err) {
      console.error('Error fetching AI settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaveSuccess(false);
    try {
      await api.put('/users/me/ai-settings', settings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Không thể lưu cài đặt. Vui lòng thử lại.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-canvas-soft flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-lavender" size={32} />
      </div>
    );
  }

  const responseStyleOptions = [
    { value: 'concise', label: 'Ngắn gọn', desc: 'Câu trả lời súc tích, đúng trọng tâm' },
    { value: 'detailed', label: 'Chi tiết', desc: 'Giải thích đầy đủ, có ví dụ minh hoạ' },
    { value: 'technical', label: 'Kỹ thuật', desc: 'Ngôn ngữ chuyên ngành, chính xác cao' },
  ];

  return (
    <div className="min-h-screen bg-canvas-soft font-sans">
      <div className="max-w-2xl mx-auto px-6 py-10">

        {/* Back button */}
        <button
          onClick={() => router.push('/settings')}
          className="flex items-center gap-2 text-sm text-ink-muted hover:text-ink transition-colors mb-8 group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Quay lại Cài đặt
        </button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-brand-lavender/10 border border-brand-lavender/20 flex items-center justify-center text-brand-lavender">
              <Sliders size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-ink">Cài đặt AI cá nhân</h1>
              <p className="text-sm text-ink-muted">Tuỳ chỉnh cách WikiBot phản hồi với bạn</p>
            </div>
          </div>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-brand-lavender" size={32} />
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="space-y-6"
          >
            {/* Temperature */}
            <div className="p-6 rounded-2xl border border-hairline bg-surface-1 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <label className="flex items-center gap-2 text-sm font-bold text-ink">
                  <Thermometer size={16} className="text-orange-400" />
                  Độ sáng tạo (Temperature)
                </label>
                <span className="text-lg font-bold text-brand-lavender">{settings.temperature.toFixed(1)}</span>
              </div>
              <p className="text-xs text-ink-muted mb-4">Giá trị thấp = câu trả lời nhất quán hơn. Giá trị cao = sáng tạo hơn.</p>
              <input
                type="range"
                min={0}
                max={limits?.max_temperature ?? 1.0}
                step={0.1}
                value={settings.temperature}
                onChange={(e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) })}
                className="w-full accent-brand-lavender"
              />
              <div className="flex justify-between text-[10px] text-ink-subtle mt-1">
                <span>0 (Nhất quán)</span>
                <span>{limits?.max_temperature ?? 1.0} (Sáng tạo)</span>
              </div>
            </div>

            {/* Response Style */}
            <div className="p-6 rounded-2xl border border-hairline bg-surface-1 shadow-sm">
              <label className="block text-sm font-bold text-ink mb-1">Phong cách phản hồi</label>
              <p className="text-xs text-ink-muted mb-4">Chọn cách WikiBot trình bày câu trả lời.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {responseStyleOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSettings({ ...settings, response_style: opt.value })}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      settings.response_style === opt.value
                        ? 'border-brand-lavender bg-brand-lavender/10 text-brand-lavender'
                        : 'border-hairline hover:border-hairline-strong text-ink-muted hover:text-ink'
                    }`}
                  >
                    <p className="font-bold text-sm">{opt.label}</p>
                    <p className="text-[10px] mt-0.5 opacity-70">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Max Tokens */}
            <div className="p-6 rounded-2xl border border-hairline bg-surface-1 shadow-sm">
              <label className="block text-sm font-bold text-ink mb-1">Độ dài tối đa phản hồi (Max Tokens)</label>
              <p className="text-xs text-ink-muted mb-4">Số token tối đa mỗi câu trả lời. Giới hạn hệ thống: {limits?.max_tokens ?? 2048}.</p>
              <input
                type="number"
                min={128}
                max={limits?.max_tokens ?? 2048}
                step={128}
                value={settings.preferred_max_tokens}
                onChange={(e) => setSettings({ ...settings, preferred_max_tokens: parseInt(e.target.value) || 512 })}
                className="w-full px-4 py-2.5 bg-surface-2 border border-hairline rounded-xl text-ink text-sm outline-none focus:border-brand-lavender transition-colors"
              />
            </div>

            {/* Toggles */}
            <div className="p-6 rounded-2xl border border-hairline bg-surface-1 shadow-sm space-y-4">
              {/* Show Sources */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye size={16} className="text-ink-muted" />
                  <div>
                    <p className="text-sm font-bold text-ink">Hiển thị nguồn tài liệu</p>
                    <p className="text-xs text-ink-muted">Hiển thị tài liệu tham khảo bên dưới câu trả lời</p>
                  </div>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, show_sources: !settings.show_sources })}
                  className={`relative w-12 h-6 rounded-full transition-all ${
                    settings.show_sources ? 'bg-brand-lavender' : 'bg-surface-2 border border-hairline'
                  }`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                    settings.show_sources ? 'left-6' : 'left-0.5'
                  }`} />
                </button>
              </div>

              {/* Receive Community Knowledge */}
              {user.subscription_tier === 'pro' && (
                <div className="flex items-center justify-between pt-4 border-t border-hairline">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-ink-muted" />
                    <div>
                      <p className="text-sm font-bold text-ink">Nhận tri thức cộng đồng</p>
                      <p className="text-xs text-ink-muted">Dùng tài liệu chung từ cộng đồng Pro (chỉ Pro)</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSettings({ ...settings, receive_community_knowledge: !settings.receive_community_knowledge })}
                    className={`relative w-12 h-6 rounded-full transition-all ${
                      settings.receive_community_knowledge ? 'bg-brand-lavender' : 'bg-surface-2 border border-hairline'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                      settings.receive_community_knowledge ? 'left-6' : 'left-0.5'
                    }`} />
                  </button>
                </div>
              )}
            </div>

            {/* Safety Limits Info (Readonly) */}
            {limits && (
              <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 flex items-start gap-3">
                <Info size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-ink-muted">
                  <span className="font-bold text-ink">Giới hạn hệ thống: </span>
                  Max temperature <span className="text-brand-lavender font-bold">{limits.max_temperature}</span> ·
                  Max tokens <span className="text-brand-lavender font-bold">{limits.max_tokens}</span> ·
                  Style mặc định <span className="text-brand-lavender font-bold">{limits.default_response_style}</span>
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 rounded-xl font-bold text-sm bg-brand-lavender hover:bg-brand-lavender/90 text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-brand-lavender/25"
            >
              {saving ? (
                <><Loader2 className="animate-spin" size={16} />Đang lưu...</>
              ) : saveSuccess ? (
                <>✓ Đã lưu thành công!</>
              ) : (
                <><Save size={16} />Lưu cài đặt AI</>
              )}
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}

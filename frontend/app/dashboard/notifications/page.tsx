"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

type Notification = {
  id: number;
  trigger_type: string;
  message: string;
  sent_at: string;
  read_at: string | null;
};

const TRIGGER_LABELS: Record<string, { label: string; color: string }> = {
  inference: { label: "AI 감지", color: "bg-purple-100 text-purple-600" },
  time_based: { label: "일정 알림", color: "bg-blue-100 text-blue-600" },
  state_transition: {
    label: "단계 변경",
    color: "bg-green-100 text-green-600",
  },
  event_detection: { label: "이벤트", color: "bg-orange-100 text-orange-600" },
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("trigger_log")
      .select("*")
      .eq("user_id", user.id)
      .order("sent_at", { ascending: false });

    setNotifications(data ?? []);
    setLoading(false);

    // 안 읽은 알림 모두 읽음 처리
    const unreadIds = (data ?? []).filter((n) => !n.read_at).map((n) => n.id);

    if (unreadIds.length > 0) {
      await supabase
        .from("trigger_log")
        .update({ read_at: new Date().toISOString() })
        .in("id", unreadIds);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-2xl font-black text-gray-900">알림</h1>
        <p className="text-sm text-gray-500 mt-1">
          BOSS가 감지한 중요 이벤트 알림입니다
        </p>
      </div>

      {/* 알림 목록 */}
      <div className="glass-card rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">
            불러오는 중...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-3xl mb-3">🔔</p>
            <p className="text-sm text-gray-400">아직 알림이 없습니다</p>
            <p className="text-xs text-gray-400 mt-1">
              매출 변화나 중요 일정이 감지되면 알림이 생성됩니다
            </p>
          </div>
        ) : (
          <div className="divide-y divide-surface-300">
            {notifications.map((n) => {
              const tag = TRIGGER_LABELS[n.trigger_type] ?? {
                label: n.trigger_type,
                color: "bg-gray-100 text-gray-500",
              };
              return (
                <div
                  key={n.id}
                  className={`p-4 flex gap-4 ${!n.read_at ? "bg-brand-50/40" : ""}`}
                >
                  {/* 읽음 표시 */}
                  <div className="mt-1 flex-shrink-0">
                    {!n.read_at ? (
                      <span className="block w-2 h-2 rounded-full bg-brand-500" />
                    ) : (
                      <span className="block w-2 h-2 rounded-full bg-gray-200" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tag.color}`}
                      >
                        {tag.label}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDate(n.sent_at)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {n.message}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

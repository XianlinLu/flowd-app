'use client';

import { useState } from 'react';
import { toast } from '@/lib/toast';

interface FeishuSyncProps {
  cardCount: number;
}

export function FeishuSync({ cardCount }: FeishuSyncProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [config, setConfig] = useState({
    appId: '',
    appSecret: '',
    appToken: '',
    tableId: '',
    direction: 'export' as 'export' | 'import',
  });

  const handleSync = async () => {
    if (!config.appId || !config.appSecret) {
      toast.error('请输入 App ID 和 App Secret');
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/feishu/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : 'Sync failed' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
        </svg>
        飞书同步
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-[500px] max-w-[90vw]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">飞书同步</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  同步方向
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="export"
                      checked={config.direction === 'export'}
                      onChange={(e) => setConfig({ ...config, direction: e.target.value as 'export' })}
                      className="text-blue-600"
                    />
                    <span className="text-sm">导出到飞书 ({cardCount} 张卡片)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="import"
                      checked={config.direction === 'import'}
                      onChange={(e) => setConfig({ ...config, direction: e.target.value as 'import' })}
                      className="text-blue-600"
                    />
                    <span className="text-sm">从飞书导入</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  App ID
                </label>
                <input
                  type="text"
                  value={config.appId}
                  onChange={(e) => setConfig({ ...config, appId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  placeholder="cli_xxxxxxxx"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  App Secret
                </label>
                <input
                  type="password"
                  value={config.appSecret}
                  onChange={(e) => setConfig({ ...config, appSecret: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  placeholder="输入 App Secret"
                />
              </div>

              {config.direction === 'export' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bitable App Token
                    </label>
                    <input
                      type="text"
                      value={config.appToken}
                      onChange={(e) => setConfig({ ...config, appToken: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                      placeholder="bascnxxxxxxxx"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Table ID
                    </label>
                    <input
                      type="text"
                      value={config.tableId}
                      onChange={(e) => setConfig({ ...config, tableId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                      placeholder="tblxxxxxxxx"
                    />
                  </div>
                </>
              )}

              {result && (
                <div className={`p-3 rounded-lg text-sm ${result.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                  {result.error ? (
                    <p>错误: {result.error}</p>
                  ) : (
                    <div>
                      <p className="font-medium">同步成功!</p>
                      {result.direction === 'export' ? (
                        <p>已同步 {result.synced} 张卡片，失败 {result.failed} 张</p>
                      ) : (
                        <p>已导入 {result.imported} 张卡片</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSync}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? '同步中...' : '开始同步'}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  关闭
                </button>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500">
              <p>提示: 需要在飞书开放平台创建应用并获取凭证</p>
              <p>导出时会自动去重，最多支持 5000 条记录</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

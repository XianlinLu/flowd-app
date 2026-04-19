import React, { useState, useEffect } from 'react';

interface Folder {
  token: string;
  name: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (folderToken: string) => void;
}

export function FeishuFolderSelectModal({ isOpen, onClose, onConfirm }: Props) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedToken, setSelectedToken] = useState<string>(''); // '' means root directory

  useEffect(() => {
    if (isOpen) {
      fetchFolders();
    }
  }, [isOpen]);

  const fetchFolders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/feishu/folders');
      const data = await res.json();
      if (data.success && data.folders) {
        setFolders(data.folders);
      }
    } catch (err) {
      console.error('Failed to fetch folders', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-scale-in">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">同步至飞书文件夹</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <p className="text-sm text-gray-500 mb-4">选择要同步的目标文件夹：</p>
        
        <div className="space-y-2 max-h-60 overflow-y-auto mb-6 pr-2">
          <label className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${selectedToken === '' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
            <input 
              type="radio" 
              name="folder" 
              value="" 
              checked={selectedToken === ''}
              onChange={() => setSelectedToken('')}
              className="mr-3"
            />
            <span className="text-sm font-medium text-gray-700">根目录 (直接同步)</span>
          </label>
          
          {loading ? (
            <div className="text-center py-4 text-sm text-gray-500">加载中...</div>
          ) : folders.length > 0 ? (
            folders.map(folder => (
              <label key={folder.token} className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${selectedToken === folder.token ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                <input 
                  type="radio" 
                  name="folder" 
                  value={folder.token} 
                  checked={selectedToken === folder.token}
                  onChange={() => setSelectedToken(folder.token)}
                  className="mr-3"
                />
                <span className="text-sm font-medium text-gray-700">{folder.name}</span>
              </label>
            ))
          ) : (
            <div className="text-center py-4 text-sm text-gray-500">没有找到文件夹</div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            取消
          </button>
          <button 
            onClick={() => onConfirm(selectedToken)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
          >
            确认同步
          </button>
        </div>
      </div>
    </div>
  );
}

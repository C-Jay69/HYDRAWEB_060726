import React, { useState } from 'react';
import grapesjs, { Editor } from 'grapesjs';
import GjsEditor, { Canvas, BlocksProvider } from '@grapesjs/react';
import 'grapesjs/dist/css/grapes.min.css';
import gjsBasicBlocks from 'grapesjs-blocks-basic';

const CustomBlocks = () => {
  return (
    <BlocksProvider>
      {(props) => {
        // Group blocks by category if needed, but for now just show them
        return (
          <div className="flex flex-col gap-4">
            <div>
              <div className="flex items-center gap-2 mb-3 text-gray-400">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m6 9 6 6 6-6"/></svg>
                <span className="text-[11px] font-bold uppercase tracking-wider">Basic</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {props.blocks.map((block) => (
                  <div
                    key={block.getId()}
                    draggable
                    onDragStart={() => props.dragStart(block)}
                    onDragEnd={() => props.dragStop()}
                    className="flex flex-col items-center justify-center min-h-[90px] bg-[#3c3c3c] border border-[#1e1e1e] rounded cursor-grab hover:bg-[#4a4a4a] hover:border-[#666] transition-all group p-2"
                  >
                    <div 
                      className="w-10 h-10 flex items-center justify-center text-gray-400 group-hover:text-white [&>svg]:w-8 [&>svg]:h-8"
                      dangerouslySetInnerHTML={{ __html: block.getMedia() || `
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                        </svg>
                      ` }}
                    />
                    <div className="text-[9px] uppercase mt-2 text-gray-400 group-hover:text-white font-medium text-center leading-tight">
                      {block.getLabel()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      }}
    </BlocksProvider>
  );
};

const EditorPage: React.FC<{
  content?: { html: string; css: string };
  onExit: () => void;
}> = ({ content, onExit }) => {
  const [editor, setEditor] = useState<Editor | null>(null);

  const onEditor = (editorInstance: Editor) => {
    console.log('Editor loaded', editorInstance);
    setEditor(editorInstance);

    if (content) {
      // Clear any previous local storage content to ensure a fresh AI start
      editorInstance.setComponents('');
      editorInstance.setStyleSheet('');

      editorInstance.setComponents(content.html);
      editorInstance.setStyleSheet(content.css);
    }
  };

  const exportHtml = () => {
    if (!editor) return;

    const html = editor.getHtml();
    const css = editor.getCss();

    const fullDocument = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Exported Website</title>
  <style>
    ${css}
  </style>
</head>
<body>
  ${html}
</body>
</html>`;

    const blob = new Blob([fullDocument], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'index.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#2d2d2d] overflow-hidden">
      <GjsEditor
        className="gjs-custom-editor"
        grapesjs={grapesjs}
        options={{
          height: '100%',
          storageManager: content ? false : {
            type: 'local',
            autosave: true,
            hostname: 'localhost',
            plugins: [gjsBasicBlocks],
            storageKey: 'hydraweb-project-save',
          },
          plugins: [gjsBasicBlocks],
        }}
        onReady={onEditor}
      >
        <div className="flex h-screen flex-col overflow-hidden">
          {/* Top Bar */}
          <div className="flex items-center justify-between px-4 py-2 bg-[#2d2e2e] border-b border-black/20 text-white shadow-md z-10 shrink-0">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 bg-[#1e1e1e] p-1 rounded">
                <button
                  className="p-1 hover:bg-white/10 rounded"
                  title="Desktop"
                  onClick={() => editor?.DeviceManager.setDevice('desktop')}
                >
                  <MonitorIcon />
                </button>
                <button
                  className="p-1 hover:bg-white/10 rounded"
                  title="Tablet"
                  onClick={() => editor?.DeviceManager.setDevice('tablet')}
                >
                  <TabletIcon />
                </button>
                <button
                  className="p-1 hover:bg-white/10 rounded"
                  title="Mobile"
                  onClick={() => editor?.DeviceManager.setDevice('mobile')}
                >
                  <SmartphoneIcon />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                title="Back to Home"
                onClick={onExit}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" x2="5" y1="12" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              </button>
              <div className="w-px h-4 bg-white/10 mx-1" />
              <button className="p-1.5 hover:bg-white/10 rounded" title="Grid"><GridIcon /></button>
              <button className="p-1.5 hover:bg-white/10 rounded" title="Preview"><EyeIcon /></button>
              <button className="p-1.5 hover:bg-white/10 rounded" title="Fullscreen"><MaximizeIcon /></button>
              <button className="p-1.5 hover:bg-white/10 rounded text-purple-400" title="Code"><CodeIcon /></button>
              <div className="w-px h-4 bg-white/10 mx-1" />
              <button className="p-1.5 hover:bg-white/10 rounded" title="Undo"><UndoIcon /></button>
              <button className="p-1.5 hover:bg-white/10 rounded" title="Redo"><RedoIcon /></button>
              <div className="w-px h-4 bg-white/10 mx-1" />
              <button
                className="p-1.5 hover:bg-white/10 rounded"
                title="Export"
                onClick={exportHtml}
              >
                <DownloadIcon />
              </button>
              <button className="p-1.5 hover:bg-white/10 rounded" title="Delete"><TrashIcon /></button>
              <button className="p-1.5 hover:bg-white/10 rounded" title="Save"><SaveIcon /></button>
              <div className="w-px h-4 bg-white/10 mx-1" />
              <button className="p-1.5 bg-purple-600 rounded text-white" title="Add"><PlusIcon /></button>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Canvas */}
            <div className="flex-1 bg-[#444] overflow-hidden relative">
              <Canvas className="h-full w-full" />
            </div>

            {/* Sidebar */}
            <div className="w-72 bg-[#2d2e2e] border-l border-black/20 flex flex-col text-white shrink-0">
              <div className="flex border-b border-black/20">
                <button className="flex-1 py-3 text-xs font-bold border-b-2 border-purple-500">BLOCKS</button>
                <button className="flex-1 py-3 text-xs font-bold text-gray-500 hover:text-gray-300">STYLES</button>
                <button className="flex-1 py-3 text-xs font-bold text-gray-500 hover:text-gray-300">LAYERS</button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <CustomBlocks />
              </div>
            </div>
          </div>
        </div>
      </GjsEditor>

      <style>{`
        .gjs-cv-canvas {
          width: 100% !important;
          height: 100% !important;
          top: 0 !important;
        }
        .gjs-block {
          width: 100% !important;
          min-height: 80px !important;
          background: #3c3c3c !important;
          color: #eee !important;
          border: 1px solid #1e1e1e !important;
          margin-bottom: 10px !important;
          padding: 15px !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 5px !important;
          font-size: 11px !important;
          border-radius: 4px !important;
          transition: all 0.2s !important;
        }
        .gjs-block:hover {
          background: #4a4a4a !important;
          border-color: #666 !important;
          color: #fff !important;
        }
        .gjs-block-label {
          margin-top: 5px !important;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #2d2e2e;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #444;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
      `}</style>
    </div>
  );
};

// Simple Icons to avoid missing lucide icon issues
const MonitorIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" /></svg>;
const TabletIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2" /><line x1="12" x2="12.01" y1="18" y2="18" /></svg>;
const SmartphoneIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2" /><line x1="12" x2="12.01" y1="18" y2="18" /></svg>;
const GridIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" /><rect width="7" height="7" x="14" y="14" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" /></svg>;
const EyeIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>;
const MaximizeIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" x2="14" y1="3" y2="10" /><line x1="3" x2="10" y1="21" y2="14" /></svg>;
const CodeIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>;
const UndoIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></svg>;
const RedoIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" /></svg>;
const DownloadIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>;
const TrashIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>;
const SaveIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>;
const PlusIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="5" y2="19" /><line x1="5" x2="19" y1="12" y2="12" /></svg>;

export default EditorPage;
